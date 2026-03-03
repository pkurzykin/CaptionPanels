# word2json (DOCX -> JSON)

Windows console utility that converts a styled `.docx` (Word table-based script) into our plugin JSON schema:

- `meta: { title, rubric }`
- `speakers: [ { id, name, role } ]`
- `segments: [ { id, type, text, speakerId?, pin? } ]`
- `tech: [ { segmentId, file, tc } ]`

This tool is designed to work **quietly** (no Word UI, no COM automation). It reads `.docx` directly via Office Open XML.

## Build (Windows)

Requires .NET SDK (recommended: 8.0+).

```bat
cd tools\word2json\src\Word2Json

dotnet restore

dotnet build -c Release
```

Publish

Recommended for colleagues (no .NET installation needed): **self-contained**

```bat
dotnet publish -c Release -r win-x64 --self-contained true
```

Output will be under:
`bin\Release\net8.0\win-x64\publish\`

Dev-only alternative (requires .NET 8 Runtime x64 installed on the machine): framework-dependent

```bat
dotnet publish -c Release -r win-x64 --self-contained false
```

## Usage

```bat
word2json.exe "C:\path\script.docx" --out "C:\path\script.json"
```

Options:
- `--out <path>`: output `.json` path (optional). If omitted, JSON is written next to the `.docx`.
  - Output directory is created automatically if needed.
- `--pretty`: pretty-print JSON (optional).
- `--rules <path>`: path to external parsing rules JSON (optional).
  - If not provided, utility tries `word2json.rules.json` near `word2json.exe`.
  - If file is missing, built-in defaults are used (same behavior as before).

Exit codes:
- `0` success
- `2` bad arguments
- `3` input file not found
- `10` parse error

## Rules file (no rebuild needed)

You can tune parsing without recompiling:

- style names;
- segment merge behavior;
- geotag prefix cleanup.

Template file: `tools/word2json/src/Word2Json/word2json.rules.json`

For production, place a copy next to the executable:
`%USERPROFILE%\CaptionPanelsLocal\CaptionPanelTools\word2json\word2json.rules.json`

Important: geotag cleanup is style-aware and only applies to `GEO` paragraphs.  
Default cleanup strips prefixes like `гео:`, `ГЕОТЕГ:`, `гео-тег -`, `гео тег:` (case-insensitive).

## Notes

- The conversion rules are based on the current VBA macro:
  `/Volumes/work/Titles_Template_NEW2025/work/macros_word-to-JSON.txt`
- By default, style names must match the document exactly (TTL, RUBRIC, VOICEOVER, SYNC, GEO, SPK_NAME, SPK_ROLE, TECH_FILE, TECH_TC, IGNORE).
  - You can remap them via `word2json.rules.json`.

## Deploy (recommended)

For the plugin workflow, keep external tools in a single local folder (easier to deploy and approve by IT/security):

- Copy the `publish/` output to: `%USERPROFILE%\CaptionPanelsLocal\CaptionPanelTools\word2json\`
  - Ensure the main executable is: `%USERPROFILE%\CaptionPanelsLocal\CaptionPanelTools\word2json\word2json.exe`

Then set in the plugin `config.json` (preferably `%APPDATA%\CaptionPanels\config.json`):

- `word2jsonExePath`: `%USERPROFILE%/CaptionPanelsLocal/CaptionPanelTools/word2json/word2json.exe`
- `word2jsonOutDir`: `%USERPROFILE%/CaptionPanelsLocal/CaptionPanelsData/word2json`

The plugin will create the output folder automatically if needed.
