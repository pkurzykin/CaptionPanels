# CaptionPanels AEGP (Windows)

Цель: AEGP‑плагин для After Effects 2024+, который открывает панель с WebView2 и выполняет JSX через AEGP_ExecuteScript.
Текущая версия: 1.0.0 (tag `v1.0.0`).

## Структура плагина (финальная установка)
```
CaptionPanels/
  CaptionPanels.aex
  client/            <-- HTML/JS UI (index.html + js)
  host/              <-- JSX (index.jsx + lib/*.jsx)
  speakers.json
  logs/              <-- job_*.json + job_*.log (создаётся)
```

UI загружается из `client/index.html`, JSX выполняется через `host/index.jsx`.

## Протокол сообщений (WebView2)
UI -> Host:
```
{ "id":"1", "type":"evalScript", "payload":"runJobFromJson(...)" , "expectResult":true }
```

Host -> UI:
```
{ "id":"1", "ok":true, "result":"OK", "error":"" }
```

## Сборка (Windows)
1) Открой `aegp_src/CaptionPanels/Win/CaptionPanels.sln` (VS 2022, v143).
2) Проверь пути:
   - `AE_SDK_ROOT` — задаётся в `CaptionPanels.vcxproj` (дефолт: `C:\AE\AfterEffectsSDK_25.6_61_win\ae25.6_61.64bit.AfterEffectsSDK`).
     Можно переопределить через переменную окружения `AE_SDK_ROOT`.
   - `AE_PLUGIN_BUILD_DIR` — дефолт: `C:\AE\PluginBuild` (также можно переопределить переменной окружения).
   - `WEBVIEW2_SDK` — обязательная переменная окружения (NuGet: `C:\Users\<you>\.nuget\packages\microsoft.web.webview2\<version>`).
3) Собери конфигурацию `Release | x64`.

## Установка
1) После сборки готовая структура автоматически создаётся в:
   `AE_PLUGIN_BUILD_DIR\AEGP\CaptionPanels\`
2) Скопируй папку `CaptionPanels` в:
   `C:\Program Files\Adobe\Adobe After Effects 2024\Support Files\Plug-ins\`

## Конфиг (runtime)
Файл `config.json` читается при старте AE. Приоритет поиска:
1) `%APPDATA%\CaptionPanels\config.json` (рекомендуется для смены пути без админ‑прав)
2) `<plugin_root>/config.json`

Ключи:
- `speakersDbPath` — путь к общей базе спикеров
- `enableLogs` — включить диагностические логи (true/false)
- `logsRoot` — кастомная папка для логов (если пусто — AppData)

## Логи
При `enableLogs: true` логи пишутся в:
`C:\Users\<you>\AppData\Roaming\CaptionPanels\logs\captionpanels_YYYYMMDD.log`
Если задан `logsRoot`, то логи пишутся в `<logsRoot>\logs\`.

## Примечания
- При первом сообщении плагин выполняет `$.evalFile(<root>/host/index.jsx)`.
- `bridge.js` автоматически выбирает WebView2 среду.
- Нужен установленный WebView2 Evergreen Runtime.
