# Auto Subtitle Timing (Transcription + Word Timecodes) Plan

Goal: automatically set the **start/end duration** of each generated subtitle block so it matches speech:
- block start = when the first word in the block is spoken
- block end = when the last word in the block finishes

Current state: subtitle blocks are created with a fixed template duration and then manually trimmed.

Status: plan only (implementation later). We start with "apply timings from file" to avoid InfoSec (ИБ) blockers.

## Constraints / Assumptions

- Input media: always `.mp4` with good speech + background music (no sung/spoken words in music).
- Language: ~99% Russian. Foreign speakers can be left unmatched and handled manually.
- Subtitle text source: our existing JSON import (segments) and manual "Create Subtitle" flow.
- We want the "correct" solution: set **both** in/out (start + end), not only outPoint.

## Recommended Strategy (Two-Phase)

### Phase A (recommended first): plugin applies timings, transcription runs externally

- External step produces `alignment.json` (block-level timings).
- Plugin loads `alignment.json`, matches blocks, applies in/out, and shows a report with:
  - "Apply all"
  - "Apply all except selected"

Why:
- fast to implement and test
- isolates the hardest part (ASR/transcription) from the plugin
- no `.exe` distribution inside the plugin yet -> fewer IБ questions

### Phase B (later): one-click transcription via local worker `.exe` (requires IБ approval)

- Plugin runs `transcribe_worker.exe` and receives `alignment.json` automatically.

## Key Design Decision: Stable Block Identity (segId tagging)

To avoid guessing, each subtitle block created by the plugin should be tagged with a stable ID:
- `segId` from JSON (e.g. `seg_12`)
- stored on the AE layer in a durable place:
  - `layer.comment` OR
  - a layer marker (preferred because it's visible in AE)

Then timing application is trivial:
- find layer by segId
- set in/out based on alignment data for that segId

## Data Contracts

### 1) alignment.json (input to plugin)

We use block-level data, not raw words, to keep plugin logic simple.

Recommended structure:
```json
{
  "schemaVersion": 1,
  "source": {
    "engine": "whisperx|faster-whisper|other",
    "language": "ru",
    "media": "your_file.mp4"
  },
  "settings": {
    "padStartFrames": 0,
    "padEndFrames": 2,
    "minDurationFrames": 3
  },
  "blocks": [
    { "segId": "seg_1", "start": 12.345, "end": 15.678, "confidence": 0.92 },
    { "segId": "seg_2", "start": 16.100, "end": 18.050, "confidence": 0.88 }
  ],
  "unmatched": [
    { "segId": "seg_17", "reason": "foreign_speech|low_confidence|not_found" }
  ]
}
```

Notes:
- `start/end` are seconds (float) in the same timeline as the `.mp4`.
- confidence is optional but strongly recommended.

### 2) (optional) words.json (debug only)

For debugging alignment:
```json
[
  { "w": "привет", "s": 12.34, "e": 12.56 },
  { "w": "мир", "s": 12.60, "e": 12.80 }
]
```

The plugin does not need this to apply timings.

## Plugin Work (Phase A)

### UI

- Add a button: `Apply Timings…` (loads `alignment.json`)
- After scanning:
  - show a report table:
    - segId / block text preview
    - old start/end (frames)
    - new start/end (frames)
    - checkbox "exclude" (for "apply except selected")
  - actions:
    - `Apply all`
    - `Apply all except selected`

### Host logic

1) Read `alignment.json`.
2) For each `blocks[i]`:
   - find the subtitle layer by `segId` tag
   - convert seconds -> frames in the target comp
   - apply padding and constraints
   - set layer in/out
3) Do not touch items in `unmatched` and items excluded by the user.
4) Return a detailed report back to UI.

### Frame conversion rules

- `startFrame = floor(startSeconds * fps)`
- `endFrame = ceil(endSeconds * fps)`
- Apply padding in frames:
  - startFrame -= padStartFrames
  - endFrame += padEndFrames
- Clamp:
  - endFrame >= startFrame + minDurationFrames
  - within comp duration
- If overlap happens (end > next start):
  - clamp end to nextStart - 1 frame (optional rule; to be decided after tests)

## External Utility (Phase A) — Later Plan

Purpose: given:
- `.mp4` audio
- our subtitle blocks (text + segIds, in order)

Produce:
- `alignment.json` (block-level start/end)

High level steps:
1) Extract audio from `.mp4` (ffmpeg -> wav).
2) Speech recognition (ASR) -> transcript with word timestamps.
3) Normalize text (punctuation, case, yo->e, dash variants).
4) Align our block text to the word stream:
   - greedy left-to-right matching with backtracking window
   - compute per-block confidence
5) Build `alignment.json`.

Foreign speech:
- if confidence is too low -> put segId into `unmatched`
- plugin keeps those blocks manual

## Git Strategy

- Create branch: `feature/auto-timing`.
- Phase A plugin changes live fully inside this branch until tested.
- No `.exe` is committed/distributed in this phase.
- Merge to `main` only when stable.

## Versioning Guidance

- Phase A adds a new user-visible feature ("Apply Timings…"):
  - bump MINOR when shipped (e.g. `2.1.0 -> 2.2.0`)
- If merged but hidden behind a flag and not shipped: version bump can be deferred.

## Milestones

1) Branch `feature/auto-timing`.
2) Add segId tagging to created subtitle blocks.
3) Add `Apply Timings…` UI and host plumbing.
4) Implement frame conversion + in/out application + report modal.
5) Test with a handcrafted alignment.json on a real AE project.
6) Only after that: design and build the transcription/alignment utility.

