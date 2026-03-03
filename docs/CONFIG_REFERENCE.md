# Config Reference (CaptionPanels)

Дата: 2026-02-25

Этот документ описывает `config.json`, который управляет путями, настройками субтитров, базой спикеров и пайплайном Auto Timing.

## Где лежит config.json и какой приоритет
Плагин ищет конфиг в нескольких местах (первый найденный используется как «primary»):
1) `%APPDATA%\CaptionPanels\config.json` (Windows Roaming)
2) `%USERPROFILE%\AppData\Roaming\CaptionPanels\config.json` (обычно то же самое, что `%APPDATA%`)
3) (запасной вариант) `%USERPROFILE%\AppData\Roaming\Adobe\After Effects\<version>\CaptionPanels\config.json` (зависит от того, чему равен `Folder.userData` в ExtendScript)
4) `<plugin_root>\config.json` (внутри папки установленного плагина)

Важно:
- При чтении конфиг **мерджится**: «shipped config» (из `<plugin_root>\config.json`) + «primary config» (из AppData). Ключи из AppData **перекрывают** shipped.
- Окно **Settings** сохраняет изменения **всегда** в `%APPDATA%\CaptionPanels\config.json` (файл и папка создаются автоматически).

## Формат
- JSON, кодировка UTF‑8.
- Для путей рекомендуем использовать `/` (слеш), т.к. плагин нормализует `\` -> `/`.
- Начиная с roadmap-phase1.3, конфиг хранится в секциях:
  - `speakers`
  - `logging`
  - `subtitle`
  - `paths`
  - `asr`
  - `transcribe`
- Legacy flat-ключи (`word2jsonExePath`, `whisperxModel`, `subtitleCharsPerLine` и т.д.) всё еще поддерживаются runtime-слоем для обратной совместимости.

## Рекомендуемые базовые каталоги (стандарт деплоя)
Чтобы на рабочих ПК всё было предсказуемо и не требовало прав администратора / правки `PATH`:
- Данные/артефакты: `%USERPROFILE%\CaptionPanelsLocal\CaptionPanelsData\...`
- Внешние утилиты: `%USERPROFILE%\CaptionPanelsLocal\CaptionPanelTools\...`
- Run manifests (pipeline): `%USERPROFILE%\CaptionPanelsLocal\CaptionPanelsData\runs\<kind>\<runId>\run.json`

## Ключи (reference, секционный формат)

### `speakers`
- `speakers.dbPath` (string)
  - Путь к общей базе спикеров `speakers.json`.
  - Может быть абсолютным (`H:/.../speakers.json`, `C:/.../speakers.json`) или относительным (тогда считается относительно папки конфига).
- `speakers.topicOptions` (array of string)
  - Список рубрик для TOPIC (выпадающий список), редактируется в Settings.

### `logging`
- `logging.enable` (boolean) — включает диагностические логи.
- `logging.root` (string) — кастомная папка логов, если пусто используется AppData.

### `subtitle`
- `subtitle.charsPerLine` (number)
  - Лимит символов в строке при нарезке субтитров, guardrails: 20..200.
- `subtitle.shortWordMaxLen` (number)
  - Длина "короткого слова", которое нельзя оставлять в конце строки.
  - Диапазон: 1..10, дефолт: `3`.
- `subtitle.bgGapSec` (number)
  - Порог разрыва для `subtitle_BG`, дефолт: `3.0`.

### `paths`
- `paths.dataRoot` (string) — корень данных/артефактов, напр. `%USERPROFILE%/CaptionPanelsLocal/CaptionPanelsData`.
- `paths.toolsRoot` (string) — корень утилит, напр. `%USERPROFILE%/CaptionPanelsLocal/CaptionPanelTools`.
- `paths.word2jsonExePath` (string) — путь к `word2json.exe`.
- `paths.word2jsonOutDir` (string) — куда писать JSON после Word import.
- `paths.word2jsonLogsDir` (string) — где хранить `word2json_*` логи.
- `paths.autoTimingOutDir` (string) — legacy-совместимость для общего корня Auto Timing.
- `paths.autoTimingBlocksDir` / `paths.autoTimingWhisperXDir` / `paths.autoTimingAlignmentDir` / `paths.autoTimingLogsDir`
  - специализированные папки run-артефактов Auto Timing.
- `paths.ffmpegExePath` (string) — путь к `ffmpeg.exe` (portable, без PATH).

### `asr`
- `asr.whisperxPythonPath` (string) — Python из venv WhisperX.
- `asr.runnerScriptPath` (string) — путь к `run_whisperx.py`.
- `asr.model` / `asr.language` / `asr.deviceMode` / `asr.device` / `asr.vadMethod`
  - базовые параметры запуска WhisperX.
- `asr.offlineOnly` (boolean)
  - если `true`, runner запрещает сетевые скачивания моделей и использует только локальный cache.
  - если нужной модели нет локально — запуск завершится ошибкой с подсказкой.
- `asr.applyTimeShift` (boolean)
  - включает экспериментальный глобальный time-shift.
- `asr.minGapFrames` (number)
  - минимальный зазор между соседними блоками после Auto Timing.
- `asr.advancedArgsEnabled` (boolean)
  - включает расширенные decode-параметры.
- `asr.beamSize` / `asr.temperature` / `asr.noSpeechThreshold` / `asr.logprobThreshold` / `asr.conditionOnPreviousText`
  - параметры advanced decode.
- `asr.extraArgs` (string)
  - raw аргументы для ручного расширения запуска.

### `transcribe`
- `transcribe.alignScriptPath` (string)
  - путь к `transcribe_align.py` (обычно `host/tools/transcribe_align/transcribe_align.py`).

## Пример рекомендуемого конфига (AppData)
Файл: `%APPDATA%\CaptionPanels\config.json`

```json
{
  "speakers": {
    "dbPath": "H:/Media/Kurzykin/PROJECT/Titles_Template_NEW2025/work/json/speakers.json",
    "topicOptions": ["Новости", "Специальный репортаж", "Спорт"]
  },
  "subtitle": {
    "charsPerLine": 60,
    "shortWordMaxLen": 3,
    "bgGapSec": 3.0
  },
  "paths": {
    "dataRoot": "%USERPROFILE%/CaptionPanelsLocal/CaptionPanelsData",
    "toolsRoot": "%USERPROFILE%/CaptionPanelsLocal/CaptionPanelTools",
    "word2jsonExePath": "%USERPROFILE%/CaptionPanelsLocal/CaptionPanelTools/word2json/word2json.exe",
    "word2jsonOutDir": "%USERPROFILE%/CaptionPanelsLocal/CaptionPanelsData/word2json",
    "word2jsonLogsDir": "%USERPROFILE%/CaptionPanelsLocal/CaptionPanelsData/auto_timing/logs",
    "autoTimingBlocksDir": "%USERPROFILE%/CaptionPanelsLocal/CaptionPanelsData/auto_timing/blocks",
    "autoTimingWhisperXDir": "%USERPROFILE%/CaptionPanelsLocal/CaptionPanelsData/auto_timing/whisperx",
    "autoTimingAlignmentDir": "%USERPROFILE%/CaptionPanelsLocal/CaptionPanelsData/auto_timing/alignment",
    "autoTimingLogsDir": "%USERPROFILE%/CaptionPanelsLocal/CaptionPanelsData/auto_timing/logs",
    "ffmpegExePath": "%USERPROFILE%/CaptionPanelsLocal/CaptionPanelTools/ffmpeg/ffmpeg.exe"
  },
  "asr": {
    "whisperxPythonPath": "%USERPROFILE%/CaptionPanelsLocal/CaptionPanelTools/whisperx/.venv/Scripts/python.exe",
    "runnerScriptPath": "host/tools/whisperx_runner/run_whisperx.py",
    "model": "medium",
    "language": "ru",
    "deviceMode": "auto",
    "device": "cuda",
    "vadMethod": "silero",
    "offlineOnly": false,
    "applyTimeShift": false,
    "minGapFrames": 1,
    "advancedArgsEnabled": false,
    "beamSize": 5,
    "temperature": 0.0,
    "noSpeechThreshold": 0.6,
    "logprobThreshold": -1.0,
    "conditionOnPreviousText": false,
    "extraArgs": ""
  },
  "transcribe": {
    "alignScriptPath": "host/tools/transcribe_align/transcribe_align.py"
  }
}
```

## Частые проблемы
- `Permission denied` при запуске внешних команд (Word/WhisperX):
  - В AE включить: `Preferences > Scripting & Expressions > Allow Scripts to Write Files and Access Network`.

- `[object Object]` в Settings вместо пути:
  - Это исправлено: picker возвращает строку. Если снова появится — проверить актуальность `host/lib/config.jsx` и `client/js/ui_settings.js`.

---

## ffmpeg (portable, без PATH)
- `paths.ffmpegExePath` (string)
  - Путь к `ffmpeg.exe`.
  - Пример: `%USERPROFILE%/CaptionPanelsLocal/CaptionPanelTools/ffmpeg/ffmpeg.exe`
  - Если ключ задан и файл существует, плагин **на время запуска WhisperX** добавляет папку ffmpeg в `PATH` процесса (через `cmd.exe /c set PATH=...;%PATH%`).
  - Системный `PATH` не изменяется.


## Auto Timing

- Применение идет по кадрам: `start` округляется вниз (`floor`), `end` округляется вверх (`ceil`).
- Пересечения блоков автоматически исправляются: сначала пытаемся укоротить предыдущий блок, если нельзя — сдвигаем следующий вправо.
- Минимальный зазор регулируется через `autoTimingMinGapFrames`.
