# Troubleshooting (RU)

Короткий справочник по типовым проблемам CaptionPanels.

## 1) `word2json.exe not found`

Проверь в активном конфиге:
- `paths.toolsRoot`
- `paths.word2jsonExePath`

Рекомендуемые значения:
- `paths.toolsRoot = C:/CaptionPanelsLocal/CaptionPanelTools`
- `paths.word2jsonExePath = C:/CaptionPanelsLocal/CaptionPanelTools/word2json/word2json.exe`

Если в логах видно старые пути `C:/AE/...`, перезагрузи панель (`Reload`): runtime делает авто-нормализацию legacy-путей.

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
- `asr.whisperxPythonPath = C:/CaptionPanelsLocal/CaptionPanelTools/whisperx/.venv/Scripts/python.exe`

## 5) `ffmpeg` не найден

Проверь:
- `paths.ffmpegExePath`

Рекомендуемо:
- `paths.ffmpegExePath = C:/CaptionPanelsLocal/CaptionPanelTools/ffmpeg/ffmpeg.exe`

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
- `paths.word2jsonOutDir = C:/CaptionPanelsLocal/CaptionPanelsData/word2json`

## 8) Общая проверка окружения (Windows)

Минимум:
- AE 2024+
- Доступ к `C:\CaptionPanelsLocal\CaptionPanelTools\...`
- Доступ к `C:\CaptionPanelsLocal\CaptionPanelsData\...`
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
- наличие локальных моделей в `C:/CaptionPanelsLocal/CaptionPanelsData/models`.

Если модели не закэшированы:
- временно отключи `offlineOnly`, запусти Auto Timing один раз с интернетом для прогрева cache;
- затем снова включи `offlineOnly`.

## Где смотреть логи

- Word import:
  - `C:/CaptionPanelsLocal/CaptionPanelsData/auto_timing/logs/word2json_last.log`
  - `C:/CaptionPanelsLocal/CaptionPanelsData/auto_timing/logs/word2json_process_last.log`
- Auto timing:
  - `C:/CaptionPanelsLocal/CaptionPanelsData/auto_timing/logs/whisperx_runner_*.log`
  - `C:/CaptionPanelsLocal/CaptionPanelsData/auto_timing/logs/align_*.out.txt`
- Run manifests:
  - `C:/CaptionPanelsLocal/CaptionPanelsData/runs/word_import/<runId>/run.json`
  - `C:/CaptionPanelsLocal/CaptionPanelsData/runs/auto_timing/<runId>/run.json`
