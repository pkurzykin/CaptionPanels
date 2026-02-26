# CaptionPanels

AEGP‑плагин для Adobe After Effects 2024+ (Windows 10/11) с UI на WebView2 и JSX‑мостом.

## Контракт поставки и запуска

- Единый источник установки: `dist/CaptionPanels`.
- Установка в After Effects: копирование payload из `dist/CaptionPanels/plugin` в `...\Support Files\Plug-ins\CaptionPanels\`.
- Runtime‑каталоги вне репозитория:
  - инструменты: `C:\CaptionPanelsLocal\CaptionPanelTools\...`
  - данные и логи: `C:\CaptionPanelsLocal\CaptionPanelsData\...`

## Минимальные требования для разработки

- Windows 10/11
- Adobe After Effects 2024+
- Visual Studio 2022 (`v143`, workload: Desktop development with C++)
- After Effects SDK (`AE_SDK_ROOT`)
- WebView2 SDK (`WEBVIEW2_SDK`)
- PowerShell 7+

## Структура репозитория

```
aegp_src/       исходники AEGP
cep_src/        UI (HTML/JS) + JSX host
tools/          внешние утилиты и deploy-скрипты
scripts/        build/package/release-скрипты
docs/           пользовательская, dev и spec документация
archive/        архив устаревших компонентов (не runtime)
dist/           build output (не коммитится)
```

## Сборка (Windows, Release по умолчанию)

1. Открой `aegp_src/CaptionPanels/Win/CaptionPanels.sln` (VS 2022, v143).
2. Проверь переменные окружения:
   - `AE_SDK_ROOT`
   - `WEBVIEW2_SDK`
   - `AE_PLUGIN_BUILD_DIR` (если используется локальный build output)
3. Собери `Release | x64`.
4. Подготовь инсталляционный payload:
   - `pwsh -NoProfile -File .\scripts\package.ps1`

Важно: для установки на рабочие машины используем только `dist/CaptionPanels` (включая `plugin/` и `tools/`), а не промежуточные build-папки Visual Studio.

## Runtime config

`config.json` читается в приоритете:
1. `%APPDATA%\CaptionPanels\config.json`
2. `<plugin_root>\config.json`

Изменения из окна Settings сохраняются в `%APPDATA%\CaptionPanels\config.json`.
Подробно по ключам: [docs/CONFIG_REFERENCE.md](docs/CONFIG_REFERENCE.md).

## Документация

- Индекс: [docs/README.md](docs/README.md)
- Dev:
  - [docs/dev/architecture.md](docs/dev/architecture.md)
  - [docs/dev/build.md](docs/dev/build.md)
  - [docs/dev/deployment.md](docs/dev/deployment.md)
- User: [docs/user/README.md](docs/user/README.md)
- Spec: [docs/spec/README.md](docs/spec/README.md)
- Troubleshooting: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
