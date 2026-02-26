# Deployment Guide (Developer View)

## Scope

Deployment mode today is manual. This document fixes the deployment contract for engineers and release owners.

## Manual deployment (current)

1. Prepare a plugin package payload (current helper: `scripts/package_release.ps1` for zip artifacts).
2. Extract/copy plugin folder `CaptionPanels` to After Effects Plug-ins directory on target machine:
   - Example: `C:\Program Files\Adobe\Adobe After Effects 2024\Support Files\Plug-ins\CaptionPanels`
3. Ensure runtime config exists as needed:
   - Primary: `%APPDATA%\CaptionPanels\config.json`
   - Fallback: `<plugin_root>\config.json`
4. Verify external tools/data roots under `C:\CaptionPanelsLocal\...` are available for the deployed environment.

## Deployment contract (target)

- `dist/CaptionPanels` must be the single source of truth for installation artifacts.
- Package content is expected to include plugin payload and required runtime tool/config assets.
- Manual copy from `dist/CaptionPanels` remains the default deployment operation.

## Future plan (documented only, not implemented)

- Introduce an admin-oriented deployment script `deploy.ps1`.
- Script responsibilities (planned):
  - validate prerequisites
  - copy plugin payload to AE Plug-ins path
  - provision runtime roots under `C:\CaptionPanelsLocal`
  - emit deployment report/log

This plan is intentionally documented here and must not be implemented until explicitly approved.
