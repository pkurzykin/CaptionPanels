# Build Guide (Developer)

## Scope

This document describes the current build flow and the target standardized build contract.

## Prerequisites

- Windows 10/11
- Adobe After Effects 2024+
- Visual Studio 2022 with C++ toolchain (`v143`)
- After Effects SDK (`AE_SDK_ROOT`)
- WebView2 SDK (`WEBVIEW2_SDK`)
- PowerShell 7+

## Default build configuration

- Default configuration is `Release`.
- Use `Debug` only when explicitly required for diagnostics.

## Current build flow

1. Open `aegp_src/CaptionPanels/Win/CaptionPanels.sln`.
2. Ensure env variables are resolved:
   - `AE_SDK_ROOT`
   - `AE_PLUGIN_BUILD_DIR` (default `C:\AE\PluginBuild`)
   - `WEBVIEW2_SDK`
3. Build `Release | x64`.

Expected output:
- `AE_PLUGIN_BUILD_DIR\AEGP\CaptionPanels\CaptionPanels.aex`

Current release packaging helper:
- `scripts/package_release.ps1` packages an already built plugin into a zip under `dist/`.

## Target standardized build contract

Planned in dedicated build PRs:
- `scripts/paths.ps1`: central path resolver.
- `scripts/package.ps1`: creates reproducible `dist/CaptionPanels` layout.
- `scripts/build.ps1`: one-button Release build and packaging entrypoint.

Contract:
- `dist/CaptionPanels` is the single source used for manual installation.
