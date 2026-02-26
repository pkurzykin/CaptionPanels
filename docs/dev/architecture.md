# CaptionPanels Architecture

## Runtime model

CaptionPanels остаётся Windows-first и должен сохранять следующую архитектуру:
- AEGP C++ plugin (`.aex`) для Adobe After Effects.
- UI на WebView2 (`client/*`).
- JSX host bridge (`host/*`) через AE scripting API.
- Внешние CLI-утилиты (`word2json`, WhisperX runner и др.).

Приоритет загрузки конфига:
1. `%APPDATA%\CaptionPanels\config.json`
2. `<plugin_root>\config.json`

Runtime-каталоги находятся вне репозитория:
- `C:\CaptionPanelsLocal\CaptionPanelTools\...`
- `C:\CaptionPanelsLocal\CaptionPanelsData\...`

## Repository layout

- `aegp_src/` — исходники AEGP и platform-проекты.
- `cep_src/` — слой CEP-исходников (`ui/`, `host/`, `jsx/`, `shared/`).
- `tools/` — исходники внешних утилит и deploy-инструменты.
- `scripts/` — build/package/release-скрипты.
- `docs/` — документация (`user`, `dev`, `spec`).
- `archive/` — архив исторических компонентов, не участвующих в активном runtime/build.
- `dist/` — build output, не source-controlled.

Legacy CEP assets are stored in `archive/legacy_cep`.

Детали по слоям CEP: `docs/dev/cep-structure.md`.
Детали по структуре tools: `docs/dev/tools-layout.md`.

## Packaging and installation contract

- `dist/CaptionPanels` — единый источник установки.
- Plugin payload: `dist/CaptionPanels/plugin`.
- Tools payload: `dist/CaptionPanels/tools`.
- Baseline config: `dist/CaptionPanels/config.default.json`.
- Build metadata: `dist/CaptionPanels/BUILDINFO.txt`.
- Runtime tools/data/logs обслуживаются через `C:\CaptionPanelsLocal\...`.

## Stability constraints

- Без скрытых изменений поведения в config/runtime путях.
- Конфигурация сборки по умолчанию: `Release`.
- Рефакторинг механический, если явно не согласовано иное.
