# Release Automation (private dev → public release)

This repo is the **private dev** source. Releases are published to a **public release repo** as zipped builds.

## One‑time setup

1) **Create a public repo** (example): `pkurzykin/CaptionPanels-Release`.
   - Ensure the repo has an initialized default branch (for example `main`).
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
   - Workflow first checks for preinstalled `.NET 8 SDK`; if found, it uses local SDK and skips `actions/setup-dotnet`.
   - If `.NET 8 SDK` is not found, workflow installs it via `actions/setup-dotnet@v4` (`8.0.x`).
   - Workflow sets `DOTNET_INSTALL_DIR` to a runner-writable temp path before `setup-dotnet`, so publish does not require write access to `C:\Program Files\dotnet`.
   - Ensure `CaptionPanels.aex` exists at:
     `C:\AE\PluginBuild\AEGP\CaptionPanels\CaptionPanels.aex`
     (or set `AE_PLUGIN_BUILD_DIR` env var on the runner).

## What Is A Self-Hosted Runner (Simple)

`self-hosted runner` is your own machine (or VM) connected to GitHub Actions.

Simple difference:
- GitHub-hosted runner: temporary machine provided by GitHub.
- Self-hosted runner: your permanent machine with your tools already installed.

Why we need it here:
- publish-mode release needs your local environment (AE SDK, Visual Studio toolchain, prebuilt `.aex`, access to private/internal resources if needed).

In practice:
- GitHub sends the job to your runner machine,
- that machine executes workflow steps,
- artifacts/logs go back to GitHub Actions UI.

## How it works

## Release Modes (Simple)

Use `Release dry-run` when you want to **test the release pipeline safely**:
- checks versions and validates workflow logic
- builds and packages release zip
- uploads zip as workflow artifact
- does **not** publish anything to the public release repo

Use `Release publish` when you are ready to **ship a real release**:
- runs the same packaging checks
- additionally checks release repo secrets
- publishes `zip + sha256` to the public release repo (`releases/v<ver>/...`)
- this is the mode that creates the distributable release output for users

Quick decision rule:
- `Not sure / just verifying`: run `dry-run`
- `Ready to publish for users`: run `publish`
- Manual publish safety: set `confirm_publish=PUBLISH`
- Manual publish safety: run manual publish only from `main` branch
- Before real publish, run the full checklist: `docs/RELEASE_FINAL_CHECKLIST.md`
- If workflow fails, see release troubleshooting: `docs/TROUBLESHOOTING.md` (sections 16-21)

The workflow supports two launch modes:

1) Tag push (`on.push.tags`, for example `git push origin v2.4.1`)
2) Manual dispatch (`workflow_dispatch`) with inputs:
   - `release_version` (required, `vMAJOR.MINOR.PATCH`)
   - `dry_run` (default `true`; when enabled, publish to release repo is skipped)
   - `release_nuget_sources` (optional override for NuGet sources)
   - `confirm_publish` (required only when `dry_run=false`; must be `PUBLISH`)

In both modes, the packaging flow is the same:

Guardrails:
- `concurrency` per tag (`release-package-<ref>`)
- `timeout-minutes: 60`
- early validation of required secrets via `scripts/ci/assert-release-secrets.ps1` (publish mode only; skipped in dry-run)
- early validation of release-repo readiness via `scripts/ci/assert-release-repo-ready.ps1` (publish mode only; verifies repo access and default branch)
- early validation of `.aex` presence via `scripts/ci/assert-release-aex-presence.ps1` (publish mode only; skipped in dry-run)
- release commit lineage check via `scripts/ci/assert-release-commit-on-main.ps1` (publish mode only; commit/tag must be in `origin/main` lineage)
  - guard supports shallow checkouts: if history is shallow, script unshallows repo before final lineage check
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
7) Resolves deterministic zip path via `scripts/ci/resolve-release-env.ps1` (`dist/CaptionPanels_<normalized-version>_win.zip`) and uploads it as workflow artifact (`CaptionPanels-release-<version>`)
8) Publishes the zip into the public release repo via `scripts/ci/publish-release-artifact.ps1 -Version $env:RELEASE_VERSION` (publish mode only; skipped in dry-run)
   (target and commit scope: `releases/v<ver>/CaptionPanels_<ver>_win.zip` + `sha256.txt`)
   and fails fast if `release-repo` contains unrelated changes outside `releases/v<ver>`.

Dry-run note:
- `dry_run=true` validates release version/alignment, runs preflight, builds tools runtime, packages zip, verifies layout, and uploads artifact.
- It does **not** checkout or modify the public release repo.
- `dry_run=true` runs on `windows-latest` and packages with `-AllowMissingAex`, so it does not require a prebuilt plugin on a self-hosted runner.
- In dry-run verification, `assert-release-zip-layout.ps1` is executed with `-AllowMissingAex`, so the zip can be validated without `plugin/CaptionPanels.aex`.

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
