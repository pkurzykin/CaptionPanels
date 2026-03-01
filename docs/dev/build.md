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
- для `dotnet restore` и `dotnet publish` (`word2json`) включен автоматический retry (по умолчанию `3` попытки с паузой `10s`) на случай transient сетевых ошибок NuGet.

Полезные флаги:
- `-SkipTools` — пропустить сборку tools.
- `-SkipAegp` — пропустить сборку AEGP.
- `-SkipPackage` — пропустить упаковку.
- `-AllowMissingAex` — разрешить упаковку без собранного `.aex`.
- `-NuGetConfigFile <path>` — использовать явный `NuGet.Config` для `dotnet restore`.
- `-NuGetSource <url>` — указать один или несколько NuGet source URL (флаг можно повторять).
- `-DotnetRetryCount <1..10>` — число попыток для `dotnet restore/publish` (default: `3`).
- `-DotnetRetryDelaySeconds <1..120>` — задержка между retry-попытками (default: `10`).

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
- Release workflow поддерживает два режима запуска: `push tags (v*)` и `workflow_dispatch` (`release_version`, `dry_run`, optional `release_nuget_sources`).
- Что такое `self-hosted runner` простыми словами: см. `docs/RELEASE_AUTOMATION.md` (раздел `What Is A Self-Hosted Runner (Simple)`).
- Простое правило:
  - `dry_run=true` — безопасная репетиция релиза (проверка + упаковка + artifact, без публикации в release-repo).
  - publish-режим (`dry_run=false` или tag push) — реальная публикация релиза в release-repo.
  - для ручного publish (`workflow_dispatch` + `dry_run=false`) нужно явное подтверждение: `confirm_publish=PUBLISH`.
  - для ручного publish также требуется запуск из `main`.
  - перед реальным publish проходи финальный чеклист: `docs/RELEASE_FINAL_CHECKLIST.md`.
- Release workflow (`.github/workflows/release-package.yml`) использует `actions/setup-dotnet@v4` (`8.0.x`) и перед `package_release.ps1` выполняет `preflight.ps1 -Strict -SkipAegpChecks` и `scripts/ci/invoke-build-with-nuget-sources.ps1 -BuildConfiguration Release -SkipAegp -SkipPackage`, чтобы гарантировать включение tools-runtime в release zip.
- Перед `actions/setup-dotnet@v4` release workflow выставляет `DOTNET_INSTALL_DIR` в writable temp-каталог runner (`$env:RUNNER_TEMP\dotnet-sdk`), чтобы не требовать прав записи в `C:\Program Files\dotnet` на self-hosted машинах.
- Release workflow сначала проверяет наличие preinstalled `.NET 8 SDK`; если он найден на runner, шаг `setup-dotnet` пропускается, иначе workflow устанавливает `.NET 8` через `actions/setup-dotnet@v4`.
- Release workflow выполняет раннюю валидацию обязательных секретов (`RELEASE_REPO`, `RELEASE_REPO_TOKEN`) через `scripts/ci/assert-release-secrets.ps1` только в publish-режиме (в `dry_run` шаг публикации пропускается).
- Release workflow выполняет раннюю проверку наличия собранного `.aex` через `scripts/ci/assert-release-aex-presence.ps1` только в publish-режиме.
- Release workflow проверяет, что публикуемый commit/tag принадлежит lineage `main`, через `scripts/ci/assert-release-commit-on-main.ps1` (publish-only).
- `assert-release-commit-on-main.ps1` учитывает shallow checkout: при необходимости выполняет `git fetch --unshallow` перед финальной lineage-проверкой.
- В `dry_run` release workflow запускается на `windows-latest` (без self-hosted runner) и вызывает `scripts/package_release.ps1 -AllowMissingAex`.
- В `dry_run` проверка release zip (`scripts/ci/assert-release-zip-layout.ps1`) выполняется с `-AllowMissingAex`.
- Upload release artifact использует вычисленный детерминированный путь (`dist/CaptionPanels_<normalized-version>_win.zip`) через helper `scripts/ci/resolve-release-env.ps1` вместо wildcard.
- Release workflow валидирует release-tag по SemVer через `scripts/ci/assert-release-version.ps1` (ожидается `vMAJOR.MINOR.PATCH`).
- Release workflow проверяет согласованность версии: tag должен совпадать с `UI_VERSION` из `cep_src/ui/js/app_core.js` (`scripts/ci/assert-release-version-alignment.ps1`).
- Проверка структуры `dist/CaptionPanels` централизована в `scripts/ci/assert-dist-layout.ps1`, а проверка структуры release zip — в `scripts/ci/assert-release-zip-layout.ps1`.
- Публикация zip и `sha256.txt` в release-repo централизована в `scripts/ci/publish-release-artifact.ps1` (staging/commit ограничены `releases/v<ver>`, скрипт fail-fast при сторонних изменениях вне целевого release-пути).
- Для release workflow можно задать секрет `RELEASE_NUGET_SOURCES` (URL через `,`/`;`/newline); `workflow_dispatch input release_nuget_sources` имеет приоритет над секретом и пробрасывается в `build.ps1` как повторяемые `-NuGetSource`.
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
- Guardrails: `concurrency` (cancel-in-progress для одного PR/ref) и `timeout-minutes: 35`.
- Security: workflow использует минимальные `permissions` (`contents: read`).
- В CI используется:
  - policy guard: `scripts/ci/assert-dist-untracked.ps1` (проверяет, что `dist/` не содержит tracked-файлы);
  - `scripts/preflight.ps1 -Strict -SkipAegpChecks`
  - проверка release env helper: `scripts/ci/assert-release-env-resolution.ps1`
  - `scripts/ci/invoke-build-with-nuget-sources.ps1 -BuildConfiguration Release -SkipAegp -AllowMissingAex` (wrapper добавляет повторяемые `-NuGetSource` из `workflow_dispatch input ci_nuget_sources`, иначе из `vars.CI_NUGET_SOURCES`)
  - проверка обязательного layout в `dist/CaptionPanels`: `scripts/ci/assert-dist-layout.ps1` (включая `tools/word2json/word2json.exe` и runtime overlay)
  - публикация артефакта `CaptionPanels-dist`

Ограничение:
- CI workflow не собирает AEGP (`-SkipAegp`) и валидирует packaging-контракт для `dist/CaptionPanels`.
