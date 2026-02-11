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
from typing import Any, Dict, List, Tuple


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
    p.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "
", encoding="utf-8")


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


def main(argv: List[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="run_whisperx", add_help=True)
    ap.add_argument("--input", required=True, help="Path to input media (.mp4)")
    ap.add_argument("--output_dir", required=True, help="Directory for outputs")
    ap.add_argument("--out_json", default="", help="Output JSON path (default: <output_dir>/whisperx.json)")

    ap.add_argument("--language", default="ru")
    ap.add_argument("--model", default="medium")
    ap.add_argument("--device", default="cuda", help="cuda or cpu")
    ap.add_argument("--vad_method", default="silero", help="silero or none")
    ap.add_argument("--compute_type", default="", help="Optional faster-whisper compute_type")
    ap.add_argument("--cache_dir", default="", help="Optional cache root (will set HF_HOME there)")

    # Advanced decode params (optional; if not set we use model defaults)
    ap.add_argument("--beam_size", type=int, default=None)
    ap.add_argument("--temperature", type=float, default=None)
    ap.add_argument("--no_speech_threshold", type=float, default=None)
    ap.add_argument("--logprob_threshold", type=float, default=None)
    ap.add_argument("--condition_on_previous_text", type=_str2bool, default=None)

    # Keep compatibility with our Settings "extra args" field: we accept unknown args and just report them.
    args, unknown = ap.parse_known_args(argv)

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
    }
    _write_json(out_dir / "whisperx_runner_meta.json", meta)

    # Keep stdout short (AE callSystem can truncate).
    print(f"OK out_json={out_json} segments={len(aligned_segments)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
