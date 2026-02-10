# Config Reference (CaptionPanels)

Дата: 2026-02-09

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

## Рекомендуемые базовые каталоги (стандарт деплоя)
Чтобы на рабочих ПК всё было предсказуемо и не требовало прав администратора / правки `PATH`:
- Данные/артефакты: `C:\AE\CaptionPanelsData\...`
- Внешние утилиты: `C:\AE\CaptionPanelsTools\...`

## Ключи (reference)

### speakers / topics
- `speakersDbPath` (string)
  - Путь к общей базе спикеров `speakers.json`.
  - Может быть абсолютным (`H:/.../speakers.json`, `C:/.../speakers.json`) или относительным (тогда считается относительно папки конфига).

- `topicOptions` (array of string)
  - Список рубрик для TOPIC (выпадающий список).
  - Редактируется через Settings.

### logs
- `enableLogs` (boolean)
  - Включает диагностические логи (если реализованы в конкретных модулях).

- `logsRoot` (string)
  - Кастомная папка для логов. Если пусто — используется AppData (см. `getLogsRoot()` в `host/lib/config.jsx`).

### subtitles
- `subtitleCharsPerLine` (number)
  - Лимит символов в строке при нарезке субтитров.
  - Редактируется через Settings.
  - Guardrails: 20..200 (вне диапазона будет использовано 60).

- `subtitleBgGapSec` (number)
  - Порог разрыва для `subtitle_BG`: если пауза между соседними блоками субтитров больше этого значения — подложка режется на отдельный сегмент.
  - По умолчанию: `1.0`.
  - Диапазон: 0..10.

### word import (Word -> JSON)
- `captionPanelsToolsRoot` (string)
  - Рекомендуемый корень внешних утилит.
  - Пример: `C:/AE/CaptionPanelsTools`

- `captionPanelsDataRoot` (string)
  - Рекомендуемый корень данных/артефактов.
  - Пример: `C:/AE/CaptionPanelsData`

- `word2jsonExePath` (string)
  - Путь к `word2json.exe` (конвертер `.docx` -> `.json`).
  - Рекомендация (локально, не UNC): `C:/AE/CaptionPanelsTools/word2json/word2json.exe`

- `word2jsonOutDir` (string)
  - Папка, куда пишется сгенерированный `.json` и `word2json_last.log`.
  - Рекомендация: `C:/AE/CaptionPanelsData/word2json`
  - Если пусто: сначала пробуется `captionPanelsDataRoot/word2json`, иначе `%TEMP%\CaptionPanels\word2json`.

### auto timing (blocks / whisperx / alignment)
- `autoTimingOutDir` (string)
  - Legacy ключ (оставлен для совместимости). Рекомендуется использовать специализированные каталоги ниже.

- `autoTimingBlocksDir` (string)
  - Куда сохраняется `blocks_*.json` при Export Blocks.
  - Рекомендация: `C:/AE/CaptionPanelsData/auto_timing/blocks`

- `autoTimingWhisperXDir` (string)
  - Базовая папка для артефактов WhisperX по runId.
  - Рекомендация: `C:/AE/CaptionPanelsData/auto_timing/whisperx`

- `autoTimingAlignmentDir` (string)
  - Базовая папка для результатов выравнивания (`alignment.json`) по runId.
  - Рекомендация: `C:/AE/CaptionPanelsData/auto_timing/alignment`

- `autoTimingLogsDir` (string)
  - Куда пишутся логи запуска внешних команд.
  - Рекомендация: `C:/AE/CaptionPanelsData/auto_timing/logs`

### whisperx (ASR)
- `whisperxPythonPath` (string)
  - Путь к Python из venv WhisperX.
  - Пример: `C:/AE/whisperx/.venv/Scripts/python.exe`
  - Это позволяет **не устанавливать системный Python** на рабочих ПК (достаточно скопировать папку `C:\AE\whisperx\`).

- `whisperxModel` (string)
  - Пример: `small`, `medium`, позже возможно `large-v3`.

- `whisperxLanguage` (string)
  - Пример: `ru`.

- `whisperxDevice` (string)
  - Пример: `cuda`.

- `whisperxVadMethod` (string)
  - Пример: `silero`.

- `whisperxAdvancedArgsEnabled` (boolean)
  - Включает передачу расширенных параметров в WhisperX CLI.
  - Если `false` — плагин использует только базовые параметры (`model`, `language`, `device`, `vad_method`).

- `whisperxBeamSize` (number)
  - `beam_size` для декодирования (обычно 1..20).

- `whisperxTemperature` (number)
  - `temperature` (обычно 0.0 для детерминированности).

- `whisperxNoSpeechThreshold` (number)
  - `no_speech_threshold` (порог "нет речи").

- `whisperxLogprobThreshold` (number)
  - `logprob_threshold`.

- `whisperxConditionOnPreviousText` (boolean)
  - `condition_on_previous_text` (true/false).

- `whisperxExtraArgs` (string)
  - Raw строка аргументов, которая будет добавлена в конец команды WhisperX "как есть".
  - Нужна как escape-hatch, если WhisperX CLI меняется и нужно быстро подстроиться без правки кода.

- `transcribeAlignScriptPath` (string)
  - Путь к `transcribe_align.py`.
  - Обычно относительный: `host/tools/transcribe_align/transcribe_align.py`.

## Пример рекомендуемого конфига (AppData)
Файл: `%APPDATA%\CaptionPanels\config.json`

```json
{
  "captionPanelsDataRoot": "C:/AE/CaptionPanelsData",
  "captionPanelsToolsRoot": "C:/AE/CaptionPanelsTools",

  "speakersDbPath": "H:/Media/Kurzykin/PROJECT/Titles_Template_NEW2025/work/json/speakers.json",
  "topicOptions": ["Новости", "Специальный репортаж", "Спорт"],

  "subtitleCharsPerLine": 60,
  "subtitleBgGapSec": 1.0,

  "word2jsonExePath": "C:/AE/CaptionPanelsTools/word2json/word2json.exe",
  "word2jsonOutDir": "C:/AE/CaptionPanelsData/word2json",

  "autoTimingBlocksDir": "C:/AE/CaptionPanelsData/auto_timing/blocks",
  "autoTimingWhisperXDir": "C:/AE/CaptionPanelsData/auto_timing/whisperx",
  "autoTimingAlignmentDir": "C:/AE/CaptionPanelsData/auto_timing/alignment",
  "autoTimingLogsDir": "C:/AE/CaptionPanelsData/auto_timing/logs",

  "whisperxPythonPath": "C:/AE/whisperx/.venv/Scripts/python.exe",
  "whisperxModel": "medium",
  "whisperxLanguage": "ru",
  "whisperxDevice": "cuda",
  "whisperxVadMethod": "silero",

  "whisperxAdvancedArgsEnabled": false,
  "whisperxBeamSize": 5,
  "whisperxTemperature": 0.0,
  "whisperxNoSpeechThreshold": 0.6,
  "whisperxLogprobThreshold": -1.0,
  "whisperxConditionOnPreviousText": false,
  "whisperxExtraArgs": "",

  "transcribeAlignScriptPath": "host/tools/transcribe_align/transcribe_align.py"
}
```

## Частые проблемы
- `Permission denied` при запуске внешних команд (Word/WhisperX):
  - В AE включить: `Preferences > Scripting & Expressions > Allow Scripts to Write Files and Access Network`.

- `[object Object]` в Settings вместо пути:
  - Это исправлено: picker возвращает строку. Если снова появится — проверить актуальность `host/lib/config.jsx` и `client/js/ui_settings.js`.

---

## Planned (TODO)
(зафиксировано в роадмапе)
- `ffmpegExePath`: использовать ffmpeg как portable‑утилиту без `PATH`:
  - `C:/AE/CaptionPanelsTools/ffmpeg/ffmpeg.exe`
