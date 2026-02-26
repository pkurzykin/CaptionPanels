# Deployment Guide (Developer View)

## Scope

Текущий режим деплоя: ручной. Этот документ фиксирует контракт установки.

## Manual deployment (current)

1. Подготовь инсталляционный payload:
   - full one-button: `pwsh -NoProfile -File .\scripts\build.ps1`
   - packaging-only: `pwsh -NoProfile -File .\scripts\package.ps1`
2. Скопируй `dist/CaptionPanels/plugin` в каталог плагинов After Effects:
   - пример: `C:\Program Files\Adobe\Adobe After Effects 2024\Support Files\Plug-ins\CaptionPanels`
3. Скопируй `dist/CaptionPanels/tools/*` в `C:\CaptionPanelsLocal\CaptionPanelTools\...` по принятой раскладке.
4. При необходимости используй `dist/CaptionPanels/config.default.json` как baseline для `%APPDATA%\CaptionPanels\config.json`.
5. Проверь конфиг:
   - primary: `%APPDATA%\CaptionPanels\config.json`
   - fallback: `<plugin_root>\config.json`
6. Проверь доступность runtime-корней:
   - `C:\CaptionPanelsLocal\CaptionPanelTools\...`
   - `C:\CaptionPanelsLocal\CaptionPanelsData\...`

## Deployment contract

- Единый источник установки: `dist/CaptionPanels`.
- Источник plugin payload: `dist/CaptionPanels/plugin`.
- Источник tool payload: `dist/CaptionPanels/tools`.
- Промежуточные build-папки (например, Visual Studio output) не используются как источник деплоя.
- Ручное копирование из `dist/CaptionPanels` остаётся базовым способом установки.

## Future plan (documented only, not implemented)

Планируется `deploy.ps1` (admin-oriented), который будет:
- проверять prerequisites;
- копировать payload в AE Plug-ins;
- валидировать/provision `C:\CaptionPanelsLocal\...`;
- формировать отчёт о деплое.

Скрипт не реализуется до явного одобрения.
