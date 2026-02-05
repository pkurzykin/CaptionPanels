# CaptionPanels

AEGP‑плагин для After Effects 2024+ (Windows 10/11) с UI на WebView2 и JSX‑мостом.
Текущая версия: 2.2.0-dev.

## Структура
```
aegp_src/         исходники AEGP (Windows)
cep_src/          UI (HTML/JS) + JSX (host)
aex_bridge/       билд/установка/примечания
legacy_cep/       архив CEP версии
```

## Сборка (Windows)
1) Открой `aegp_src/CaptionPanels/Win/CaptionPanels.sln` (VS 2022, v143).
2) Проверь переменные:
   - `AE_SDK_ROOT` (дефолт задан в .vcxproj)
   - `AE_PLUGIN_BUILD_DIR` (дефолт: `C:\AE\PluginBuild`)
   - `WEBVIEW2_SDK` (NuGet: `C:\Users\<you>\.nuget\packages\microsoft.web.webview2\<version>`)
3) Собери `Release | x64`.

После сборки плагин будет в `AE_PLUGIN_BUILD_DIR\AEGP\CaptionPanels\`.

## Установка
Скопируй папку `CaptionPanels` в:
`C:\Program Files\Adobe\Adobe After Effects 2024\Support Files\Plug-ins\`

## Конфиг (runtime)
Файл `config.json` читается при старте AE. Приоритет поиска:
1) `%APPDATA%\CaptionPanels\config.json` (рекомендуется для смены пути без админ‑прав)
2) `<plugin_root>/config.json`

Ключи:
- `speakersDbPath` — путь к общей базе спикеров
- `enableLogs` — включить диагностические логи (true/false)
- `logsRoot` — кастомная папка для логов (если пусто — AppData)
- `subtitleCharsPerLine` — лимит символов в строке (субтитры), по умолчанию 60

## Логи
При `enableLogs: true` логи пишутся в:
`C:\Users\<you>\AppData\Roaming\CaptionPanels\logs\captionpanels_YYYYMMDD.log`
Если задан `logsRoot`, то логи пишутся в `<logsRoot>\logs\`.

## Документация
Подробности и мост: `aex_bridge/README.md`.
