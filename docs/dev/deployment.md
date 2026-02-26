# Deployment Guide (Developer View)

## Scope

Текущий режим деплоя: ручной. Этот документ фиксирует контракт установки.

## Manual deployment (current)

1. Подготовь инсталляционный payload в `dist/CaptionPanels`.
2. Скопируй payload в каталог плагинов After Effects:
   - пример: `C:\Program Files\Adobe\Adobe After Effects 2024\Support Files\Plug-ins\CaptionPanels`
3. Проверь конфиг:
   - primary: `%APPDATA%\CaptionPanels\config.json`
   - fallback: `<plugin_root>\config.json`
4. Проверь доступность runtime-корней:
   - `C:\CaptionPanelsLocal\CaptionPanelTools\...`
   - `C:\CaptionPanelsLocal\CaptionPanelsData\...`

## Deployment contract

- Единый источник установки: `dist/CaptionPanels`.
- Промежуточные build-папки (например, Visual Studio output) не используются как источник деплоя.
- Ручное копирование из `dist/CaptionPanels` остаётся базовым способом установки.

## Future plan (documented only, not implemented)

Планируется `deploy.ps1` (admin-oriented), который будет:
- проверять prerequisites;
- копировать payload в AE Plug-ins;
- валидировать/provision `C:\CaptionPanelsLocal\...`;
- формировать отчёт о деплое.

Скрипт не реализуется до явного одобрения.
