# CaptionPanels Bridge Notes

Краткий технический обзор AEGP/WebView2/JSX-моста для CaptionPanels.

## Операционный контракт

- Источник установки: `dist/CaptionPanels`.
- Деплой: копирование payload из `dist/CaptionPanels` в каталог AE Plug-ins.
- Runtime-каталоги: `C:\CaptionPanelsLocal\CaptionPanelTools\...` и `C:\CaptionPanelsLocal\CaptionPanelsData\...`.
- Приоритет конфига:
  1. `%APPDATA%\CaptionPanels\config.json`
  2. `<plugin_root>\config.json`

Подробные инструкции по сборке и деплою:
- `docs/dev/build.md`
- `docs/dev/deployment.md`
- `docs/CONFIG_REFERENCE.md`

## Протокол сообщений (WebView2)

UI -> Host:
```json
{ "id": "1", "type": "evalScript", "payload": "runJobFromJson(...)", "expectResult": true }
```

Host -> UI:
```json
{ "id": "1", "ok": true, "result": "OK", "error": "" }
```

## Технические примечания

- UI загружается из `client/index.html`.
- JSX entrypoint: `host/index.jsx`.
- Первый вызов инициализирует host-слой через `$.evalFile(<root>/host/index.jsx)`.
- Требуется установленный WebView2 Evergreen Runtime.
