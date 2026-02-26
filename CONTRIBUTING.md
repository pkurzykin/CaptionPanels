# Contributing to CaptionPanels

## Branch naming
Use one of:
- `feature/*`
- `fix/*`
- `chore/*`
- `refactor/*`
- `docs/*`
- `build/*`
- `ci/*`

## PR rules
- One logical theme per PR.
- No breaking changes without explicit approval.
- No permanent deletions: move to `archive/` with `git mv`.
- Keep `dist/` as build output only; do not commit runtime artifacts.
- If you change build flow, folder structure, config contracts, or runtime paths, update docs in the same PR.

## Development prerequisites (minimum)
- Windows 10/11.
- Adobe After Effects 2024+.
- Visual Studio 2022 with C++ toolchain (`v143`).
- After Effects SDK (set via `AE_SDK_ROOT` or project defaults).
- WebView2 SDK (NuGet path in `WEBVIEW2_SDK`).
- PowerShell 7+ for packaging scripts.

## PR completion checklist
1. Working tree is clean except intended changes.
2. Changes are scoped to one theme.
3. Related docs are updated.
4. PR description includes:
   - short summary (what + why)
   - verification checklist (commands + expected result)
   - risk notes
