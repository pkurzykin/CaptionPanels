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

Publish (portable folder):

```bat
dotnet publish -c Release -r win-x64 --self-contained false
```

Output will be under:
`bin\Release
et6.0\win-x64\publish\`

## Usage

```bat
word2json.exe "C:\path\script.docx" --out "C:\path\script.json"
```

Options:
- `--out <path>`: output `.json` path (optional). If omitted, JSON is written next to the `.docx`.
- `--pretty`: pretty-print JSON (optional).

Exit codes:
- `0` success
- `2` bad arguments
- `3` input file not found
- `10` parse error

## Notes

- The conversion rules are based on the current VBA macro:
  `/Volumes/work/Titles_Template_NEW2025/work/macros_word-to-JSON.txt`
- Style names must match the document exactly (TTL, RUBRIC, VOICEOVER, SYNC, GEO, SPK_NAME, SPK_ROLE, TECH_FILE, TECH_TC, IGNORE).
