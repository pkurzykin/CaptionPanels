# CaptionPanels Architecture

## Runtime model

CaptionPanels runtime architecture is Windows-first and must preserve these components:
- AEGP C++ plugin (`.aex`) for Adobe After Effects.
- WebView2-based panel UI (`client/*`).
- JSX host bridge (`host/*`) executed through AE scripting APIs.
- External CLI tools for processing (for example `word2json`, WhisperX helpers).

Config load priority:
1. `%APPDATA%\CaptionPanels\config.json`
2. Plugin root fallback `config.json`

Runtime data is expected outside the repo under `C:\CaptionPanelsLocal\...`.

## Repository layout (current)

- `aegp_src/`: AEGP source and platform projects.
- `cep_src/`: CEP panel UI, JSX host modules, embedded helper scripts.
- `tools/`: external helper tool sources and deployment scripts.
- `scripts/`: packaging/release scripts.
- `docs/`: technical and operational documentation.
- `dist/`: build output only; not source-controlled.

## Packaging and install contract

Target installation contract for modernized flow:
- `dist/CaptionPanels` is the single installation source.
- Plugin payload is copied to After Effects Plug-ins from that folder.
- Runtime tool/data/log roots remain under `C:\CaptionPanelsLocal`.

Current state note:
- Legacy release packaging uses `scripts/package_release.ps1` with a prebuilt `.aex`.
- Standardized build/package scripts are introduced in later PRs.

## Stability constraints

- No silent behavior changes in config resolution or runtime paths.
- Release configuration is default for production builds.
- Mechanical refactors only unless explicitly approved otherwise.
