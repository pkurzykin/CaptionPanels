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

- Инсталляционный источник должен формироваться в `dist/CaptionPanels`.
- Допустимо использовать текущий helper `scripts/package_release.ps1` для формирования release-артефактов в `dist/`.
- Для деплоя на рабочие машины используется только содержимое `dist/CaptionPanels` (или эквивалент после распаковки release zip).

## Planned script standardization

Планируемые скрипты (в отдельных PR):
- `scripts/paths.ps1` — единый резолвер путей.
- `scripts/package.ps1` — воспроизводимая укладка `dist/CaptionPanels`.
- `scripts/build.ps1` — единая точка входа build+package (Release).
