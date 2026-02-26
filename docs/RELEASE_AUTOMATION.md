# Release Automation (private dev → public release)

This repo is the **private dev** source. Releases are published to a **public release repo** as zipped builds.

## One‑time setup

1) **Create a public repo** (example): `pkurzykin/CaptionPanels-Release`.
2) **Create a PAT** (GitHub → Settings → Developer settings → Personal access tokens):
   - Scope: `repo` (write access to the release repo).
3) **Add secrets** to the dev repo:
   - `RELEASE_REPO` = `pkurzykin/CaptionPanels-Release`
   - `RELEASE_REPO_TOKEN` = your PAT
4) **Self‑hosted Windows runner**:
   - Must have AE SDK, Visual Studio build, and access to the built plugin.
   - Runner labels: `self-hosted`, `windows`.
   - Ensure `CaptionPanels.aex` exists at:
     `C:\AE\PluginBuild\AEGP\CaptionPanels\CaptionPanels.aex`
     (or set `AE_PLUGIN_BUILD_DIR` env var on the runner).

## How it works

On `git push --tags` (e.g., `v2.1.0`), the workflow:

1) Runs `scripts/package_release.ps1`
2) Creates `dist/CaptionPanels_<ver>_win.zip`
3) Copies the zip into the public release repo:
   `releases/v<ver>/CaptionPanels_<ver>_win.zip`
   + `sha256.txt`

Install note:
- Release zip is the distributable artifact.
- For deployment, unpack and stage payload as `dist/CaptionPanels` (single installation source).

## Manual packaging (local)

```powershell
.\scripts\package_release.ps1 -Version v2.1.0
```

Output:
`dist\CaptionPanels_2.1.0_win.zip`

## Notes

- The workflow **does not build** the .aex, it only packages it.
- If you want full CI build, add a build step before packaging on the runner.
