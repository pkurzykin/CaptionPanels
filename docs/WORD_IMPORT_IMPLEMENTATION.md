# Word Import (DOCX -> JSON) — Implementation Notes

Status: **implemented on branch** `feature/word-import` (not merged to `main` yet).

Goal: in the plugin UI select a `.docx`, automatically convert it to our JSON schema and run the existing JSON import pipeline.

---

## Components

### 1) Converter utility: `word2json`

Source:
- `tools/word2json/`

Tech:
- Windows console app (C#)
- Target: `net8.0`
- Library: OpenXML SDK (`DocumentFormat.OpenXml`)

What it does:
- Reads `.docx` **directly** (Office Open XML). **Does not start Word**.
- Traverses content in document order, **table-aware**: `tbl -> tr -> tc -> p`.
- Uses paragraph style names to classify content. By default:
  - META: `TTL`, `RUBRIC`
  - SEGMENTS: `VOICEOVER`, `SYNC`, `GEO`
  - SPEAKERS: `SPK_NAME`, `SPK_ROLE`
  - TECH (kept in JSON, plugin can ignore for now): `TECH_FILE`, `TECH_TC`
  - Other: `IGNORE`
- Rules can now be overridden without rebuild via `word2json.rules.json` (next to `word2json.exe`) or `--rules <path>`.
- Removes strikethrough fragments.
- Applies the same space/punctuation cleanup logic as the current VBA macro.
- Geotag cleanup supports configurable prefix stripping (e.g. `гео:`, `геотег:`, `гео-тег:`).
- Outputs JSON in the plugin schema:
  - `meta: { title, rubric }`
  - `speakers: [...]`
  - `segments: [...]`
  - `tech: [...]`

Build & publish:
- See `tools/word2json/README.md`.
- Recommended for colleagues: `dotnet publish ... --self-contained true` (portable folder).

### 2) Plugin integration (AE side)

UI:
- `cep_src/ui/index.html`: new button `btn-load-word` ("📄 Load Word").
- `cep_src/ui/js/ui_import.js`: click handler calls host function `importWordFromDialog()`.

Host (JSX):
- `cep_src/jsx/lib/word_import.jsx`: implements:
  - `importWordFromDialog()` — shows `.docx` picker.
  - `importWordFromFile(path)` — runs the converter and then calls `importJsonFromFile(outJsonPath)`.

The existing JSON import logic is reused as-is:
- `cep_src/jsx/lib/json_import.jsx` (`importJsonFromFile`).

---

## Config (runtime)

Config file priority is unchanged:
1) `%APPDATA%\CaptionPanels\config.json`
2) `<plugin_root>\config.json`

New keys:
- `paths.dataRoot` — unified data root (recommended: `%USERPROFILE%\CaptionPanelsLocal\CaptionPanelsData`).
- `paths.toolsRoot` — unified tools root (recommended: `%USERPROFILE%\CaptionPanelsLocal\CaptionPanelTools`).
- `paths.word2jsonExePath` — path to `word2json.exe`.
  - Recommended: **local path** (not UNC) to avoid Windows policy blocks.
  - Recommended location: `%USERPROFILE%\CaptionPanelsLocal\CaptionPanelTools\word2json\word2json.exe`.
- `paths.word2jsonOutDir` — where to write the generated JSON.
  - Recommended: `%USERPROFILE%\CaptionPanelsLocal\CaptionPanelsData\word2json`.
  - If empty: defaults to `paths.dataRoot\word2json`.


Sample config is updated:
- `cep_src/shared/config.json`

---

## Security / IБ Notes (plain language)

- The plugin calls an external converter **only** when the user presses “Load Word”.
- The converter does **not**:
  - запускать Word
  - запускать VBA макросы
  - обращаться в интернет
  - отправлять данные наружу
- It only:
  1) reads the selected `.docx`
  2) writes a `.json` file into the configured output folder

Common enterprise restrictions to consider:
- Running `.exe` from a network share (UNC path) can be blocked.
- Some systems restrict launching child processes from After Effects.

Mitigations:
- Use self-contained portable folder.
- Place `word2json.exe` locally.
- Keep a manual fallback: run `word2json.exe` by hand to produce JSON. (UI-кнопка импорта JSON сейчас намеренно убрана; при необходимости импорт можно выполнить через внутреннюю функцию `importJsonFromFile(path)`.)

---

## Troubleshooting

- AE setting required (once per machine):
  - `Edit > Preferences > Scripting & Expressions > Allow Scripts to Write Files and Access Network`
  - Without it, `system.callSystem()` can fail with `Permission denied`.

- Word import creates/overwrites debug log files (helps when AE shows an empty error):
  - `paths.word2jsonLogsDir/word2json_last.log`
  - `paths.word2jsonLogsDir/word2json_process_last.log`
  - If `paths.word2jsonLogsDir` is empty: `paths.autoTimingLogsDir`, then `paths.dataRoot\auto_timing\logs`, then `paths.word2jsonOutDir`.


- Output JSON file:
  - Written into `paths.word2jsonOutDir/`.
  - File name is based on the `.docx` file name: `<docxBase>_YYYYMMDD_HHMMSS.json`.
  - If the `.docx` file name was URI-encoded (e.g. `%D0%A5...`), it is decoded for readability.


- Error: `paths.word2jsonExePath is not set in config.json`
  - Set `paths.word2jsonExePath` in `%APPDATA%\CaptionPanels\config.json`.

- Error: `word2json.exe not found`
  - Check path and permissions.

- Error: `word2json failed. Output: ...`
  - Run the exact command manually in `cmd` to see the output.
  - Ensure the output folder is writable.

---

## What changed (files)

- `tools/word2json/**` (new)
- `cep_src/jsx/lib/word_import.jsx` (new)
- `cep_src/ui/index.html` (add button)
- `cep_src/ui/js/ui_import.js` (wire UI)
- `cep_src/ui/js/main.js` (load host module)
- `cep_src/shared/config.json` (new keys)
- `README.md`, `docs/CONFIG_REFERENCE.md` (document new config keys)
