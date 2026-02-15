# Word Import (DOCX -> JSON) Plan

Goal: add a workflow where the user selects a `.docx` in the plugin UI, and the plugin automatically converts it to our JSON schema (same as `Тест_Разметка.json`) and then runs the existing "Load JSON" import logic.

Status: implemented on branch `feature/word-import` (not merged to `main` yet). See also `docs/WORD_IMPORT_IMPLEMENTATION.md`.

## Constraints / Assumptions

- Input format: always `.docx`.
- Markup source: **ONLY paragraph style names** (not bold/italic/etc.).
- Document content is inside a **table** (important for extraction order and cleanup).
- Must work "quietly" (no Word UI popping up).
- Everyone uses the same Word version (but we still prefer a solution that does not require Word).

## Preferred Architecture

Implement a Windows-only converter utility:

- `word2json.exe` (console app) converts `.docx` -> `.json`.
- Plugin UI adds a button `Load Word…`:
  1) pick `.docx` in file picker
  2) run `word2json.exe` to produce JSON
  3) call existing JSON import pipeline (already tested and stable)

Key decision: **do not launch Word**. Read `.docx` directly via Office Open XML (OpenXML SDK).

Why:
- "Quiet" by design (no Word processes, no dialogs).
- No dependency on macro settings / COM / permissions.
- Better reproducibility across machines.

Fallback (only if needed later): COM Interop with Word, hidden, macros disabled. Not the primary plan.

## Git Strategy (How We Keep main Stable)

- `main` = stable, working plugin.
- Create branch: `feature/word-import` from `main`.
- Implement and debug everything only in the branch on Pavel's Windows laptop.
- Merge to `main` only when:
  - conversion is stable on real docs
  - integration does not break current JSON import
  - optionally gated behind a config flag until IБ approval
- If IБ is not approved yet, keep the branch unmerged (or merge but keep feature disabled).

## Security / IБ Considerations (Planned)

- Do not distribute `word2json.exe` to colleagues until approved.
- In git:
  - commit sources under `tools/word2json/`
  - do NOT commit the compiled `.exe` into `main` (keep binaries out of source control)
- Later (if approved):
  - distribute a signed binary (ideally code signing)
  - provide checksums (SHA256) and a short explanation of what the exe does

## DOCX Parsing Rules (Must Match Current VBA Macro Behavior)

Reference macro used today:
- `/Volumes/work/Titles_Template_NEW2025/work/macros_word-to-JSON.txt`

### Style Names Used (must match exactly)

Meta:
- `TTL`
- `RUBRIC`

Segments:
- `VOICEOVER`
- `SYNC`
- `GEO`

Speakers:
- `SPK_NAME`
- `SPK_ROLE`

Tech (kept in JSON, plugin can ignore for now):
- `TECH_FILE`
- `TECH_TC`

Other:
- `IGNORE` (skip)

### Document traversal order (table-aware)

We must preserve "document order":
- body paragraphs
- tables: `tbl -> tr -> tc -> p` (left-to-right, top-to-bottom)

### Text extraction details

- Remove strikethrough fragments (like VBA `GetParagraphTextWithoutStrikethrough`).
- Clean paragraph/cell end marks:
  - remove CR/LF and tabs
  - remove cell-end marker equivalents (VBA removes `Chr(7)`; in DOCX we must avoid adding the cell end marker into the extracted text)
- Trim and normalize spaces:
  - collapse multiple spaces
  - remove spaces before punctuation `, . ; : ! ?` (same as VBA macro)

### "Glue" markers

- If paragraph text is exactly `"+"` or `"склейка"` (case-insensitive) -> ignore that paragraph, but do NOT flush the open segment (segments will merge naturally).
- Keep support for legacy weird-encoding `"ñêëåéêà"` just in case (present in current macro).

### Segment merge logic (as in VBA)

Maintain an "open segment" (type, speakerId, text) and merge adjacent paragraphs:
- If new paragraph has same `type`:
  - for `voiceover`: always append with a space
  - for `sync`: append only if same `speakerId`; otherwise flush and start a new segment

### Speaker logic

- When `SPK_NAME` encountered:
  - flush open segment
  - create/find speaker with empty role for now
  - set `currentSpeakerId`
- When `SPK_ROLE` encountered:
  - updates current speaker role
  - re-key speaker mapping (name||role)
  - if speaker with same name+role exists, reuse it

### GEO logic

- GEO creates a `geotag` segment immediately (flush open segment first).
- First GEO gets `pin="start"` (only once).

### TECH attachment

- TECH lines attach to the most recently created segment (`lastSegmentId`).
- For each segmentId, store/merge tech fields (`file`, `tc`).
- Plugin: do not change tech usage now, just keep producing it in JSON.

## JSON Output Contract

The generated JSON must match the schema currently used by the plugin (same as `Тест_Разметка.json`):

- `meta: { title, rubric }`
- `speakers: [ { id, name, role }, ... ]`
- `segments: [ { id, type, text, speakerId?, pin? }, ... ]`
- `tech: [ { segmentId, file, tc }, ... ]`

## CLI Contract for word2json.exe

Recommended command shape:

- `word2json.exe "<docxPath>" --out "<outJsonPath>"`

Output:
- stdout: `OK|<outJsonPath>` or `ERR|<message>`
- exit code: `0` for OK, non-zero for ERR

Optional (for debugging on Pavel's laptop only):
- `--log "<logPath>"`

## Plugin Integration Details

- UI: add button `Load Word…` next to `Load JSON`.
- Flow:
  1) pick `.docx`
  2) run converter
  3) on success, call existing "Load JSON" pipeline with the produced json path
- Error handling:
  - if converter fails -> show message with `ERR|...`
  - if JSON import fails -> show existing import errors (unchanged)

## Versioning Guidance

This is a new feature:
- When shipped to colleagues: bump **minor** (e.g. `2.1.0 -> 2.2.0`).
- If merged to `main` but feature is behind a flag and not shipped: version bump can be deferred until rollout.

## Milestones (Implementation Later)

1) Create branch `feature/word-import`.
2) Create `tools/word2json/` skeleton app.
3) Implement DOCX reading + style-name mapping + table traversal.
4) Implement extraction rules (strikethrough removal, glue markers, merge logic).
5) Generate JSON identical to macro output for test docs.
6) Integrate "Load Word…" button and converter invocation.
7) Test on 5-10 real `.docx` files.
8) Decide gating strategy (config flag) until IБ approval.

