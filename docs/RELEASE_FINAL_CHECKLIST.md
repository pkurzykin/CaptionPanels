# Release Final Checklist

Use this checklist right before a real user-facing release.

## 1) Pre-publish checks

1. Work from `main` and sync with remote:
   - `git checkout main`
   - `git pull --ff-only`
2. Confirm release version format is valid:
   - `vMAJOR.MINOR.PATCH` (example: `v2.2.0`)
3. Confirm `UI_VERSION` equals release version:
   - `cep_src/ui/js/app_core.js` must match the tag version.
4. Confirm self-hosted runner is ready:
   - runner online with labels `self-hosted`, `windows`
   - `CaptionPanels.aex` exists in plugin build path (or `AE_PLUGIN_BUILD_DIR` is set)
5. Confirm GitHub secrets are set in dev repo:
   - `RELEASE_REPO`
   - `RELEASE_REPO_TOKEN`
   - optional `RELEASE_NUGET_SOURCES`
6. Run a dry-run with the same release version first.

## 2) Dry-run gate (must pass before publish)

1. Run `release-package.yml` with:
   - `release_version=vX.Y.Z`
   - `dry_run=true`
2. Expected result:
   - workflow status: success
   - release zip artifact is uploaded
   - no push/commit to release repo

If dry-run fails, fix issues first and do not publish.

## 3) Publish run

1. Run `release-package.yml` with:
   - `release_version=vX.Y.Z`
   - `dry_run=false`
   - `confirm_publish=PUBLISH`
2. Expected result:
   - workflow status: success
   - release repo updated in `releases/vX.Y.Z/`
   - `CaptionPanels_X.Y.Z_win.zip` and `sha256.txt` exist

## 4) Post-publish verification

1. In release repo, check new folder:
   - `releases/vX.Y.Z/`
2. Verify `sha256`:
   - compare local hash of zip with `sha256.txt`.
3. Smoke test:
   - unpack release zip
   - confirm canonical payload exists: `plugin/`, `tools/`, `config.default.json`, `BUILDINFO.txt`
4. Record release note/changelog status for the shipped version.
