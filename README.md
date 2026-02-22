# CaptionPanels

AEGP‑плагин для After Effects 2024+ (Windows 10/11) с UI на WebView2 и JSX‑мостом.
Текущая версия: 2.3.3.

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

Примечание: изменения из окна Settings сохраняются в `%APPDATA%\CaptionPanels\config.json` (файл создается автоматически).

Ключи:
- `speakersDbPath` — путь к общей базе спикеров
- `topicOptions` — список рубрик для TOPIC (выпадающий список), массив строк
- `enableLogs` — включить диагностические логи (true/false)
- `logsRoot` — кастомная папка для логов (если пусто — AppData)
- `subtitleCharsPerLine` — лимит символов в строке (субтитры), по умолчанию 60
- `captionPanelsDataRoot` — единый корень данных плагина (рекомендуется: `C:\CaptionPanelsLocal\CaptionPanelsData`)
- `captionPanelsToolsRoot` — единый корень внешних утилит (рекомендуется: `C:\CaptionPanelsLocal\CaptionPanelTools`)
- `word2jsonExePath` — путь к `word2json.exe` (Word .docx -> .json), рекомендуется: `C:\CaptionPanelsLocal\CaptionPanelTools\word2json\word2json.exe`
- `word2jsonOutDir` — куда сохранять JSON после конвертации, рекомендуется: `C:\CaptionPanelsLocal\CaptionPanelsData\word2json` (если пусто — `captionPanelsDataRoot\word2json`)
- `word2jsonLogsDir` — куда сохранять логи импорта Word, рекомендуется: `C:\CaptionPanelsLocal\CaptionPanelsData\auto_timing\logs` (если пусто — берется `autoTimingLogsDir`, далее fallback в `captionPanelsDataRoot\auto_timing\logs`)
- `autoTimingOutDir` — корневая папка данных Auto Timing (если пусто — `captionPanelsDataRoot\auto_timing`)
- `autoTimingMinGapFrames` — минимальный зазор между соседними блоками разных групп при Auto Timing (в кадрах)
- `whisperxApplyTimeShift` — глобальный time shift (рекомендуется `false`, включать только для диагностики)
- `whisperxDeviceMode` — режим выбора устройства для WhisperX: `auto` (рекомендуется, CUDA с fallback на CPU), `cuda`, `cpu`

## Логи
При `enableLogs: true` логи пишутся в:
`C:\Users\<you>\AppData\Roaming\CaptionPanels\logs\captionpanels_YYYYMMDD.log`
Если задан `logsRoot`, то логи пишутся в `<logsRoot>\logs\`.

## Документация
Подробности и мост: `aex_bridge/README.md`.
