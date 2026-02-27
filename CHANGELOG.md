# Changelog

## Unreleased
### Added
- Speaker Titles: добавлен режим `solo_title` (чекбокс). В этом режиме используется шаблон `name_title_solo`, а текст из поля «ФИО» подставляется в слой `Job_title`.
- Stage 3.2: добавлены формальные JSON-схемы в `docs/schemas/` (`import`, `blocks`, `alignment`) и справка `docs/SCHEMAS_REFERENCE_RU.md`.
- Spec v1: добавлены базовые контракты в `docs/spec/` (`config.schema.json`, `job.schema.json`, `results.schema.json`) и обновлена спецификационная документация.

### Changed
- Docs: добавлена структурированная иерархия `docs/user`, `docs/dev`, `docs/spec`; добавлены базовые dev-документы (`architecture`, `build`, `deployment`) и обновлены ссылки из `README`.
- Docs audit: README и ключевые dev/deployment документы выровнены под контракт `dist/CaptionPanels -> AE Plug-ins + C:\CaptionPanelsLocal`; удалены устаревшие инструкции по прямому деплою из промежуточных build-папок.
- Repository structure: `legacy_cep` перемещен в `archive/legacy_cep` через `git mv`; добавлен `archive/README.md` и обновлены обзорные ссылки документации.
- Build packaging: добавлены `scripts/paths.ps1` и `scripts/package.ps1`; внедрен reproducible layout `dist/CaptionPanels` (`plugin/`, `tools/`, `config.default.json`, `BUILDINFO.txt`) с идемпотентной упаковкой.
- Build pipeline: добавлен `scripts/build.ps1` как one-button сценарий (по умолчанию `Release`) для сборки tools, сборки AEGP через `msbuild` (если найден) и вызова `scripts/package.ps1`.
- CEP layering: исходники перестроены в `cep_src/{ui,host,jsx,shared}` с механическим переносом через `git mv`; UI переведен на единый публичный API-слой `CPHostAPI`, добавлен `docs/dev/cep-structure.md`, обновлены packaging-paths и документация по новым путям.
- Tools layout: нормализована per-tool упаковка (`word2json`, `transcribe_align`, `deploy`), сборка `word2json` переведена в `dist/_build/tools/...`, добавлен overlay runtime в `dist/CaptionPanels/tools/word2json/runtime/win-x64/self-contained` с сохранением совместимого `word2json.exe` в корне tool-папки и обновлена dev-документация.
- Tools packaging: в `scripts/package.ps1` исключены `bin/` и `x64/` для source-tools, чтобы локальные build-артефакты не протекали в `dist/CaptionPanels/tools`.
- CI packaging: добавлен workflow `.github/workflows/ci-package.yml` для PR/manual-проверки packaging-контракта (`Release`, `-SkipAegp`, `-AllowMissingAex`) и публикации артефакта `CaptionPanels-dist` из `dist/CaptionPanels`.
- Build script: исправлены ошибки запуска в `scripts/build.ps1` для `pwsh` (интерполяция `$LASTEXITCODE` и вызов `package.ps1` через именованный parameter-splat), из-за которых one-button сценарий не отрабатывал корректно.
- Paths/build scripts: `Get-CaptionPanelsBuildRoot` теперь использует Windows-дефолт `C:\AE\PluginBuild` только на Windows, а для non-Windows `pwsh` smoke-run выбирает temp-root (`.../CaptionPanelsBuild`) без обязательного `-BuildRoot`; очистка `dist/CaptionPanels` в `scripts/package.ps1` сделана более устойчивой (retry + fallback move для stale-каталога) при transient ошибках рекурсивного удаления.
- Build tools env: `scripts/build.ps1` теперь по умолчанию направляет `DOTNET_CLI_HOME` и `NUGET_PACKAGES` в `dist/_build/tools/...` (если переменные не заданы), чтобы снизить риск `UnauthorizedAccess` на runner/локальных окружениях.
- Build restore diagnostics: при ошибке `dotnet restore` в `scripts/build.ps1` добавлены явные подсказки по NuGet (`dotnet nuget list source`, проверка feed/proxy) и зафиксировано, что отдельный `nuget.exe` обычно не нужен при наличии .NET SDK.
- Build restore config: `scripts/build.ps1` теперь использует явный `NuGet.Config` для tools-restore (по умолчанию локальный `dist/_build/tools/NuGet.Config`, плюс флаг `-NuGetConfigFile`), чтобы снизить зависимость от user-level `~/.nuget` в ограниченных окружениях.
- Build restore sources: в `scripts/build.ps1` добавлен флаг `-NuGetSource` (поддерживает несколько источников) для генерации локального `NuGet.Config` под корпоративные mirror/feed без ручного редактирования файлов.
- Build concurrency: `scripts/build.ps1` теперь использует lock-файл `dist/.build.lock` (exclusive file lock), чтобы параллельные build-процессы не конфликтовали по `dist` и вложенному packaging.
- Build preflight: добавлен `scripts/preflight.ps1` (окружение/инструменты/env/доступ к `dist`) и обновлена build-документация с preflight-шагом перед one-button сборкой.
- CI preflight: в `.github/workflows/ci-package.yml` добавлен строгий preflight-шаг `scripts/preflight.ps1 -Strict -SkipAegpChecks` перед packaging build, а `preflight.ps1` выровнен с `build.ps1` по dotnet cache-переменным (`DOTNET_CLI_HOME`/`NUGET_PACKAGES` в `dist/_build/tools`), чтобы убрать ложные WARN из-за недоступного user-home.
- CI policy guard: в `ci-package.yml` и `release-package.yml` добавлена проверка, что `dist/` не содержит tracked-файлов (`git ls-files -- dist`), чтобы enforce-ить правило “dist = build output only”.
- Release packaging: `scripts/package_release.ps1` переведен на единый источник layout через `scripts/package.ps1` (zip формируется из `dist/CaptionPanels`), а в `release-package.yml` добавлена проверка структуры release-архива.
- Release workflow: перед packaging добавлены `preflight.ps1 -Strict -SkipAegpChecks` и `build.ps1 -Configuration Release -SkipAegp -SkipPackage`, а verify-step теперь требует `tools/word2json/word2json.exe` и runtime в zip.
- Release .NET setup: в `release-package.yml` добавлен шаг `actions/setup-dotnet@v4` (`8.0.x`) перед preflight/build, чтобы фиксировать версию SDK в release pipeline.
- Release secrets validation: в `release-package.yml` добавлена ранняя проверка обязательных секретов (`RELEASE_REPO`, `RELEASE_REPO_TOKEN`) с fail-fast ошибкой и перевод checkout release repo на job-env переменные.
- Release NuGet sources: в `release-package.yml` добавлен optional env `RELEASE_NUGET_SOURCES` (разделители `,`/`;`/newline), который маппится в повторяемые `-NuGetSource` для `build.ps1` на этапе tools-runtime build.
- Release NuGet wiring: `release-package.yml` теперь явно пробрасывает `secrets.RELEASE_NUGET_SOURCES` в env job, чтобы optional source override реально работал на runner.
- CI packaging verify: в `ci-package.yml` расширен список обязательных путей для `dist/CaptionPanels` — теперь проверяются `tools/word2json/word2json.exe`, `word2json.rules.json` и runtime overlay.
- CI NuGet sources: в `ci-package.yml` добавлен optional env `vars.CI_NUGET_SOURCES` (разделители `,`/`;`/newline), который маппится в повторяемые `-NuGetSource` для `build.ps1` на этапе packaging.
- CI dispatch NuGet override: в `ci-package.yml` добавлен `workflow_dispatch` input `ci_nuget_sources`, который имеет приоритет над `vars.CI_NUGET_SOURCES` для ручного запуска packaging CI.
- CI workflow guardrails: добавлены `concurrency` и `timeout-minutes` в `ci-package.yml` (`35`) и `release-package.yml` (`60`) для снижения риска зависаний и конфликтов параллельных запусков.
- CI workflow permissions: в `ci-package.yml` и `release-package.yml` явно зафиксированы минимальные `permissions` (`contents: read`) по принципу least privilege.
- CI policy script: проверка `dist/` на tracked-файлы вынесена в общий скрипт `scripts/ci/assert-dist-untracked.ps1` и подключена в `ci-package.yml`/`release-package.yml`.
- CI build wrapper: логика формирования аргументов `build.ps1` с NuGet source override вынесена в общий `scripts/ci/invoke-build-with-nuget-sources.ps1` и подключена в `ci-package.yml`/`release-package.yml`.
- Word2Json dependency: в `tools/word2json/src/Word2Json/Word2Json.csproj` добавлен `Newtonsoft.Json` (`13.0.4`) как явная зависимость утилиты.
- Packaging concurrency: `scripts/package.ps1` теперь использует lock-файл `dist/.package.lock` (exclusive file lock), чтобы параллельные упаковки не конфликтовали на очистке/перезаписи `dist/CaptionPanels`.
- Head Topic: генерация снова отвязана от количества geotag; цепочка строится по `Sub_SYNCH_*` (первый старт от плейхеда, далее `start = end(previous synch)`, `end = start(next synch)`), чтобы покрывать весь ролик по утвержденному правилу.
- Branding: после `Create Branding` принудительный пересчет `subtitle_BG` сохраняется (host + fallback), чтобы не терялся после правок логики head_topic.
- Auto Timing: после применения таймингов добавлен более надежный пересчет `subtitle_BG` (с fallback-алгоритмом, если модуль `subtitles.jsx` не подгрузился).
- Head Topic: старт теперь ставится встык к предыдущему geotag (если geotag есть перед группой).
- Head Topic: конец теперь ставится встык к первому `Sub_SYNCH_*` после начала группы (вместо конца `Sub_VOICEOVER`).
- Head Topic: группировка `Sub_VOICEOVER` для head_topic идет по batch (`Sub_VOICEOVER_<batch>_<n>`), чтобы небольшие паузы внутри группы не рвали head_topic.
- Word Import и Auto Timing: внешние процессы запускаются в скрытом режиме (без всплывающего окна консоли).
- UI: добавлено модальное окно прогресса для `Load Word` и `Auto Timing (WhisperX)`.
- Word Import: прогресс запускается после выбора файла (а не до открытия диалога), чтобы не путать пользователя.
- Word Import: исправлен capture exit code в hidden-режиме (`cmd /V:ON` + `!errorlevel!`), чтобы корректно ловить падения конвертера.
- Word Import: перед запуском конвертера DOCX staging в локальную временную папку (ASCII path) для стабильной работы с UNC/кириллицей.
- Word Import: логи (`word2json_last.log`, `word2json_process_last.log`) вынесены в отдельную папку `word2jsonLogsDir` (по умолчанию — общий каталог логов в `C:\CaptionPanelsLocal\CaptionPanelsData\auto_timing\logs`).
- Auto Timing: запуск внешних команд стабилизирован через временный `.cmd`-скрипт (вместо сложного inline `cmd /C`), чтобы исключить повторяющиеся ошибки экранирования кавычек в путях с пробелами/UNC.
- Settings/Auto Timing: добавлен `whisperxDeviceMode` (`auto/cuda/cpu`) с безопасным режимом `auto` (CUDA -> CPU fallback) для адаптации на разных рабочих станциях.
- Speaker Titles: после `Create Title` UI снова сбрасывает контролы в дефолт (`Left`/`Default`/`BG offset 0`, `solo_title` off), в том числе при переходе к следующему спикеру из импортной очереди.
- Runtime paths: стандартизирован единый корень `C:\CaptionPanelsLocal\...` (инструменты в `C:\CaptionPanelsLocal\CaptionPanelTools\`, данные в `C:\CaptionPanelsLocal\CaptionPanelsData\...`), обновлены примеры `config.json`, deploy-документация и fallback-дефолты в host-коде.
- Word Import: усилен резолвер пути к `word2json.exe` — учитывает `word2jsonExePath` и `captionPanelsToolsRoot`, и показывает список проверенных путей в тексте ошибки.
- Auto Timing: усилен резолвер пути к Python (`whisperxPythonPath`) с fallback на `captionPanelsToolsRoot` и диагностикой `Checked:` по проверенным путям.
- Config: порядок поиска `config.json` скорректирован в пользу user-level `%APPDATA%` (Roaming) перед machine-level `ProgramData`, чтобы исключить неожиданный захват старого глобального конфига.
- Config/Runtime: добавлена совместимость со старыми путями (`C:/AE/...`, `CaptionPanelsTools`, `C:/Temp/CaptionPanels/word2json`) — значения автоматически нормализуются к `C:/CaptionPanelsLocal/CaptionPanelsData` и `C:/CaptionPanelsLocal/CaptionPanelTools`.
- Branding: по кнопке `Create Branding` добавлен последовательный запуск (geotag -> head_topic -> пересчет `subtitle_BG`), чтобы `subtitle_BG` обновлялся после расстановки плашек.
- Word Import: по кнопке `Load Word` автоматически выставляется `Work Area End` по длине выбранного/первого видео-слоя в активной композиции.
- UI/Import: добавлена кнопка `Rebuild Subtitles` — пересоздает субтитры из уже загруженного JSON (после смены настроек переноса/лимитов), с очисткой текущих `Sub_VOICEOVER_*`/`Sub_SYNCH_*` и сохранением таймлайн-якоря по первому старому субтитру.
- UI: кнопка `Rebuild Subtitles` перенесена из шапки в раздел `Subtitles / Info` (блок `Subtitles Tools`).
- Docs: удалены устаревшие draft-планы (`AUTO_TIMING_PLAN.md`, `TRANSCRIBE_UTILITY_PLAN.md`, `WORD_IMPORT_PLAN.md`, `RELEASE_REPO_PLAN.md`), добавлен `docs/TROUBLESHOOTING.md`.
- UI Bridge: добавлен helper `callHost(...)` с метаданными `requestId/ts/module/fn` (поэтапный переход с прямых `aeCall` на единый протокол вызовов).
- UI Bridge: все основные UI-модули (`import`, `settings`, `topics`, `speakers`, `speakers_db`, `typography`, `auto_timing`, `branding`, `host_loader`, `subtitles`) переведены на `callHost(...)`; добавлены таймауты вызовов для более предсказуемых ошибок в UI.
- Diagnostics: добавлено окно `Diagnostics` (минимальный экран наблюдаемости) с snapshot текущих путей/существования утилит/последних логов и историей последних host-вызовов (`requestId`, `module`, `fn`, `durationMs`).
- Config: добавлена секционная структура (`speakers/logging/subtitle/paths/asr/transcribe`) в `config.json`; runtime теперь автоматически синхронизирует новые секции со старыми flat-ключами для обратной совместимости.
- Job/Run pipeline (phase 2.1, in progress): добавлен `host/lib/run_registry.jsx` и run-манифесты `run.json` для `word_import` и `auto_timing` в `C:/CaptionPanelsLocal/CaptionPanelsData/runs/...`.
- Diagnostics: добавлен блок `latestRuns` (последний `word_import` / `auto_timing` с `runId/status/stage/path`).
- Auto Timing: в итоговом алерте выводится путь к `runManifest`.
- Auto Timing: добавлена кнопка `Re-run Alignment` (align+apply без повторного ASR), использует артефакты последнего `auto_timing` run (`blocksPath`, `whisperxJson`).
- Branding: пересчет `subtitle_BG` после `Create Branding` усилен fallback-вызовом (raw-script), чтобы избежать тихого пропуска пересчета при сбоях host-вызова.
- Re-run Alignment: теперь выбирает последний завершенный `auto_timing` run с валидными `blocksPath`+`whisperxJson` (а не просто последний run), чтобы не падать после неуспешного прогона.
- Diagnostics: добавлен `latestRuns.autoTimingCompleted` для быстрого контроля, какой run используется для Re-run Alignment.
- ASR/Settings: добавлен флаг `offlineOnly` (`Offline only (no model download)`), который передается в WhisperX runner.
- WhisperX runner: добавлена поддержка `--offline_only` (без сетевых загрузок, только локальный cache моделей) с явными подсказками в тексте ошибок.
- Diagnostics: добавлен блок `deploymentChecks` (быстрая проверка tool/data/cache состояния, включая offline-ready проверки для ASR cache).
- Auto Timing / Re-run Alignment: добавлен автоматический preflight-gate (проверка deployment checks перед запуском; при `FAIL` запуск блокируется с понятным списком причин).
- Auto Timing / Re-run Alignment: после `apply` сохраняется `apply_report.json` в run-папку, путь пишется в `run.json` и выводится в итоговом алерте (для повторяемого дебага по пропускам).
- Diagnostics: `latestRuns.*` теперь показывает ключевые outputs (`blocksPath/whisperxJson/alignmentPath/applyReportPath`) и apply-статистику (`total/applied/missing/...`).
- Deploy: `make_offline_bundle.ps1` расширен (копирование `CaptionPanelsData/models`, генерация `bundle_summary.json`), добавлен `verify_offline_bundle.ps1` для проверки офлайн-бандла перед переносом.
- Roadmap: этап 2 архитектурного плана закрыт (2.2 и 2.3), зафиксированы результаты QA/офлайн-проверок в документации.
- Auto Timing preflight: проверка наличия `word2json.exe` больше не блокирует Auto Timing (для этого шага это не критично).
- Tool path resolver: добавлены legacy fallback-пути для `word2json.exe` и `whisperx` python (`C:/AE/...`) для совместимости со старыми раскладками.
- Runtime validation: импорт JSON и auto-timing теперь явно валидируют payload по схеме до выполнения (ошибки формата не проходят «тихо»).
- Diagnostics: в блоке `latestRuns` теперь показываются outputs/result-метрики (включая `applyReportPath`, `applied/total/missing/...`).
- Diagnostics: при несовпадении `toolsRoot` (например `CaptionPanelTools` vs `CaptionPanelsTools`) больше нет ложного `FAIL` — теперь fallback-корень определяется автоматически, а в snapshot показываются и `toolsRoot`, и `toolsRootConfigured`.
- Auto Timing: резолвер portable `ffmpeg.exe` расширен (`ffmpeg/ffmpeg.exe`, `ffmpeg/bin/ffmpeg.exe`, `ffmpeg.exe`) с учетом fallback-корней tools, чтобы убрать ложные предупреждения в mixed-раскладках.
- Config: приоритет чтения/записи `config.json` возвращен к файлу в папке плагина (`.../ContentPanels/config.json`); AppData теперь используется как fallback.
- Branding: пересчет `subtitle_BG` закреплен в host-логике `applyHeadTopicToRegular` (включая fallback), чтобы пересчет гарантированно выполнялся после `Create Branding`.
- Auto Timing: автоматический пересчет `subtitle_BG` после apply отключен (пересчет остается в сценарии `Create Branding`).
- Diagnostics UI: убрано визуальное дублирование `latestRuns` (если `autoTiming` и `autoTimingCompleted` ссылаются на один run).
- UI: кнопка `Diagnostics` перенесена из верхней шапки в нижнюю мета-зону рядом с версией (compact button).
- subtitle_BG: дефолтный порог разрыва увеличен до `3.0s` (разрыв только если пауза между блоками больше 3 секунд).
- Head Topic: после первого блока (который стартует встык к geotag) следующий `head_topic` стартует от конца предыдущего `Sub_SYNCH`, а конец ставится к старту следующего `Sub_SYNCH` (цепочка без лишних разрывов между VO-участками).
- Geotag: при импорте JSON geotag теперь сохраняет `anchorLayer` (первый слой следующего блока), а при `Create Branding` ставится по текущему `inPoint` этого слоя — поэтому geotag корректно «едет» вместе с блоками после Auto Timing.
- Geotag: улучшена привязка для последующих geotag — по умолчанию якорятся к ближайшему следующему `voiceover`-блоку (а к `sync` только если до следующего geotag нет `voiceover`).
- Head Topic: устранены лишние короткие `head_topic`-слои — создается только валидный интервал между `end(previous synch)` и `start(next synch)`; геотеговый старт учитывается по позиции geotag перед группой.
- Branding (workflow simplification): первый `head_topic` теперь всегда стартует от плейхеда; последующие идут по цепочке `start = end(previous synch)`, `end = start(next synch)` и не зависят от geotag.
- Geotag (workflow simplification): первый geotag ставится по плейхеду, все следующие — последовательно встык (ручная доводка позиции дальше делается на таймлайне); geotag получает label `Brown`.

## v2.4.1 — 2026-02-25

### Fixed
- AE startup race: снижена вероятность ошибки `Unable to execute script ... Can not run a script while a modal dialog is waiting response` (line 0). Добавлен retry в `callHost(...)` для modal-busy ответов.
- UI startup: загрузка host JSX-модулей теперь стартует с небольшой задержкой (`1.2s`), чтобы не попадать в модальные состояния AE в первые секунды запуска.

## v2.3.1 — 2026-02-17

### Changed
- word2json: добавлен внешний файл правил `word2json.rules.json` (styles/merge/geotag cleanup) и CLI-флаг `--rules`, чтобы менять правила парсинга без пересборки утилиты.
- word2json: очистка geotag теперь конфигурируемая; по умолчанию удаляются префиксы вида `гео:`, `геотег:`, `гео-тег:` (в любом регистре).

## v2.3.0 — 2026-02-15

### Added
- Word Import: кнопка «ЗАГРУЗИТЬ WORD» (.docx) + конвертер `tools/word2json` (OpenXML) + импорт через существующий пайплайн JSON.
- Config: `word2jsonExePath`, `word2jsonOutDir`, `topicOptions`.
- Settings: редактирование `speakersDbPath` (путь к базе спикеров) и `topicOptions` (список рубрик) прямо из панели.
- Auto Timing (Phase A): кнопка `Export Blocks…` (выгрузка `blocks_*.json` для утилиты выравнивания) + `autoTimingOutDir`.


### Changed
- UI: убрана кнопка импорта JSON (оставлен Word импорт).
- UI: все подписи кнопок переведены на английский.
- Branding: при «Create Branding» первый geotag ставится по плейхеду, а head_topic — по началу первого блока субтитров.
- Auto Timing: по умолчанию отключен глобальный `whisperxApplyTimeShift` (чтобы не вносить системный сдвиг старта без явной необходимости).
- Auto Timing: применение таймингов нормализуется по кадрам (`start=floor`, `end=ceil`) и вводит минимальный зазор между блоками (`autoTimingMinGapFrames`, default `1`).
- Auto Timing: внутри одной группы `Sub_*_<batch>_<n>` соседние блоки склеиваются встык (без внутреннего зазора); между разными группами/типами сохраняется обычный gap-контроль.

## v2.2.0 — 2026-02-05

### Added
- FixTypography: окно отчета "было/стало" со списком найденных изменений и вариантами применения (исправить все / исправить кроме отмеченного).
- Настройки плагина (шестеренка): параметр `subtitleCharsPerLine` (лимит символов в строке) для новых субтитров.
- Автоупаковка релиза: GitHub Actions workflow (по tag `v*`) + скрипт `scripts/package_release.ps1`.

### Changed
- TRIM: дополнительно подрезает выбранный прекомп-слой в активной композиции (outPoint по плейхеду), чтобы на таймлайне было видно место среза.
- Первый geotag (pin) создается по положению плейхеда; остальные - по таймкодам из JSON.
- Переносы по границам предложений применяются только к 3-й строке субтитров (чтобы не начинать новое предложение 1-2 словами в конце блока).
- head_topic размещается под группой подряд созданных субтитров (лесенка на таймлайне).
- FixTypography: нормализация "странных" тире/дефисов к единому виду (правило дефиса в словах не затрагивается).
- Для geotag и head_topic добавлен fade-out (expression) в Opacity.

### Fixed
- Исправлена нумерация субтитров (двухуровневая): `Sub_VOICEOVER_<block>_<n>` / `Sub_SYNCH_<block>_<n>`.
- subtitle_BG теперь нумеруется как `subtitle_BG_2` и далее (без слова auto).
- В shy отправляются только шаблоны `text_regular` и `text_italic`.
- Автоподстановка спикера: устранено дублирование найденного спикера (не предлагает создать титр дважды).
- FixTypography: названия вида `Транснефть - <слово>` и `Транснефть - <фраза>` не разрываются переносом (включая варианты внутри «елочек»).
- FixTypography: удаляются пробелы в начале строки (после переноса).
- Генерация субтитров сохраняет неразрывные пробелы (NBSP) из FixTypography, чтобы названия вроде `Транснефть - медиа` не переносились.


## v2.1.0 — 2026-02-02

### Added
- Автоподстановка спикера из базы при совпадении ФИО.
- Кнопка Reload для перезагрузки панели без закрытия AE.

### Changed
- subtitle_BG теперь разбивается на сегменты при паузах > 2 секунд.
- После генерации субтитров шаблоны `text_regular`/`text_italic` переводятся в shy и скрываются.

## v2.0.0 — 2026-02-02

### Changed
- Breaking: JSON импорт теперь поддерживает только схему `meta/speakers/segments` (Word‑macro). Старая схема удалена.
- Плашки (geotag/head_topic) больше не создаются автоматически при импорте — заполняются поля и ждут кнопку «Создать плашки». (Временное решение.)
- Head/Topic слои теперь размещаются ниже субтитров и помечаются purple‑лейблом.

### Fixed
- После импорта playhead переводится на первый маркер спикера и сбрасывается кэш маркеров.

## v1.0.0 — 2026-02-01

Кратко: плагин автоматизирует создание субтитров, титров спикеров и инфо‑плашек в After Effects, используя WebView2‑панель и JSX‑скрипты.

### Added
- AEGP‑панель для After Effects 2024+ с UI на WebView2 и JSX‑мостом.
- Единый JSON‑формат ответов между UI и JSX.
- Конфиг runtime с приоритетом `%APPDATA%\CaptionPanels\config.json`.
- Поддержка логов (`enableLogs`, `logsRoot`).
- База спикеров с добавлением/удалением через модальное окно.
- Разбиение UI‑логики на модули для поддержки и масштабирования.

### Fixed
- Декодирование результатов `AEGP_ExecuteScript` (UTF‑16 → UTF‑8).
- Инициализация WebView2 в сложных проектах (повторы/ретраи).
- Ошибки чтения/записи базы спикеров и путей конфигурации.
