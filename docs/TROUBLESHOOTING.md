# Troubleshooting (RU)

Короткий справочник по типовым проблемам CaptionPanels.

## 1) `word2json.exe not found`

Проверь в активном конфиге:
- `paths.toolsRoot`
- `paths.word2jsonExePath`

Рекомендуемые значения:
- `paths.toolsRoot = %USERPROFILE%/CaptionPanelsLocal/CaptionPanelTools`
- `paths.word2jsonExePath = %USERPROFILE%/CaptionPanelsLocal/CaptionPanelTools/word2json/word2json.exe`

Если обновил `config.json`, перезагрузи панель (`Reload`), чтобы host перечитал новые пути.

## 2) Word import не видит `.docx` по UNC/кириллице

Симптомы:
- `Input not found` в `word2json_process_last.log`
- кракозябры в пути

Что уже реализовано:
- перед запуском `word2json` входной `.docx` staging-ится в локальный временный путь.

Если проблема осталась:
- проверь доступ к исходному файлу и права на локальный temp;
- проверь, что в AE включено `Allow Scripts to Write Files and Access Network`.

## 3) WhisperX падает из-за кавычек/`cmd`-строки

Симптомы:
- `... is not recognized as an internal or external command`
- `can't open file 'C:\\Program'`

Что уже реализовано:
- запуск внешних команд через временный `.cmd`-скрипт;
- escape аргументов и стабильный сбор exit code.

Если снова появилось:
- приложи два файла из `auto_timing/logs`:
  - `whisperx_runner_*.log`
  - `whisperx_runner_*.out.txt`

## 4) WhisperX не стартует: `Python not found`

Проверь:
- `asr.whisperxPythonPath`
- `paths.toolsRoot`

Рекомендуемо:
- `asr.whisperxPythonPath = %USERPROFILE%/CaptionPanelsLocal/CaptionPanelTools/whisperx/.venv/Scripts/python.exe`

## 5) `ffmpeg` не найден

Проверь:
- `paths.ffmpegExePath`

Рекомендуемо:
- `paths.ffmpegExePath = %USERPROFILE%/CaptionPanelsLocal/CaptionPanelTools/ffmpeg/ffmpeg.exe`

Системный `PATH` менять не нужно.

## 6) После Auto Timing визуально "ломается" `subtitle_BG`

Проверь:
- что применяешь тайминги в активной целевой композиции;
- что в композиции есть базовый слой `subtitle_BG`.

В проекте есть fallback-пересчет `subtitle_BG`, но если исходный BG-слой удален полностью, его нужно восстановить из шаблона.

## 7) JSON после `Load Word` пишется не туда

Проверь:
- активный `config.json` (обычно `%APPDATA%/CaptionPanels/config.json`);
- значение `paths.word2jsonOutDir`.

Рекомендуемо:
- `paths.word2jsonOutDir = %USERPROFILE%/CaptionPanelsLocal/CaptionPanelsData/word2json`

## 8) Общая проверка окружения (Windows)

Минимум:
- AE 2024+
- Доступ к `%USERPROFILE%\CaptionPanelsLocal\CaptionPanelTools\...`
- Доступ к `%USERPROFILE%\CaptionPanelsLocal\CaptionPanelsData\...`
- Для Auto Timing: рабочий Python venv WhisperX + CUDA/CPU режим по конфигу

## 9) `Re-run Alignment` не запускается

Симптом:
- ошибка про отсутствие `blocksPath` или `whisperxJson` в latest completed run.

Проверь:
- сначала выполни полный `Auto Timing (WhisperX)` хотя бы один раз;
- в `Diagnostics` должен появиться `latestRuns.autoTimingCompleted` со статусом `completed`.

## 10) Ошибка WhisperX в offline режиме

Симптом:
- `Transcribe failed ... offline_only=true ... model is not cached locally`
- или `Alignment failed ... offline_only=true ... align model is already cached locally`

Проверь:
- в Settings параметр `Offline only (no model download)`;
- наличие локальных моделей в `%USERPROFILE%/CaptionPanelsLocal/CaptionPanelsData/models`.

Если модели не закэшированы:
- временно отключи `offlineOnly`, запусти Auto Timing один раз с интернетом для прогрева cache;
- затем снова включи `offlineOnly`.

## 11) `Auto Timing preflight failed`

Симптом:
- перед стартом Auto Timing появляется ошибка `preflight failed` со списком `Fix these items`.

Что делать:
- открой `Diagnostics` и проверь `deploymentChecks`;
- исправь пункты уровня `FAIL` (обычно пути к tool/data, отсутствующий `python.exe`/`word2json.exe`, или отсутствие model cache при `offlineOnly=true`);
- если после перехода на `%USERPROFILE%\CaptionPanelsLocal\...` инструменты остались в legacy-папке `C:\CaptionPanelsLocal\...`, запусти миграцию:
  - `pwsh -NoProfile -File .\scripts\dev\migrate-legacy-runtime-to-user-profile.ps1`
- если legacy-папки нет, но есть `dist/CaptionPanels` (или распакованный release bundle), укажи `-PackageRoot`:
  - `pwsh -NoProfile -File .\scripts\dev\migrate-legacy-runtime-to-user-profile.ps1 -PackageRoot .\dist\CaptionPanels`
- проверка без изменений:
  - `pwsh -NoProfile -File .\scripts\dev\migrate-legacy-runtime-to-user-profile.ps1 -DryRun`
- после исправления повтори запуск.

## 12) Как быстро проверить offline bundle перед переносом

Симптом:
- после копирования на рабочий ПК часть утилит/путей не находится.

Что делать:
- на машине подготовки запусти:
  - `powershell -ExecutionPolicy Bypass -File .\tools\deploy\verify_offline_bundle.ps1 -BundleRoot <PATH_TO_BUNDLE> -RequireModelCache`
- исправь все пункты с `FAIL` и только потом переноси bundle.

## 13) `... schema validation failed ...`

Симптом:
- при импорте/автотайминге появляется ошибка вида:
  - `Import JSON schema validation failed`
  - `blocks.json schema validation failed`
  - `alignment.json schema validation failed`

Что делать:
- сверить файл с соответствующей схемой из `docs/schemas/`:
  - `import.schema.json`
  - `blocks.schema.json`
  - `alignment.schema.json`
- исправить обязательные поля (`segId/start/end/type/text`) и повторить запуск.

## 14) `Unable to execute script ... modal dialog is waiting response` (line 0)

Симптом:
- при запуске AE иногда вылетает ошибка про модальный диалог (`line 0`).

Что уже реализовано:
- в UI-мосте добавлен auto-retry для modal-busy ответов (`callHost`), чтобы переживать короткие блокировки AE;
- загрузка host-модулей сдвинута на `~1.2s` после старта панели.

Если проблема повторяется:
- закрой лишние модальные окна AE/плагины при старте;
- нажми `Reload` в панели после полной загрузки проекта;
- приложи `Diagnostics` snapshot + хвост лога `captionpanels_YYYYMMDD.log`.

## 15) `dotnet restore` / `NU1301` при `scripts/build.ps1`

Симптом:
- build падает на `dotnet restore` с ошибками `NU1301` (не удается загрузить индекс сервиса).

Важно:
- отдельный `nuget.exe` обычно не нужен; NuGet client уже входит в .NET SDK.

Проверь:
- доступ к NuGet feed (например `https://api.nuget.org/v3/index.json`);
- proxy/firewall правила на машине;
- список источников:
  - `dotnet nuget list source`
- если user-level `~/.nuget/NuGet/NuGet.Config` недоступен, укажи явный конфиг:
  - `pwsh -NoProfile -File .\scripts\build.ps1 -NuGetConfigFile <path-to-NuGet.Config> ...`
- если нужен корпоративный mirror, передай source прямо в build:
  - `pwsh -NoProfile -File .\scripts\build.ps1 -NuGetSource <mirror-url> ...`

Быстрые команды:
- `dotnet --info`
- `dotnet nuget list source`

## 16) Release workflow: manual publish blocked (`confirm_publish`)

Симптом:
- в `release-package.yml` падение на шаге `Validate manual publish confirmation`.

Причина:
- для ручного publish (`workflow_dispatch` + `dry_run=false`) требуется явное подтверждение.

Что делать:
- в input workflow укажи `confirm_publish=PUBLISH` (в точности, uppercase).

## 17) Release workflow: manual publish blocked (not `main`)

Симптом:
- ошибка `Manual publish is allowed only from main branch`.

Причина:
- ручной publish разрешен только из `main`.

Что делать:
- запускай `workflow_dispatch` из ветки `main`.

## 18) Release workflow: publish blocked (`CaptionPanels.aex` missing)

Симптом:
- ошибка вида `Missing built plugin for publish mode`.

Причина:
- publish-режим требует prebuilt `.aex` на self-hosted runner.

Что делать:
- убедись, что `CaptionPanels.aex` собран и доступен в ожидаемом пути;
- при необходимости задай `AE_PLUGIN_BUILD_DIR` на runner;
- для проверки только pipeline используй `dry_run=true` (он не требует `.aex`).

## 19) Release workflow: lineage check failed (`main`)

Симптом:
- ошибка проверки lineage (commit/tag не в `origin/main`).

Причина:
- publish защищен guard-правилом: релизный commit должен принадлежать истории `main`.

Что делать:
- выпускай релиз только с коммита, который уже в `main`;
- если это tag release, проверь что тег указывает на commit из `main`.

## 20) Release workflow: version checks failed

Симптом:
- ошибка формата версии (`vMAJOR.MINOR.PATCH`) или mismatch с `UI_VERSION`.

Что делать:
- проверь release version/tag формат: `vX.Y.Z`;
- проверь `UI_VERSION` в `cep_src/ui/js/app_core.js` и выровняй с release version.

## 21) Release publish failed on release repo step

Симптом:
- падение на публикации в release repo (`publish-release-artifact.ps1`).

Частые причины:
- не заданы/некорректны секреты `RELEASE_REPO` или `RELEASE_REPO_TOKEN`;
- `RELEASE_REPO` указывает на несуществующий репозиторий или токен не имеет доступа;
- release-repo не инициализирован (нет default branch, например `main`);
- в release-repo есть посторонние незакоммиченные изменения вне `releases/vX.Y.Z`.

Что делать:
- проверь secrets в GitHub repo settings;
- проверь, что release-repo существует и доступен токену;
- если репозиторий новый, создай initial commit и default branch (`main`);
- проверь чистоту release-repo рабочего дерева на runner;
- сначала запусти `dry_run=true`, затем повтори publish.

## 22) `Access denied` при синке в `C:\Program Files\...\Plug-ins\CaptionPanels`

Симптом:
- `sync-plugin.ps1` падает с ошибкой записи в `Program Files`.

Причина:
- обычная user-сессия не имеет прав на запись в `Program Files`.

Рекомендуемое решение:
1. Один раз от администратора зарегистрируй elevated task:
   - `pwsh -NoProfile -File .\scripts\dev\register-elevated-plugin-sync-task.ps1`
2. Синкай в staging и автоматически триггерь task из обычной сессии:
   - `pwsh -NoProfile -File .\scripts\dev\sync-plugin.ps1 -AePluginDir "$env:USERPROFILE\CaptionPanelsLocal\DevPluginSync\plugin" -PostSyncTaskName "CaptionPanels Apply Plugin Sync" -WaitForPostSyncTask`
3. Для постоянной работы:
   - `pwsh -NoProfile -File .\scripts\dev\sync-plugin.ps1 -AePluginDir "$env:USERPROFILE\CaptionPanelsLocal\DevPluginSync\plugin" -Watch -PostSyncTaskName "CaptionPanels Apply Plugin Sync" -WaitForPostSyncTask`
   - рекомендуемый launcher (особенно при запуске из сетевого/UNC пути):
     - `pwsh -NoProfile -File .\scripts\dev\start-plugin-sync-watch.ps1`
   - либо двойным кликом: `scripts\dev\start-plugin-sync-watch.cmd`

Примечание:
- предупреждение `CMD.EXE не поддерживает пути UNC` при запуске `.cmd` из `\\server\share\...` не критично;
- для чистого запуска без этого предупреждения используй PowerShell launcher выше.

Если нужно вручную запустить только elevated-копирование:
- `pwsh -NoProfile -File .\scripts\dev\run-elevated-plugin-sync.ps1 -TaskName "CaptionPanels Apply Plugin Sync" -Wait`

## Где смотреть логи

- Word import:
  - `%USERPROFILE%/CaptionPanelsLocal/CaptionPanelsData/auto_timing/logs/word2json_last.log`
  - `%USERPROFILE%/CaptionPanelsLocal/CaptionPanelsData/auto_timing/logs/word2json_process_last.log`
- Auto timing:
  - `%USERPROFILE%/CaptionPanelsLocal/CaptionPanelsData/auto_timing/logs/whisperx_runner_*.log`
  - `%USERPROFILE%/CaptionPanelsLocal/CaptionPanelsData/auto_timing/logs/align_*.out.txt`
- Run manifests:
  - `%USERPROFILE%/CaptionPanelsLocal/CaptionPanelsData/runs/word_import/<runId>/run.json`
  - `%USERPROFILE%/CaptionPanelsLocal/CaptionPanelsData/runs/auto_timing/<runId>/run.json`
