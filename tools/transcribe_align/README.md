# transcribe_align (prototype)

Windows CLI utility for CaptionPanels auto-timing.

Takes:
- `video.mp4` (optional for now)
- `blocks.json` exported from the plugin (segId + text)

Produces:
- `words.json` (debug)
- `alignment.json` (segId -> start/end/confidence)

This is a **prototype**: first we implement the matching + file contracts, then plug in WhisperX.

## Quick start (align-only mode)

If you already have a `words.json` (word timestamps), you can build `alignment.json` without ASR:

```bat
cd tools	ranscribe_align
python transcribe_align.py --blocks D:\work\blocks.json --words-json D:\work\words.json --out-dir D:\work\out
```

## Planned ASR mode (later)

```bat
python transcribe_align.py --video D:\work\video.mp4 --blocks D:\work\blocks.json --out-dir D:\work\out --lang ru --model small --device cuda
```

## Output contract

- `alignment.json` must follow `schemaVersion: 1` and contain:
  - `settings` (padStartFrames/padEndFrames/minDurationFrames)
  - `blocks`: array of `{ segId, start, end, confidence }`
  - `unmatched`: array of `{ segId, reason }`

See `schemas/alignment.schema.json` (informal).
