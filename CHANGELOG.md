# Changelog

## Unreleased
### Added
- Speaker Titles: добавлен режим `solo_title` (чекбокс). В этом режиме используется шаблон `name_title_solo`, а текст из поля «ФИО» подставляется в слой `Job_title`.

### Changed
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
