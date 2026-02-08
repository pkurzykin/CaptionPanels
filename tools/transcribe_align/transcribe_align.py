#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""CaptionPanels: transcribe + align utility (prototype).

Right now this tool focuses on the deterministic part:
- read blocks.json (segId + text)
- read words.json (word timestamps)
- match blocks to words left-to-right
- produce alignment.json

ASR (WhisperX) integration will be added in later steps.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class Word:
    w: str
    s: float
    e: float


_STOPWORDS = {
    # Minimal RU stopwords used only for anchor choice.
    "и", "в", "во", "на", "а", "но", "что", "это", "как", "мы", "вы", "он", "она", "они",
    "я", "ты", "к", "ко", "по", "о", "об", "от", "до", "за", "из", "у", "с", "со",
}


def _norm_text(s: str) -> str:
    s = (s or "").lower()
    s = s.replace("ё", "е")

    # Unify all kinds of dashes to a normal hyphen. (Not about hyphenation rules, only normalization.)
    s = s.replace("–", "-").replace("—", "-").replace("−", "-").replace("‑", "-")

    # Remove punctuation (keep letters/digits and spaces/hyphen).
    s = re.sub(r"[^0-9a-zа-я\-\s]+", " ", s, flags=re.IGNORECASE)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def tokenize(s: str) -> List[str]:
    t = _norm_text(s)
    if not t:
        return []
    # Split by spaces and hyphens.
    parts: List[str] = []
    for p in t.split():
        if "-" in p:
            parts.extend([x for x in p.split("-") if x])
        else:
            parts.append(p)
    return [p for p in parts if p]


def load_words(path: Path) -> List[Word]:
    data = json.loads(path.read_text(encoding="utf-8"))
    out: List[Word] = []
    for it in data:
        if not isinstance(it, dict):
            continue
        w = str(it.get("w", "")).strip()
        s = float(it.get("s", 0.0))
        e = float(it.get("e", 0.0))
        if not w:
            continue
        out.append(Word(w=_norm_text(w), s=s, e=e))
    return out


def load_blocks(path: Path) -> List[Dict[str, Any]]:
    obj = json.loads(path.read_text(encoding="utf-8"))
    blocks = obj.get("blocks", []) if isinstance(obj, dict) else []
    out: List[Dict[str, Any]] = []
    for b in blocks:
        if not isinstance(b, dict):
            continue
        seg = str(b.get("segId", "")).strip()
        if not seg:
            continue
        text = str(b.get("textOneLine") or b.get("text") or "")
        out.append({
            "segId": seg,
            "type": str(b.get("type", "")),
            "text": text,
            "tokens": tokenize(text),
        })
    return out


def choose_anchor(tokens: List[str]) -> str:
    for t in tokens:
        if len(t) <= 2:
            continue
        if t in _STOPWORDS:
            continue
        return t
    return tokens[0] if tokens else ""


def try_match(tokens: List[str], words: List[Word], start_idx: int, max_words: int, max_skip: int) -> Tuple[float, Optional[Tuple[int, int]]]:
    if not tokens:
        return 0.0, None

    i = start_idx
    end_limit = min(len(words), start_idx + max_words)

    first: Optional[int] = None
    last: Optional[int] = None
    matched = 0
    skips = 0

    for tok in tokens:
        found = None
        j_end = min(end_limit, i + max_skip + 1)
        for j in range(i, j_end):
            if words[j].w == tok:
                found = j
                break
        if found is None:
            # allow miss, but it will reduce score
            continue
        matched += 1
        if first is None:
            first = found
        last = found
        skips += max(0, found - i)
        i = found + 1
        if i >= end_limit:
            break

    if first is None or last is None:
        return 0.0, None

    base = matched / max(1, len(tokens))
    # small penalty for skipping too much
    score = base - min(0.2, skips * 0.002)
    if score < 0:
        score = 0.0

    return score, (first, last)


def match_blocks(blocks: List[Dict[str, Any]], words: List[Word], *, window_words: int = 800, max_skip: int = 4, threshold: float = 0.70) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    results: List[Dict[str, Any]] = []
    unmatched: List[Dict[str, Any]] = []

    cur = 0

    for b in blocks:
        seg = b["segId"]
        toks = b.get("tokens") or []
        if not toks:
            unmatched.append({"segId": seg, "reason": "empty_text"})
            continue

        anchor = choose_anchor(toks)
        # candidate starts: where word == anchor
        cand = [i for i in range(cur, min(len(words), cur + window_words)) if words[i].w == anchor]
        if not cand:
            unmatched.append({"segId": seg, "reason": "anchor_not_found"})
            continue

        best_score = 0.0
        best_span: Optional[Tuple[int, int]] = None
        best_start = None

        for st in cand[:2000]:
            score, span = try_match(toks, words, st, window_words, max_skip)
            if score > best_score:
                best_score = score
                best_span = span
                best_start = st

        if not best_span or best_score < threshold:
            unmatched.append({"segId": seg, "reason": "low_confidence"})
            continue

        i0, i1 = best_span
        start = float(words[i0].s)
        end = float(words[i1].e)

        results.append({
            "segId": seg,
            "start": start,
            "end": end,
            "confidence": round(best_score, 3),
        })

        # advance current pointer to keep left-to-right matching stable
        cur = max(cur, i1 + 1)

    return results, unmatched


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(prog="transcribe_align", add_help=True)
    ap.add_argument("--blocks", required=True, help="Path to blocks.json exported from CaptionPanels")
    ap.add_argument("--words-json", required=True, help="Path to words.json (word timestamps). ASR integration comes later")
    ap.add_argument("--out-dir", required=True, help="Output directory")

    ap.add_argument("--pad-start-frames", type=float, default=0)
    ap.add_argument("--pad-end-frames", type=float, default=2)
    ap.add_argument("--min-duration-frames", type=float, default=3)

    ap.add_argument("--threshold", type=float, default=0.70)
    ap.add_argument("--max-skip", type=int, default=4)
    ap.add_argument("--window-words", type=int, default=800)

    args = ap.parse_args(argv)

    blocks_path = Path(args.blocks)
    words_path = Path(args.words_json)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    blocks = load_blocks(blocks_path)
    words = load_words(words_path)

    matched, unmatched = match_blocks(
        blocks,
        words,
        window_words=int(args.window_words),
        max_skip=int(args.max_skip),
        threshold=float(args.threshold),
    )

    alignment = {
        "schemaVersion": 1,
        "source": {
            "engine": "transcribe_align-prototype",
            "language": "ru",
            "media": "",
        },
        "settings": {
            "padStartFrames": args.pad_start_frames,
            "padEndFrames": args.pad_end_frames,
            "minDurationFrames": args.min_duration_frames,
        },
        "blocks": matched,
        "unmatched": unmatched,
    }

    out_path = out_dir / "alignment.json"
    out_path.write_text(json.dumps(alignment, ensure_ascii=False, indent=2) + "
", encoding="utf-8")

    summary = f"OK alignment={out_path} matched={len(matched)} unmatched={len(unmatched)}"
    print(summary)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
