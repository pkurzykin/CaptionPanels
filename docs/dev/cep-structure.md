# CEP Layering Structure

Этот документ фиксирует механическую структуру `cep_src` после рефакторинга слоёв.

## Source layout

```text
cep_src/
  ui/        # WebView2 UI assets (html/css/js)
  host/      # Single public UI->host API layer
  jsx/       # ExtendScript host modules and tools
  shared/    # Shipped shared JSON assets
```

## Layer responsibilities

- `ui/`
  - `index.html`, `style.css`, `js/*`.
  - UI-модули не обращаются к bridge напрямую, используют публичный API слой.
- `host/`
  - `public_api.js` — единый публичный API для вызовов host-функций из UI.
  - Базовый контракт: `CPHostAPI.call(fnName, args, opts, cb)`.
- `jsx/`
  - `index.jsx`, `lib/*.jsx`, `tools/*`.
  - Содержит runtime-логику на стороне ExtendScript.
- `shared/`
  - `config.json`, `speakers.json`.
  - Базовые shipped-ресурсы, используемые при упаковке.

## Packaging mapping

Скрипты упаковки сохраняют runtime-контракт плагина без изменений:

- `cep_src/ui` -> `plugin/client`
- `cep_src/jsx` -> `plugin/host`
- `cep_src/host/public_api.js` -> `plugin/host/public_api.js`
- `cep_src/shared/config.json` -> `plugin/config.json` и `dist/CaptionPanels/config.default.json`
- `cep_src/shared/speakers.json` -> `plugin/speakers.json`

## Compatibility note

Рефакторинг слоёв механический:
- runtime-пути в установленном плагине остаются `client/` и `host/`;
- изменения направлены на улучшение структуры исходников и единый API-слой вызовов.
