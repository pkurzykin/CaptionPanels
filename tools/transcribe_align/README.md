# transcribe_align (prototype)

Windows CLI utility for CaptionPanels auto-timing.

Takes:
- `blocks.json` exported from the plugin (segId + text)
- WhisperX JSON (`segments[].words[]`) OR `words.json` (simplified word timestamps)

Produces:
- `words.json` (debug; our simplified format)
- `alignment.json` (segId -> start/end/confidence)

## Output contract

`alignment.json` (schemaVersion: 1):
- `settings` (padStartFrames/padEndFrames/minDurationFrames)
- `blocks`: array of `{ segId, start, end, confidence }`
- `unmatched`: array of `{ segId, reason, ... }`

See `schemas/alignment.schema.json` (informal).

## Quick start (align-only mode)

If you already have `words.json` (word timestamps), you can build `alignment.json` without ASR:

```bat
cd tools\transcribe_align
python transcribe_align.py --blocks D:\work\blocks.json --words-json D:\work\words.json --out-dir D:\work\out
```

## Using WhisperX output (recommended)

If you have WhisperX JSON output (with `segments[].words[]`), you can build `words.json` + `alignment.json` in one step:

```bat
cd tools\transcribe_align
python transcribe_align.py --blocks D:\work\blocks.json --whisperx-json D:\work\whisperx.json --out-dir D:\work\out --video D:\work\video.mp4 --lang ru
```

This will also write `out\words.json` (simplified debug format).

## One-command mode (video -> alignment) using WhisperX CLI

If WhisperX is installed and `whisperx` is available in PATH, you can run everything in one command:

```bat
cd tools\transcribe_align
python transcribe_align.py --video D:\work\video.mp4 --blocks D:\work\blocks.json --out-dir D:\work\out --run-whisperx --whisperx-model small --whisperx-device cuda
```

Notes:
- WhisperX JSON will be written to `out\whisperx\`.
- We always also write `out\words.json`.

## Tuning matching

The matcher is heuristic (fast + deterministic). If some blocks don't align well, you can tune:

- `--threshold` (default: 0.70)
  - Higher = stricter (fewer wrong matches, more unmatched)
  - Lower = more aggressive (more matches, risk of wrong matches)

- `--max-skip` (default: 4)
  - How many ASR words we can skip while searching for the next token.

- `--window-words` (default: 800)
  - Search window size ahead of the current pointer.

- `--backtrack-words` (default: 80)
  - Allows searching a bit before the last matched word (helps recover if a previous block was missed).

- `--anchors-per-block` (default: 3)
  - How many anchor tokens to try for candidate generation.

- `--no-fuzzy`
  - Disables cheap fuzzy token matching (prefix-based for long tokens).

- `--max-candidates` (default: 2000)
  - Caps the number of candidate start positions evaluated per block.
