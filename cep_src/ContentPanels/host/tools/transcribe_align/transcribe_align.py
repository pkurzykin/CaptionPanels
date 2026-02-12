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
        wn = _norm_text(w)
        # Drop tokens like "-" that can appear in some Whisper outputs.
        if not wn or not re.search(r"[0-9a-zа-я]", wn, flags=re.IGNORECASE):
            continue
        out.append(Word(w=wn, s=s, e=e))
    return out

def load_words_from_whisperx_json(path: Path) -> List[Word]:
    """Parse WhisperX JSON output (segments -> words) into our simplified word list."""
    obj = json.loads(path.read_text(encoding="utf-8"))

    words: List[Word] = []

    def _push(word: str, s: Any, e: Any) -> None:
        try:
            if word is None:
                return
            w = _norm_text(str(word).strip())
            if not w:
                return
            # Drop tokens like "-" that can appear in some Whisper outputs.
            if not re.search(r"[0-9a-zа-я]", w, flags=re.IGNORECASE):
                return
            if s is None or e is None:
                return
            ss = float(s)
            ee = float(e)
            if ee <= ss:
                return
            words.append(Word(w=w, s=ss, e=ee))
        except Exception:
            return

    if isinstance(obj, dict):
        segs = obj.get("segments")
        if isinstance(segs, list):
            for seg in segs:
                if not isinstance(seg, dict):
                    continue
                wlist = seg.get("words")
                if isinstance(wlist, list):
                    for w in wlist:
                        if not isinstance(w, dict):
                            continue
                        _push(w.get("word") or w.get("w"), w.get("start") or w.get("s"), w.get("end") or w.get("e"))

        # Some WhisperX variants may store words directly.
        wlist2 = obj.get("words")
        if isinstance(wlist2, list) and not words:
            for w in wlist2:
                if not isinstance(w, dict):
                    continue
                _push(w.get("word") or w.get("w"), w.get("start") or w.get("s"), w.get("end") or w.get("e"))

    # Deduplicate tiny overlaps (optional, keep simple)
    return words


def save_words_json(words: List[Word], out_path: Path) -> None:
    data = [{"w": w.w, "s": round(float(w.s), 3), "e": round(float(w.e), 3)} for w in words]
    out_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")



def run_whisperx_cli(*, whisperx_bin: str, media_path: Path, out_dir: Path, lang: str, model: str, device: str, extra_args: list[str]) -> Path:
    """Run WhisperX CLI and return the path to its JSON output.

    We call the CLI (not the Python API) to reduce the risk of API drift between versions.
    """
    import subprocess

    out_dir.mkdir(parents=True, exist_ok=True)

    cmd = [
        whisperx_bin,
        str(media_path),
        '--output_dir', str(out_dir),
        '--output_format', 'json',
        '--language', str(lang),
        '--model', str(model),
        '--device', str(device),
    ]
    if extra_args:
        cmd.extend(extra_args)

    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        msg = (proc.stdout or "") + "\n" + (proc.stderr or "")
        raise RuntimeError("whisperx failed (exit=%s)\n%s" % (proc.returncode, msg.strip()))
    expected = out_dir / (media_path.stem + '.json')
    if expected.exists():
        return expected

    cands = sorted(out_dir.glob('*.json'), key=lambda p: p.stat().st_mtime, reverse=True)
    for p in cands:
        if p.name.lower() in ('alignment.json', 'words.json'):
            continue
        return p

    raise RuntimeError('whisperx finished, but no JSON output found in: %s' % out_dir)


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
    # Backward-compatible single-anchor picker (kept for older code paths).
    for t in tokens:
        if len(t) <= 2:
            continue
        if t in _STOPWORDS:
            continue
        return t
    return tokens[0] if tokens else ""


def choose_anchors(tokens: List[str], freq: Dict[str, int], k: int) -> List[str]:
    """Pick up to k anchors for candidate generation.

    Heuristic:
    - prefer non-stopwords
    - prefer longer tokens
    - prefer rarer tokens in the transcript (lower freq)

    This usually reduces ambiguity and improves matching stability.
    """
    if not tokens:
        return []

    seen = set()

    def uniq(seq):
        out = []
        for s in seq:
            if s in seen:
                continue
            seen.add(s)
            out.append(s)
        return out

    # Prefer meaningful tokens first.
    meaningful = [t for t in tokens if len(t) > 2 and t not in _STOPWORDS]
    if not meaningful:
        meaningful = [t for t in tokens if len(t) > 1] or tokens

    meaningful = uniq(meaningful)

    def key(t: str):
        return (freq.get(t, 10**9), -len(t), 1 if t in _STOPWORDS else 0)

    meaningful.sort(key=key)
    k = max(1, int(k or 1))
    return meaningful[:k]


def _token_match(word: str, tok: str, *, fuzzy: bool) -> bool:
    if word == tok:
        return True
    if not fuzzy:
        return False

    # Cheap fuzzy match for Russian morphology / minor ASR variations.
    # Use only for reasonably long tokens to avoid false positives.
    if len(word) >= 5 and len(tok) >= 5:
        if word[:4] == tok[:4]:
            return True
        if word.startswith(tok) or tok.startswith(word):
            return True

    # Numbers: allow 2.5 vs 2,5 normalization artifacts.
    if word.replace(" ", "") == tok.replace(" ", ""):
        return True

    return False


def try_match(tokens: List[str], words: List[Word], start_idx: int, max_words: int, max_skip: int, *, fuzzy: bool) -> Tuple[float, Optional[Tuple[int, int]]]:
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
            if _token_match(words[j].w, tok, fuzzy=fuzzy):
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

    # Penalty for skipping too much.
    score = base - min(0.25, skips * 0.002)

    # Penalty for too wide span (likely wrong match on repeated words).
    span_words = (last - first + 1)
    if span_words > len(tokens) * 3:
        score -= min(0.15, (span_words - len(tokens) * 3) * 0.002)

    if score < 0:
        score = 0.0

    return score, (first, last)


def _build_word_index(words: List[Word]) -> Tuple[Dict[str, int], Dict[str, List[int]]]:
    freq: Dict[str, int] = {}
    pos: Dict[str, List[int]] = {}
    for i, w in enumerate(words):
        freq[w.w] = freq.get(w.w, 0) + 1
        pos.setdefault(w.w, []).append(i)
    return freq, pos


def match_blocks(
    blocks: List[Dict[str, Any]],
    words: List[Word],
    *,
    window_words: int = 800,
    max_skip: int = 4,
    threshold: float = 0.70,
    backtrack_words: int = 80,
    anchors_per_block: int = 3,
    fuzzy: bool = True,
    max_candidates: int = 2000,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Match subtitle blocks to ASR words left-to-right.

    Improvements over the first prototype:
    - multiple anchors per block (rarer/longer tokens)
    - small backtrack window when previous blocks failed
    - fuzzy token matching (cheap heuristic)
    - adaptive threshold for short blocks
    """

    results: List[Dict[str, Any]] = []
    unmatched: List[Dict[str, Any]] = []

    freq, pos = _build_word_index(words)

    cur = 0

    for b in blocks:
        seg = b["segId"]
        toks = b.get("tokens") or []
        if not toks:
            unmatched.append({"segId": seg, "reason": "empty_text"})
            continue

        # Search range: allow small backtrack (helps if a previous match was missed).
        start_from = max(0, cur - int(backtrack_words or 0))
        end_at = min(len(words), cur + int(window_words))

        anchors = choose_anchors(toks, freq, int(anchors_per_block or 1))

        def _tok_offsets(tok: str) -> List[int]:
            # All indices where this token appears in the block.
            out: List[int] = []
            for ti, t in enumerate(toks):
                if t == tok:
                    out.append(ti)
            return out

        cand: List[int] = []
        for a in anchors:
            offsets = _tok_offsets(a)
            if not offsets:
                continue
            for i in pos.get(a, []):
                if not (start_from <= i < end_at):
                    continue
                # Candidate "block start" positions derived from the anchor position minus
                # the anchor offset inside the block.
                for off in offsets:
                    st = i - off
                    if st < 0:
                        continue
                    cand.append(st)

        if not cand:
            # Fallback: try the first token as an anchor.
            a0 = toks[0]
            offsets0 = _tok_offsets(a0) or [0]
            for i in pos.get(a0, []):
                if not (start_from <= i < end_at):
                    continue
                for off in offsets0:
                    st = i - off
                    if st < 0:
                        continue
                    cand.append(st)

        if not cand:
            unmatched.append({"segId": seg, "reason": "anchor_not_found", "anchors": anchors})
            continue

        # Deduplicate and keep deterministic ordering.
        cand = sorted(set(cand))
        if len(cand) > max_candidates:
            cand = cand[:max_candidates]

        best_score = 0.0
        best_span: Optional[Tuple[int, int]] = None
        best_start: Optional[int] = None

        # First pass: default params.
        for st in cand:
            score, span = try_match(toks, words, st, int(window_words), int(max_skip), fuzzy=fuzzy)
            if score > best_score or (score == best_score and best_start is not None and st < best_start):
                best_score = score
                best_span = span
                best_start = st

        # Adaptive threshold for short blocks.
        min_thr = float(threshold)
        if len(toks) <= 3:
            min_thr = min(min_thr, 0.55)
        elif len(toks) <= 5:
            min_thr = min(min_thr, 0.62)

        # Fallback: allow more skipping if we are close.
        if (not best_span) or (best_score < min_thr):
            best2_score = best_score
            best2_span = best_span
            best2_start = best_start

            for st in cand:
                score, span = try_match(toks, words, st, int(window_words), min(int(max_skip) * 2, 10), fuzzy=fuzzy)
                if score > best2_score or (score == best2_score and best2_start is not None and st < best2_start):
                    best2_score = score
                    best2_span = span
                    best2_start = st

            best_score, best_span, best_start = best2_score, best2_span, best2_start

        if not best_span or best_score < min_thr:
            unmatched.append({
                "segId": seg,
                "reason": "low_confidence",
                "score": round(float(best_score), 3),
                "anchors": anchors,
            })
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

        # Advance current pointer to keep left-to-right matching stable.
        cur = max(cur, i1 + 1)

    return results, unmatched


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(prog="transcribe_align", add_help=True)
    ap.add_argument("--blocks", required=True, help="Path to blocks.json exported from CaptionPanels")
    ap.add_argument("--words-json", help="Path to words.json (word timestamps)")
    ap.add_argument("--whisperx-json", help="Path to WhisperX JSON output (segments/words)")
    ap.add_argument("--video", help="Optional: video.mp4 path (for metadata only)")
    ap.add_argument("--lang", default="ru", help="Language tag for metadata (default: ru)")
    ap.add_argument("--run-whisperx", action="store_true", help="Run WhisperX CLI to get word timestamps")
    ap.add_argument("--whisperx-bin", default="whisperx", help="Path to whisperx executable (default: whisperx)")
    ap.add_argument("--whisperx-model", default="small", help="Whisper model name (default: small)")
    ap.add_argument("--whisperx-device", default="cuda", help="Device: cuda or cpu (default: cuda)")
    ap.add_argument("--whisperx-extra", default="", help="Extra args for whisperx CLI (raw string)")
    ap.add_argument("--out-dir", required=True, help="Output directory")
    ap.add_argument("--pad-end-frames", type=float, default=2)
    ap.add_argument("--min-duration-frames", type=float, default=3)

    ap.add_argument("--threshold", type=float, default=0.70)
    ap.add_argument("--max-skip", type=int, default=4)
    ap.add_argument("--window-words", type=int, default=800)

    ap.add_argument("--backtrack-words", type=int, default=80, help="Allow searching a bit before the last matched word (default: 80)")
    ap.add_argument("--anchors-per-block", type=int, default=3, help="How many anchors per block to try (default: 3)")
    ap.add_argument("--no-fuzzy", action="store_true", help="Disable fuzzy token matching")
    ap.add_argument("--max-candidates", type=int, default=2000, help="Max candidate start positions to evaluate (default: 2000)")

    args = ap.parse_args(argv)

    blocks_path = Path(args.blocks)
    words_path = Path(args.words_json) if args.words_json else None
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    blocks = load_blocks(blocks_path)
    # Input words can come either from our simplified words.json, from WhisperX JSON,
    # or be generated on-the-fly by running WhisperX CLI.
    words: List[Word] = []

    if args.run_whisperx:
        if not args.video:
            raise SystemExit("--run-whisperx requires --video")
        media_path = Path(args.video)
        wx_out_dir = out_dir / "whisperx"
        extra = str(args.whisperx_extra or "").strip()
        extra_args = extra.split() if extra else []
        wx_json = run_whisperx_cli(
            whisperx_bin=str(args.whisperx_bin),
            media_path=media_path,
            out_dir=wx_out_dir,
            lang=str(args.lang or "ru"),
            model=str(args.whisperx_model),
            device=str(args.whisperx_device),
            extra_args=extra_args,
        )
        words = load_words_from_whisperx_json(wx_json)
        save_words_json(words, out_dir / "words.json")

    elif words_path:
        words = load_words(words_path)

    elif args.whisperx_json:
        wx_path = Path(args.whisperx_json)
        words = load_words_from_whisperx_json(wx_path)
        save_words_json(words, out_dir / "words.json")

    else:
        raise SystemExit("You must provide --words-json or --whisperx-json (or use --run-whisperx)")

    matched, unmatched = match_blocks(
        blocks,
        words,
        window_words=int(args.window_words),
        max_skip=int(args.max_skip),
        threshold=float(args.threshold),
        backtrack_words=int(args.backtrack_words),
        anchors_per_block=int(args.anchors_per_block),
        fuzzy=(not bool(args.no_fuzzy)),
        max_candidates=int(args.max_candidates),
    )

    alignment = {
        "schemaVersion": 1,
        "source": {
            "engine": "transcribe_align-prototype",
            "language": str(args.lang or "ru"),
            "media": str(args.video or ""),
        },
        "settings": {
            "padEndFrames": args.pad_end_frames,
            "minDurationFrames": args.min_duration_frames,
        },
        "blocks": matched,
        "unmatched": unmatched,
    }

    out_path = out_dir / "alignment.json"
    out_path.write_text(json.dumps(alignment, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    summary = f"OK alignment={out_path} matched={len(matched)} unmatched={len(unmatched)}"
    print(summary)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
