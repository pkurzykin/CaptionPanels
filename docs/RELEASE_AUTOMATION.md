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
   - `release-package.yml` validates `RELEASE_REPO` and `RELEASE_REPO_TOKEN` early via `scripts/ci/assert-release-secrets.ps1`.
4) **Self‑hosted Windows runner**:
   - Must have AE SDK, Visual Studio build, and access to the built plugin.
   - Runner labels: `self-hosted`, `windows`.
   - .NET SDK is installed in workflow via `actions/setup-dotnet@v4` (`8.0.x`).
   - Ensure `CaptionPanels.aex` exists at:
     `C:\AE\PluginBuild\AEGP\CaptionPanels\CaptionPanels.aex`
     (or set `AE_PLUGIN_BUILD_DIR` env var on the runner).

## How it works

The workflow supports two launch modes:

1) Tag push (`on.push.tags`, for example `git push origin v2.4.1`)
2) Manual dispatch (`workflow_dispatch`) with inputs:
   - `release_version` (required, `vMAJOR.MINOR.PATCH`)
   - `dry_run` (default `true`; when enabled, publish to release repo is skipped)
   - `release_nuget_sources` (optional override for NuGet sources)

In both modes, the packaging flow is the same:

Guardrails:
- `concurrency` per tag (`release-package-<ref>`)
- `timeout-minutes: 60`
- early validation of required secrets via `scripts/ci/assert-release-secrets.ps1` (publish mode only; skipped in dry-run)
- semantic version validation for release tag via `scripts/ci/assert-release-version.ps1` (`vMAJOR.MINOR.PATCH`)
- release version alignment check via `scripts/ci/assert-release-version-alignment.ps1` (tag version must match `UI_VERSION` in `cep_src/ui/js/app_core.js`)
- minimal workflow permissions (`contents: read`)
- policy check via `scripts/ci/assert-dist-untracked.ps1` (`dist/` must be untracked)

1) Runs preflight: `scripts/preflight.ps1 -Strict -SkipAegpChecks`
2) Builds tools runtime via `scripts/ci/invoke-build-with-nuget-sources.ps1 -BuildConfiguration Release -SkipAegp -SkipPackage` (optionally with `-NuGetSource` values from `RELEASE_NUGET_SOURCES`)
3) Runs `scripts/package_release.ps1` (internally runs `scripts/package.ps1`)
4) Builds canonical layout in `dist/CaptionPanels`
5) Creates `dist/CaptionPanels_<ver>_win.zip` from `dist/CaptionPanels`
6) Verifies zip layout via `scripts/ci/assert-release-zip-layout.ps1 -Version $env:RELEASE_VERSION`
7) Uploads zip as workflow artifact (`CaptionPanels-release-<version>`)
8) Publishes the zip into the public release repo via `scripts/ci/publish-release-artifact.ps1 -Version $env:RELEASE_VERSION` (publish mode only; skipped in dry-run)
   (target and commit scope: `releases/v<ver>/CaptionPanels_<ver>_win.zip` + `sha256.txt`)
   and fails fast if `release-repo` contains unrelated changes outside `releases/v<ver>`.

Dry-run note:
- `dry_run=true` validates release version/alignment, runs preflight, builds tools runtime, packages zip, verifies layout, and uploads artifact.
- It does **not** checkout or modify the public release repo.
- `dry_run=true` runs on `windows-latest` and packages with `-AllowMissingAex`, so it does not require a prebuilt plugin on a self-hosted runner.

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
