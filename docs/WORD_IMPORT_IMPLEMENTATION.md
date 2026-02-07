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
- Uses **ONLY paragraph style names** to classify content (must match exactly):
  - META: `TTL`, `RUBRIC`
  - SEGMENTS: `VOICEOVER`, `SYNC`, `GEO`
  - SPEAKERS: `SPK_NAME`, `SPK_ROLE`
  - TECH (kept in JSON, plugin can ignore for now): `TECH_FILE`, `TECH_TC`
  - Other: `IGNORE`
- Removes strikethrough fragments.
- Applies the same space/punctuation cleanup logic as the current VBA macro.
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
- `cep_src/ContentPanels/client/index.html`: new button `btn-load-word` ("📄 Load Word").
- `cep_src/ContentPanels/client/js/ui_import.js`: click handler calls host function `importWordFromDialog()`.

Host (JSX):
- `cep_src/ContentPanels/host/lib/word_import.jsx`: implements:
  - `importWordFromDialog()` — shows `.docx` picker.
  - `importWordFromFile(path)` — runs the converter and then calls `importJsonFromFile(outJsonPath)`.

The existing JSON import logic is reused as-is:
- `cep_src/ContentPanels/host/lib/json_import.jsx` (`importJsonFromFile`).

---

## Config (runtime)

Config file priority is unchanged:
1) `%APPDATA%\CaptionPanels\config.json`
2) `<plugin_root>\config.json`

New keys:
- `word2jsonExePath` — path to `word2json.exe`.
  - Recommended: **local path** (not UNC) to avoid Windows policy blocks.
- `word2jsonOutDir` — where to write the generated JSON.
  - If empty: defaults to `%TEMP%\CaptionPanels\word2json`.

Sample config is updated:
- `cep_src/ContentPanels/config.json`

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

- Word import creates/overwrites a debug log file (helps when AE shows an empty error):
  - `word2jsonOutDir/word2json_last.log`
  - If `word2jsonOutDir` is empty, default is `%TEMP%\CaptionPanels\word2json\word2json_last.log`.


- Output JSON file:
  - Written into `word2jsonOutDir/`.
  - File name is based on the `.docx` file name: `<docxBase>_YYYYMMDD_HHMMSS.json`.
  - If the `.docx` file name was URI-encoded (e.g. `%D0%A5...`), it is decoded for readability.


- Error: `word2jsonExePath is not set in config.json`
  - Set `word2jsonExePath` in `%APPDATA%\CaptionPanels\config.json`.

- Error: `word2json.exe not found`
  - Check path and permissions.

- Error: `word2json failed. Output: ...`
  - Run the exact command manually in `cmd` to see the output.
  - Ensure the output folder is writable.

---

## What changed (files)

- `tools/word2json/**` (new)
- `cep_src/ContentPanels/host/lib/word_import.jsx` (new)
- `cep_src/ContentPanels/client/index.html` (add button)
- `cep_src/ContentPanels/client/js/ui_import.js` (wire UI)
- `cep_src/ContentPanels/client/js/main.js` (load host module)
- `cep_src/ContentPanels/config.json` (new keys)
- `README.md`, `aex_bridge/README.md` (document new config keys)
