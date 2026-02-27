# Release Automation (private dev → public release)

This repo is the **private dev** source. Releases are published to a **public release repo** as zipped builds.

## One‑time setup

1) **Create a public repo** (example): `pkurzykin/CaptionPanels-Release`.
2) **Create a PAT** (GitHub → Settings → Developer settings → Personal access tokens):
   - Scope: `repo` (write access to the release repo).
3) **Add secrets** to the dev repo:
   - `RELEASE_REPO` = `pkurzykin/CaptionPanels-Release`
   - `RELEASE_REPO_TOKEN` = your PAT
   - Optional for corporate/offline mirrors: `RELEASE_NUGET_SOURCES` = one or more NuGet URLs (separator: comma, semicolon, or newline).
   - `release-package.yml` reads `RELEASE_NUGET_SOURCES` directly from GitHub Secrets and passes it to the tools-build step.
   - `release-package.yml` validates `RELEASE_REPO` and `RELEASE_REPO_TOKEN` early and fails fast with explicit error if they are missing.
4) **Self‑hosted Windows runner**:
   - Must have AE SDK, Visual Studio build, and access to the built plugin.
   - Runner labels: `self-hosted`, `windows`.
   - .NET SDK is installed in workflow via `actions/setup-dotnet@v4` (`8.0.x`).
   - Ensure `CaptionPanels.aex` exists at:
     `C:\AE\PluginBuild\AEGP\CaptionPanels\CaptionPanels.aex`
     (or set `AE_PLUGIN_BUILD_DIR` env var on the runner).

## How it works

On `git push --tags` (e.g., `v2.1.0`), the workflow:

Guardrails:
- `concurrency` per tag (`release-package-<ref>`)
- `timeout-minutes: 60`
- early validation of required secrets (`RELEASE_REPO`, `RELEASE_REPO_TOKEN`)
- minimal workflow permissions (`contents: read`)

1) Runs preflight: `scripts/preflight.ps1 -Strict -SkipAegpChecks`
2) Builds tools runtime: `scripts/build.ps1 -Configuration Release -SkipAegp -SkipPackage` (optionally with `-NuGetSource` values from `RELEASE_NUGET_SOURCES`)
3) Runs `scripts/package_release.ps1` (internally runs `scripts/package.ps1`)
4) Builds canonical layout in `dist/CaptionPanels`
5) Creates `dist/CaptionPanels_<ver>_win.zip` from `dist/CaptionPanels`
6) Verifies zip layout (`plugin/`, `tools/`, `config.default.json`, `BUILDINFO.txt`, `tools/word2json/word2json.exe`)
7) Copies the zip into the public release repo:
   `releases/v<ver>/CaptionPanels_<ver>_win.zip`
   + `sha256.txt`

Install note:
- Release zip is the distributable artifact.
- Zip root equals `dist/CaptionPanels` payload (`plugin/`, `tools/`, `config.default.json`, `BUILDINFO.txt`).
- For deployment, unpack zip content into `dist/CaptionPanels` target on destination machine.

## Manual packaging (local)

```powershell
.\scripts\package_release.ps1 -Version v2.1.0
```

Output:
`dist\CaptionPanels_2.1.0_win.zip`

## Notes

- The workflow **does not build** the .aex, it packages an already built plugin via `scripts/package.ps1`.
- The workflow **does build tools runtime** (`word2json` publish) before packaging to keep release payload deterministic.
- If you want full CI build, add a build step before packaging on the runner.
