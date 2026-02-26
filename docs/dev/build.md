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

Рекомендуемый one-button запуск:
- `pwsh -NoProfile -File .\scripts\build.ps1`

Что делает `scripts/build.ps1`:
1. `Release` по умолчанию.
2. Сборка .NET утилит (если есть проект, например `word2json`) с publish в `dist/_build/tools/...`.
3. Сборка AEGP через `msbuild` (если `msbuild` найден).
4. Вызов `scripts/package.ps1` для формирования `dist/CaptionPanels`.

Полезные флаги:
- `-SkipTools` — пропустить сборку tools.
- `-SkipAegp` — пропустить сборку AEGP.
- `-SkipPackage` — пропустить упаковку.
- `-AllowMissingAex` — разрешить упаковку без собранного `.aex`.

Ручной fallback (при необходимости):
1. Открой `aegp_src/CaptionPanels/Win/CaptionPanels.sln`.
2. Проверь `AE_SDK_ROOT`, `WEBVIEW2_SDK`, `AE_PLUGIN_BUILD_DIR`.
3. Собери `Release | x64`.
4. Запусти `pwsh -NoProfile -File .\scripts\package.ps1`.

## Packaging contract

- Инсталляционный источник формируется в `dist/CaptionPanels`.
- Упаковка выполняется через:
  - `scripts/paths.ps1` — единый резолвер путей.
  - `scripts/package.ps1` — укладка deployment-layout.
- `scripts/package.ps1` копирует tools по per-tool каталогам (`word2json`, `transcribe_align`, `deploy`) и, при наличии publish-выхода, добавляет runtime `word2json` в `dist/CaptionPanels/tools/word2json/runtime/win-x64/self-contained`.
- Текущий release helper `scripts/package_release.ps1` остаётся для zip-артефактов CI/release.
- Детальный контракт по tools-layout: `docs/dev/tools-layout.md`.

Команда упаковки:
- `pwsh -NoProfile -File .\scripts\package.ps1`

Результирующая структура:
- `dist/CaptionPanels/plugin/`
- `dist/CaptionPanels/tools/`
- `dist/CaptionPanels/config.default.json`
- `dist/CaptionPanels/BUILDINFO.txt`

## CI status

- CI packaging подключен по отдельному запросу и покрывает проверку packaging-контракта.

## CI packaging

- Workflow: `.github/workflows/ci-package.yml`.
- Триггеры: `pull_request` (если изменяются `scripts/**`, `cep_src/**`, `tools/**`) и `workflow_dispatch`.
- В CI используется:
  - `scripts/build.ps1 -Configuration Release -SkipAegp -AllowMissingAex`
  - проверка обязательного layout в `dist/CaptionPanels`
  - публикация артефакта `CaptionPanels-dist`

Ограничение:
- CI workflow не собирает AEGP (`-SkipAegp`) и валидирует packaging-контракт для `dist/CaptionPanels`.
