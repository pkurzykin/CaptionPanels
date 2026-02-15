#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""CaptionPanels WhisperX runner.

Why this exists:
- `python -m whisperx ...` CLI flags differ between versions.
- We want stable behavior and stable advanced parameters for ASR quality.

This wrapper:
- loads media with WhisperX (ffmpeg is required)
- transcribes with faster-whisper (supports decode params like beam_size, temperature, ...)
- runs WhisperX alignment to get word-level timestamps
- writes a WhisperX-like JSON (segments -> words) that our aligner can read.

No network is required *after* models are cached locally.
"""

from __future__ import annotations

import argparse
import inspect
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


def _str2bool(v: Any) -> bool:
    if isinstance(v, bool):
        return v
    s = str(v).strip().lower()
    if s in ("1", "true", "yes", "y", "on"):
        return True
    if s in ("0", "false", "no", "n", "off"):
        return False
    raise argparse.ArgumentTypeError(f"invalid boolean: {v}")


def _ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def _write_json(p: Path, obj: Any) -> None:
    p.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _read_text_fallback(p: Path) -> str:
    for enc in ("utf-8", "utf-16", "cp1251", "mbcs"):
        try:
            return p.read_text(encoding=enc)
        except Exception:
            continue
    # Last resort: bytes -> utf-8 with replacement.
    return p.read_bytes().decode("utf-8", errors="replace")


def _median(vals: List[float]) -> float:
    if not vals:
        return 0.0
    a = sorted(float(x) for x in vals)
    n = len(a)
    mid = n // 2
    if n % 2 == 1:
        return float(a[mid])
    return float((a[mid - 1] + a[mid]) / 2.0)


def _percentile(vals: List[float], p: float) -> float:
    """Simple percentile for small diagnostic stats (p in [0..1])."""
    if not vals:
        return 0.0
    a = sorted(float(x) for x in vals)
    if p <= 0:
        return float(a[0])
    if p >= 1:
        return float(a[-1])
    idx = int(round((len(a) - 1) * p))
    idx = max(0, min(len(a) - 1, idx))
    return float(a[idx])


def _clamp(v: float, lo: float, hi: float) -> float:
    return float(max(lo, min(hi, v)))


def _compute_onset_bias_from_segments(segments: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Estimate systematic "late start" bias.

    WhisperX word-level timestamps can be slightly later than the perceived speech onset,
    especially with VAD/segmentation. We estimate the typical delta between segment start
    and the first aligned word start.
    """
    deltas: List[float] = []

    for seg in segments:
        if not isinstance(seg, dict):
            continue
        try:
            seg_start = float(seg.get("start", 0.0))
        except Exception:
            continue

        wlist = seg.get("words")
        if not isinstance(wlist, list) or not wlist:
            continue

        first: Optional[float] = None
        for w in wlist:
            if not isinstance(w, dict):
                continue
            st = w.get("start")
            if st is None:
                st = w.get("s")
            if st is None:
                continue
            try:
                ss = float(st)
            except Exception:
                continue
            if first is None or ss < first:
                first = ss

        if first is None:
            continue

        d = float(first - seg_start)
        # Guard rails: ignore weird negatives and huge gaps.
        if d < 0 or d > 1.0:
            continue
        deltas.append(d)

    med = _median(deltas)
    stats = {
        "count": int(len(deltas)),
        "median": round(float(med), 4),
        "p90": round(float(_percentile(deltas, 0.90)), 4) if deltas else 0.0,
        "min": round(float(min(deltas)), 4) if deltas else 0.0,
        "max": round(float(max(deltas)), 4) if deltas else 0.0,
    }
    return {"deltas": deltas, "stats": stats}


def _compute_onset_bias_from_original_and_aligned(
    original_segments: List[Dict[str, Any]],
    aligned_segments: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Estimate systematic bias using original ASR segments vs aligned words.

    Important: whisperx.align() often sets segment.start == first_word.start, which makes the
    naive "segment.start -> first_word.start" delta always 0. To detect a real onset bias,
    we compare the original ASR segment start (from faster-whisper) against the first aligned
    word start after WhisperX alignment.
    """
    deltas: List[float] = []

    orig_by_id: Dict[int, float] = {}
    for i, seg in enumerate(original_segments):
        if not isinstance(seg, dict):
            continue
        seg_id = seg.get("id", i)
        try:
            sid = int(seg_id)
        except Exception:
            continue
        try:
            orig_by_id[sid] = float(seg.get("start", 0.0))
        except Exception:
            continue

    for idx, seg in enumerate(aligned_segments):
        if not isinstance(seg, dict):
            continue

        # Find original start by id when possible, otherwise fall back to index.
        orig_start: Optional[float] = None
        if "id" in seg:
            try:
                orig_start = float(orig_by_id.get(int(seg.get("id")), 0.0))
            except Exception:
                orig_start = None
        if orig_start is None:
            if idx < len(original_segments) and isinstance(original_segments[idx], dict):
                try:
                    orig_start = float(original_segments[idx].get("start", 0.0))
                except Exception:
                    orig_start = None
        if orig_start is None:
            continue

        # Prefer the first word start (more stable than seg.start).
        wlist = seg.get("words")
        if not isinstance(wlist, list) or not wlist:
            continue

        first: Optional[float] = None
        for w in wlist:
            if not isinstance(w, dict):
                continue
            st = w.get("start")
            if st is None:
                st = w.get("s")
            if st is None:
                continue
            try:
                ss = float(st)
            except Exception:
                continue
            if first is None or ss < first:
                first = ss

        if first is None:
            continue

        d = float(first - float(orig_start))
        # Guard rails: ignore weird negatives and huge gaps.
        if d < 0 or d > 1.0:
            continue
        deltas.append(d)

    med = _median(deltas)
    stats = {
        "count": int(len(deltas)),
        "median": round(float(med), 4),
        "p90": round(float(_percentile(deltas, 0.90)), 4) if deltas else 0.0,
        "min": round(float(min(deltas)), 4) if deltas else 0.0,
        "max": round(float(max(deltas)), 4) if deltas else 0.0,
    }
    return {"deltas": deltas, "stats": stats}


def _apply_time_shift_to_segments(segments: List[Dict[str, Any]], shift_sec: float) -> None:
    """In-place shift of segment/word timestamps (seconds)."""
    if not segments:
        return
    if abs(float(shift_sec)) < 1e-9:
        return

    for seg in segments:
        if not isinstance(seg, dict):
            continue
        for k in ("start", "end"):
            if k in seg and seg[k] is not None:
                try:
                    seg[k] = float(seg[k]) + float(shift_sec)
                except Exception:
                    pass
        wlist = seg.get("words")
        if not isinstance(wlist, list):
            continue
        for w in wlist:
            if not isinstance(w, dict):
                continue
            for k in ("start", "end", "s", "e"):
                if k in w and w[k] is not None:
                    try:
                        w[k] = float(w[k]) + float(shift_sec)
                    except Exception:
                        pass



def _filter_kwargs(func, kwargs: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
    """Return (accepted_kwargs, ignored_keys) based on func signature."""
    try:
        sig = inspect.signature(func)
        params = set(sig.parameters.keys())
    except Exception:
        # If we can't introspect, pass everything through.
        return kwargs, []

    accepted: Dict[str, Any] = {}
    ignored: List[str] = []
    for k, v in kwargs.items():
        if k in params:
            accepted[k] = v
        else:
            ignored.append(k)
    return accepted, ignored


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(prog="run_whisperx", add_help=True)
    ap.add_argument("--input", default="", help="Path to input media (.mp4)")
    ap.add_argument("--input_file", default="", help="Optional text file with input media path (UTF-8/UTF-16)")
    ap.add_argument("--output_dir", required=True, help="Directory for outputs")
    ap.add_argument("--out_json", default="", help="Output JSON path (default: <output_dir>/whisperx.json)")

    ap.add_argument("--language", default="ru")
    ap.add_argument("--model", default="medium")
    ap.add_argument("--device", default="cuda", help="cuda or cpu")
    ap.add_argument("--vad_method", default="silero", help="silero or none")
    ap.add_argument("--compute_type", default="", help="Optional faster-whisper compute_type")
    ap.add_argument("--cache_dir", default="", help="Optional cache root (will set HF_HOME there)")

    ap.add_argument(
        "--apply_time_shift",
        action="store_true",
        help="Apply heuristic negative shift to timestamps to compensate systematic late starts",
    )

    # Advanced decode params (optional; if not set we use model defaults)
    ap.add_argument("--beam_size", type=int, default=None)
    ap.add_argument("--temperature", type=float, default=None)
    ap.add_argument("--no_speech_threshold", type=float, default=None)
    ap.add_argument("--logprob_threshold", type=float, default=None)
    ap.add_argument("--condition_on_previous_text", type=_str2bool, default=None)

    # Keep compatibility with our Settings "extra args" field: we accept unknown args and just report them.
    args, unknown = ap.parse_known_args(argv)

    if args.input_file:
        ipf = Path(args.input_file)
        if not ipf.exists():
            raise SystemExit(f"input_file not found: {ipf}")
        args.input = _read_text_fallback(ipf).strip()
        if not args.input:
            raise SystemExit(f"input_file is empty: {ipf}")

    if not args.input:
        raise SystemExit("Either --input or --input_file must be provided")

    input_path = Path(args.input)
    out_dir = Path(args.output_dir)
    _ensure_dir(out_dir)

    out_json = Path(args.out_json) if args.out_json else (out_dir / "whisperx.json")

    cache_root = Path(args.cache_dir) if args.cache_dir else None
    if cache_root:
        # Force HF cache into a deterministic location (offline-friendly).
        hf_home = cache_root / "huggingface"
        _ensure_dir(hf_home)
        os.environ.setdefault("HF_HOME", str(hf_home))

    # Lazy imports after env is configured.
    try:
        import whisperx  # type: ignore
    except Exception as e:
        raise SystemExit(f"Cannot import whisperx: {e}")

    try:
        from faster_whisper import WhisperModel  # type: ignore
    except Exception as e:
        raise SystemExit(f"Cannot import faster_whisper: {e}")

    # 1) Load audio (WhisperX uses ffmpeg under the hood)
    try:
        audio = whisperx.load_audio(str(input_path))
    except Exception as e:
        raise SystemExit(f"Failed to load audio (ffmpeg?): {e}")

    # 2) Transcribe
    device = str(args.device or "cuda").strip().lower() or "cuda"
    compute_type = str(args.compute_type or "").strip()
    if not compute_type:
        compute_type = "float16" if device == "cuda" else "int8"

    download_root = None
    if cache_root:
        download_root = str(cache_root / "faster-whisper")

    model = WhisperModel(
        str(args.model or "medium"),
        device=device,
        compute_type=compute_type,
        download_root=download_root,
    )

    vad_method = str(args.vad_method or "silero").strip().lower()
    vad_filter = vad_method in ("silero", "true", "1", "yes", "on")

    transcribe_kwargs: Dict[str, Any] = {
        "language": str(args.language or "ru"),
        "beam_size": args.beam_size,
        "temperature": args.temperature,
        "vad_filter": vad_filter,
        "word_timestamps": False,
        "no_speech_threshold": args.no_speech_threshold,
        "log_prob_threshold": args.logprob_threshold,
        "condition_on_previous_text": args.condition_on_previous_text,
    }
    # Drop None values, then filter by actual signature.
    transcribe_kwargs = {k: v for k, v in transcribe_kwargs.items() if v is not None}
    transcribe_kwargs, ignored_keys = _filter_kwargs(model.transcribe, transcribe_kwargs)

    segments_out: List[Dict[str, Any]] = []
    info_obj = None
    try:
        segments_gen, info_obj = model.transcribe(audio, **transcribe_kwargs)
        for idx, seg in enumerate(segments_gen):
            segments_out.append({
                "id": idx,
                "start": float(getattr(seg, "start", 0.0)),
                "end": float(getattr(seg, "end", 0.0)),
                "text": str(getattr(seg, "text", "")),
            })
    except Exception as e:
        raise SystemExit(f"Transcribe failed: {e}")

    # 3) Align words using WhisperX align model
    lang = str(args.language or "ru")
    try:
        align_model, metadata = whisperx.load_align_model(language_code=lang, device=device)
        aligned = whisperx.align(
            segments_out,
            align_model,
            metadata,
            audio,
            device,
            return_char_alignments=False,
        )
        aligned_segments = aligned.get("segments", []) if isinstance(aligned, dict) else []
    except Exception as e:
        raise SystemExit(f"Alignment failed: {e}")

    # 3.5) Estimate onset bias and optionally apply a global time shift.
    # Compare original ASR segment start -> first aligned word start.
    onset = _compute_onset_bias_from_original_and_aligned(
        segments_out,
        aligned_segments if isinstance(aligned_segments, list) else [],
    )
    onset_stats = onset.get("stats", {}) if isinstance(onset, dict) else {}

    # Suggested shift: move everything earlier by the typical segment->first-word delta.
    # Clamp to a sane range to avoid accidental huge shifts on bad input.
    suggested_shift_sec = 0.0
    try:
        if isinstance(onset_stats, dict) and int(onset_stats.get("count", 0)) >= 5:
            med = float(onset_stats.get("median", 0.0))
            # Ignore tiny biases to reduce jitter.
            if med >= 0.08:
                suggested_shift_sec = -_clamp(med, 0.0, 0.40)
    except Exception:
        suggested_shift_sec = 0.0

    applied_shift_sec = 0.0
    if bool(args.apply_time_shift) and abs(suggested_shift_sec) > 1e-9:
        _apply_time_shift_to_segments(aligned_segments, suggested_shift_sec)
        applied_shift_sec = float(suggested_shift_sec)

    out_obj: Dict[str, Any] = {
        "schemaVersion": 1,
        "language": lang,
        "model": str(args.model or ""),
        "device": device,
        "segments": aligned_segments,
    }

    _write_json(out_json, out_obj)

    meta = {
        "tool": "CaptionPanels.run_whisperx",
        "schemaVersion": 1,
        "input": str(input_path),
        "outputJson": str(out_json),
        "outputDir": str(out_dir),
        "device": device,
        "model": str(args.model or ""),
        "language": lang,
        "vad_method": vad_method,
        "compute_type": compute_type,
        "cache_dir": str(cache_root) if cache_root else "",
        "argsApplied": transcribe_kwargs,
        "argsIgnored": sorted(set(ignored_keys + [a for a in unknown if a.startswith('--')])),
        "unknownArgs": unknown,
        "segments": len(aligned_segments),
        "onsetBiasSec": onset_stats,
        "timeShiftSuggestedSec": round(float(suggested_shift_sec), 4),
        "timeShiftAppliedSec": round(float(applied_shift_sec), 4),
        "timeShiftReason": "asr_segment_start_vs_first_word_start_median",
    }
    _write_json(out_dir / "whisperx_runner_meta.json", meta)

    # Keep stdout short (AE callSystem can truncate).
    print(
        f"OK out_json={out_json} segments={len(aligned_segments)} "
        f"shiftAppliedSec={round(float(applied_shift_sec), 4)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
