# Deployment Guide (Developer View)

## Scope

Текущий режим деплоя: ручной. Этот документ фиксирует контракт установки.

## Manual deployment (current)

1. Подготовь инсталляционный payload:
   - full one-button: `pwsh -NoProfile -File .\scripts\build.ps1`
   - packaging-only: `pwsh -NoProfile -File .\scripts\package.ps1`
2. Скопируй `dist/CaptionPanels/plugin` в каталог плагинов After Effects:
   - пример: `C:\Program Files\Adobe\Adobe After Effects 2024\Support Files\Plug-ins\CaptionPanels`
3. Скопируй `dist/CaptionPanels/tools/*` в `%USERPROFILE%\CaptionPanelsLocal\CaptionPanelTools\...` по принятой раскладке (одна папка на tool).
   - Для `word2json` prefer runtime-каталог: `word2json\runtime\win-x64\self-contained\`.
   - Для обратной совместимости может присутствовать `word2json\word2json.exe` в корне tool-папки.
4. При необходимости используй `dist/CaptionPanels/config.default.json` как baseline для `%APPDATA%\CaptionPanels\config.json`.
5. Проверь конфиг:
   - primary: `%APPDATA%\CaptionPanels\config.json`
   - fallback: `<plugin_root>\config.json`
6. Проверь доступность runtime-корней:
   - `%USERPROFILE%\CaptionPanelsLocal\CaptionPanelTools\...`
   - `%USERPROFILE%\CaptionPanelsLocal\CaptionPanelsData\...`

## Deployment contract

- Единый источник установки: `dist/CaptionPanels`.
- Источник plugin payload: `dist/CaptionPanels/plugin`.
- Источник tool payload: `dist/CaptionPanels/tools`.
- Промежуточные build-папки (например, Visual Studio output) не используются как источник деплоя.
- Ручное копирование из `dist/CaptionPanels` остаётся базовым способом установки.
- Детали структуры tools и future-модели: `docs/dev/tools-layout.md`.

## Future plan (documented only, not implemented)

Планируется `deploy.ps1` (admin-oriented), который будет:
- проверять prerequisites;
- копировать payload в AE Plug-ins;
- валидировать/provision `%USERPROFILE%\CaptionPanelsLocal\...`;
- формировать отчёт о деплое.

Скрипт не реализуется до явного одобрения.
