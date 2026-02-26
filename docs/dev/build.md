# Build Guide (Developer)

## Scope

Документ фиксирует текущий процесс сборки и операционный контракт поставки.

## Prerequisites

- Windows 10/11
- Adobe After Effects 2024+
- Visual Studio 2022 (`v143`, Desktop development with C++)
- After Effects SDK (`AE_SDK_ROOT`)
- WebView2 SDK (`WEBVIEW2_SDK`)
- PowerShell 7+

## Build configuration policy

- Конфигурация по умолчанию: `Release`.
- `Debug` использовать только по явному запросу для диагностики.

## Build flow (current)

1. Открой `aegp_src/CaptionPanels/Win/CaptionPanels.sln`.
2. Проверь переменные:
   - `AE_SDK_ROOT`
   - `WEBVIEW2_SDK`
   - `AE_PLUGIN_BUILD_DIR` (если нужен контролируемый локальный build-output)
3. Собери `Release | x64`.

Промежуточный результат сборки:
- `AE_PLUGIN_BUILD_DIR\AEGP\CaptionPanels\CaptionPanels.aex` (или эквивалент по окружению).

## Packaging contract

- Инсталляционный источник формируется в `dist/CaptionPanels`.
- Упаковка выполняется через:
  - `scripts/paths.ps1` — единый резолвер путей.
  - `scripts/package.ps1` — укладка deployment-layout.
- Текущий release helper `scripts/package_release.ps1` остаётся для zip-артефактов CI/release.

Команда упаковки:
- `pwsh -NoProfile -File .\scripts\package.ps1`

Результирующая структура:
- `dist/CaptionPanels/plugin/`
- `dist/CaptionPanels/tools/`
- `dist/CaptionPanels/config.default.json`
- `dist/CaptionPanels/BUILDINFO.txt`

## Planned next step

- `scripts/build.ps1` — единая точка входа build+package (Release).
