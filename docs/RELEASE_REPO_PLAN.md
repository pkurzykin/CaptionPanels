# Public release‑repo plan (to revisit later)

## Goal
Keep dev repo private, publish packaged plugin to a public release repo.

## Option A — Full automation (recommended when Windows runner is available)
1) **Create public repo**  
   Example: `pkurzykin/CaptionPanels-Release`

2) **Add secrets in dev repo**  
   Settings → Secrets and variables → Actions  
   - `RELEASE_REPO` = `pkurzykin/CaptionPanels-Release`  
   - `RELEASE_REPO_TOKEN` = PAT with `repo` + `workflow` scopes

3) **Self-hosted Windows runner**  
   Needed to access built `CaptionPanels.aex` on your machine.
   - Runner labels: `self-hosted`, `windows`
   - File path expected by packaging script:  
     `C:\AE\PluginBuild\AEGP\CaptionPanels\CaptionPanels.aex`  
     (or set `AE_PLUGIN_BUILD_DIR`)

4) **Test release**
   ```
   git tag v2.1.1-test
   git push --tags
   ```
   Expect in release repo:
   `releases/v2.1.1-test/CaptionPanels_2.1.1-test_win.zip`

## Option B — No runner (manual .aex in repo)
If `.aex` changes rarely, you can store it in the dev repo and update manually before release.
Pros: no runner needed.  
Cons: repo size grows, risk of stale `.aex`.

## When you’re ready
Tell me which option to use, and I’ll wire the workflow accordingly.
