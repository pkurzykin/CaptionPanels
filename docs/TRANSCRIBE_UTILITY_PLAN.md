# Transcription + Alignment Utility Plan (WhisperX Prototype)

Goal: build a Windows utility that takes:
- `video.mp4`
- our subtitles source JSON (segments with `segId` + text)

and produces:
- `words.json` (debug: word timestamps)
- `alignment.json` (block-level timings: `segId -> start/end/confidence`)

The plugin will later load `alignment.json` and apply in/out points for each subtitle block.

This document describes a concrete plan/project layout for the utility. Implementation is planned later.

---

## Why WhisperX (for the first working version)

We need word-level timestamps ("each word has start/end time") so we can:
- set block start = first word start
- set block end = last word end

WhisperX provides a ready-made pipeline to get word timestamps (Whisper + alignment). This is the fastest way to prove the workflow on real projects.

---

## High-level Workflow

1) Extract audio from `video.mp4` (to WAV).
2) Run ASR (speech-to-text) with Whisper.
3) Run alignment to obtain word timestamps.
4) Build `alignment.json` by matching our block texts to the word stream.
5) Mark low-confidence / foreign / unmatched blocks as `unmatched` (plugin will not touch them).

---

## Phase Plan

### Phase 1 (prototype, fastest): Python CLI on Pavel's Windows laptop

Deliverables:
- `tools/transcribe_align/transcribe_align.py`
- `tools/transcribe_align/requirements.txt`
- `tools/transcribe_align/config.example.json`
- `tools/transcribe_align/README.md`
- Output: `words.json`, `alignment.json`, and a human-readable summary log

Notes:
- No `.exe` yet.
- This phase is for correctness, workflow validation, and tuning.
- Models are not committed to git (kept in a shared folder or local cache).

### Phase 2A (packaging): wrap Python into a distributable `.exe` or portable folder

Deliverables:
- `dist/transcribe_align/` (portable package) OR a single `.exe` (if possible)
- A "first run" experience that downloads/copies models to local cache

Trade-offs:
- Faster to ship, but bigger artifacts and sometimes more issues with antivirus/InfoSec.

#### Phase 2A (recommended style): "portable folder" done properly

We prefer a **portable folder** (not a single-file `.exe`) because it is:
- easier to debug and support
- often more stable with antivirus / corporate environments
- easier to keep dependencies reproducible

Key rules:

1) Pin dependency versions (so it doesn't "break next month")
- Keep `requirements.txt` with fully pinned versions (no loose `>=`).
- Optionally maintain `requirements.in` and compile pins with `pip-tools` (future).

2) Ship as a folder (PyInstaller `--onedir`)
- Produce `dist/transcribe_align/` containing:
  - `transcribe_align.exe`
  - bundled Python runtime + libs (inside `_internal/` or similar)
- Avoid "onefile" packaging (slower startup, more AV false-positives, harder debugging).

3) Keep models out of the package
- Do NOT bundle Whisper / alignment model weights into git or the portable folder by default.
- Use **local cache** + optional **SMB share source**:
  - first run: copy required model files from SMB share (if configured) into local cache
  - next runs: always use local cache for speed and reliability
- Add a simple manifest (planned): `models.manifest.json`
  - required models (names)
  - expected file hashes (to detect "wrong model version")

Suggested defaults (Windows):
- Local cache: `%ProgramData%\\CaptionPanels\\Transcribe\\models\\`
- Logs: `%LOCALAPPDATA%\\CaptionPanels\\Transcribe\\logs\\`

4) Log file + clear errors
- Always write a log file per run (with timestamps).
- On failure, print a short, human-readable error to stdout and include the log path.
  Examples:
  - "Model not found in cache and SMB share is not доступна"
  - "GPU not available, falling back to CPU"
  - "Unsupported file path / no permissions"

5) Version visibility
- Utility supports `--version` and prints:
  - utility version
  - pinned dependency set version (e.g. a build ID)
  - expected model manifest version

### Phase 2B (corporate-friendly): native worker (no Python)

Deliverables:
- `transcribe_worker.exe` built from native code (C++/C#/Rust)
- Models stored separately, optional local cache

Trade-offs:
- Longer development, but often easier for InfoSec review and long-term maintenance.

---

## Repo Layout (planned)

```
tools/
  transcribe_align/
    transcribe_align.py
    requirements.txt
    config.example.json
    README.md
    schemas/
      alignment.schema.json   (optional)
      words.schema.json       (optional)
    sample/
      sample_subtitles.json   (small test)
      sample_alignment.json   (expected output)
```

`models/` and `cache/` folders are NOT committed. They live outside the repo or are generated locally.

---

## CLI Contract (planned)

Example:
```
transcribe_align.exe ^
  --video "D:\\work\\video.mp4" ^
  --subtitles "D:\\work\\subtitles.json" ^
  --out-dir "D:\\work\\out" ^
  --lang ru ^
  --model small ^
  --device cuda ^
  --cache-dir "D:\\CaptionPanelsCache\\whisper"
```

Minimum required args:
- `--video`
- `--subtitles`
- `--out-dir`

Optional args:
- `--lang` (default: `ru`)
- `--model` (`small` default, allow `medium`)
- `--device` (`cuda` default if available, otherwise `cpu`)
- `--cache-dir` (where to store downloaded/copied models and intermediate data)
- `--keep-temp` (for debugging)
- `--log` (explicit log path)

Exit codes:
- `0` success
- non-zero on error

Stdout:
- a short final summary line (OK/ERR + paths)

---

## Output Files

### 1) words.json (debug)

Structure:
```
[
  { "w": "privet", "s": 12.34, "e": 12.56 },
  ...
]
```

### 2) alignment.json (input to plugin)

Must include:
- `schemaVersion`
- `source` (engine/model/lang)
- `blocks` with `{ segId, start, end, confidence }`
- `unmatched` with `{ segId, reason }`

Times are in seconds relative to the start of the input video.

---

## Matching Blocks to Words (simple, robust approach)

We do not attempt "perfect" linguistic matching. We want a practical solution:

1) Normalize both sides (block text and ASR words):
   - lowercase
   - yo->e (Russian)
   - remove punctuation
   - unify dash variants
   - collapse spaces
2) Walk blocks left-to-right.
3) For each block:
   - split to tokens
   - search for the best match within a sliding window in the word stream
   - if found with confidence >= threshold:
     - start = first matched word start
     - end = last matched word end
   - else:
     - mark as unmatched

Foreign speech / translated subtitles:
- expected to be unmatched often (this is OK by design).

---

## Performance Strategy (GPU + long videos)

Videos are usually 2-10 minutes, sometimes up to 30-40 minutes.

Plan:
- Default model: `small` for speed.
- Optional model: `medium` for quality.
- Use GPU (`cuda`) by default (NVIDIA is available).
- Add caching so repeated runs on the same video do not redo heavy work.

---

## Error Handling / User-friendly Messages

The utility must produce clear messages for:
- ffmpeg/audio extraction failure
- missing CUDA / GPU fallback to CPU
- missing model files
- unsupported input path / permissions

Also produce a short summary:
- blocks total / matched / unmatched
- top-N lowest-confidence blocks (for debugging)

---

## InfoSec (IБ) Notes (future rollout)

Phase 1 stays on Pavel's laptop.

Before colleague rollout:
- decide packaging (2A vs 2B)
- decide model distribution policy (local cache vs SMB share + local cache)
- provide checksums and a short functional description for review

---

## Milestones Checklist

1) Build a working Phase 1 prototype (Python + WhisperX) that produces `words.json`.
2) Implement block matching and output `alignment.json`.
3) Validate on 5-10 real videos (short + 10min + one long case).
4) Add confidence thresholds and a usable summary report.
5) Decide packaging path:
   - 2A quickly (PyInstaller) OR
   - 2B corporate (native worker)
