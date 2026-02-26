# Build Guide (Developer)

## Scope

Документ фиксирует текущий процесс сборки и операционный контракт поставки.

## Prerequisites

- Windows 10/11
- Adobe After Effects 2024+
- Visual Studio 2022 (`v143`, Desktop development with C++)
- After Effects SDK (`AE_SDK_ROOT`)
- WebView2 SDK (`WEBVIEW2_SDK`)
- PowerShell 7+

Note:
- Full production build target is Windows.
- For non-Windows smoke runs via `pwsh`, default `BuildRoot` resolves to a temp path (`.../CaptionPanelsBuild`) unless `-BuildRoot` or `AE_PLUGIN_BUILD_DIR` is provided.
- NuGet client входит в .NET SDK; отдельная установка `nuget.exe` обычно не требуется.

## Build configuration policy

- Конфигурация по умолчанию: `Release`.
- `Debug` использовать только по явному запросу для диагностики.

## Build flow (current)

Preflight-проверка окружения:
- `pwsh -NoProfile -File .\scripts\preflight.ps1`
- Для CI packaging (строгий режим без AEGP-gate): `pwsh -NoProfile -File .\scripts\preflight.ps1 -Strict -SkipAegpChecks`

Рекомендуемый one-button запуск:
- `pwsh -NoProfile -File .\scripts\build.ps1`

Что делает `scripts/build.ps1`:
1. `Release` по умолчанию.
2. Сборка .NET утилит (если есть проект, например `word2json`) с publish в `dist/_build/tools/...`.
3. Сборка AEGP через `msbuild` (если `msbuild` найден).
4. Вызов `scripts/package.ps1` для формирования `dist/CaptionPanels`.

`scripts/build.ps1` использует lock-файл `dist/.build.lock`, чтобы блокировать параллельные build-запуски в одном `dist`.

`scripts/preflight.ps1` проверяет:
- `pwsh`/`dotnet`/`msbuild` наличие,
- чтение NuGet sources,
- базовые env-переменные для AEGP,
- наличие ключевых build/package скриптов,
- доступ на запись в `dist/`.

Примечание:
- Флаг `-SkipAegpChecks` отключает проверки `msbuild`/`AE_SDK_ROOT`/`WEBVIEW2_SDK` и нужен для CI-сценариев, где AEGP-сборка явно пропущена.
- `preflight.ps1`, как и `build.ps1`, при отсутствии внешних переменных использует `DOTNET_CLI_HOME` и `NUGET_PACKAGES` внутри `dist/_build/tools/...`, чтобы не зависеть от прав на user-home.

Для .NET tools-сборки:
- если `DOTNET_CLI_HOME`/`NUGET_PACKAGES` не заданы извне, `build.ps1` направляет их в `dist/_build/tools/...`;
- это уменьшает зависимость от user-home прав на runner/локальной машине.

Полезные флаги:
- `-SkipTools` — пропустить сборку tools.
- `-SkipAegp` — пропустить сборку AEGP.
- `-SkipPackage` — пропустить упаковку.
- `-AllowMissingAex` — разрешить упаковку без собранного `.aex`.
- `-NuGetConfigFile <path>` — использовать явный `NuGet.Config` для `dotnet restore`.
- `-NuGetSource <url>` — указать один или несколько NuGet source URL (флаг можно повторять).

По умолчанию `build.ps1` генерирует/использует локальный `NuGet.Config` в `dist/_build/tools/NuGet.Config`, чтобы не зависеть от недоступного `~/.nuget/NuGet/NuGet.Config`.
Если задан `-NuGetSource`, скрипт генерирует `NuGet.Config` из переданных sources.

Ручной fallback (при необходимости):
1. Открой `aegp_src/CaptionPanels/Win/CaptionPanels.sln`.
2. Проверь `AE_SDK_ROOT`, `WEBVIEW2_SDK`, `AE_PLUGIN_BUILD_DIR`.
3. Собери `Release | x64`.
4. Запусти `pwsh -NoProfile -File .\scripts\package.ps1`.

## Packaging contract

- Инсталляционный источник формируется в `dist/CaptionPanels`.
- Упаковка выполняется через:
  - `scripts/paths.ps1` — единый резолвер путей.
  - `scripts/package.ps1` — укладка deployment-layout.
- `scripts/package.ps1` использует lock-файл `dist/.package.lock`, чтобы блокировать параллельные упаковки одного и того же `dist`.
- `scripts/package.ps1` копирует tools по per-tool каталогам (`word2json`, `transcribe_align`, `deploy`) и, при наличии publish-выхода, добавляет runtime `word2json` в `dist/CaptionPanels/tools/word2json/runtime/win-x64/self-contained`.
- `scripts/package_release.ps1` теперь использует `scripts/package.ps1` как источник layout и архивирует именно `dist/CaptionPanels` в `dist/CaptionPanels_<ver>_win.zip`.
- Release workflow (`.github/workflows/release-package.yml`) перед `package_release.ps1` выполняет `preflight.ps1 -Strict -SkipAegpChecks` и `build.ps1 -Configuration Release -SkipAegp -SkipPackage`, чтобы гарантировать включение tools-runtime в release zip.
- Для release workflow можно задать секрет `RELEASE_NUGET_SOURCES` (URL через `,`/`;`/newline); workflow пробрасывает его в env job и далее как повторяемые `-NuGetSource` в `build.ps1`.
- Детальный контракт по tools-layout: `docs/dev/tools-layout.md`.

Команда упаковки:
- `pwsh -NoProfile -File .\scripts\package.ps1`

Результирующая структура:
- `dist/CaptionPanels/plugin/`
- `dist/CaptionPanels/tools/`
- `dist/CaptionPanels/config.default.json`
- `dist/CaptionPanels/BUILDINFO.txt`

## CI status

- CI packaging подключен по отдельному запросу и покрывает проверку packaging-контракта.

## CI packaging

- Workflow: `.github/workflows/ci-package.yml`.
- Триггеры: `pull_request` (если изменяются `scripts/**`, `cep_src/**`, `tools/**`) и `workflow_dispatch`.
- В CI используется:
  - policy guard: `dist/` не должен содержать tracked-файлы (`git ls-files -- dist` должен быть пустым);
  - `scripts/preflight.ps1 -Strict -SkipAegpChecks`
  - `scripts/build.ps1 -Configuration Release -SkipAegp -AllowMissingAex` (workflow добавляет повторяемые `-NuGetSource` из `workflow_dispatch input ci_nuget_sources`, иначе из `vars.CI_NUGET_SOURCES`)
  - проверка обязательного layout в `dist/CaptionPanels` (включая `tools/word2json/word2json.exe` и runtime overlay)
  - публикация артефакта `CaptionPanels-dist`

Ограничение:
- CI workflow не собирает AEGP (`-SkipAegp`) и валидирует packaging-контракт для `dist/CaptionPanels`.
