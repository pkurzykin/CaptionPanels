# Deployment Guide (Windows, offline-friendly)

Цель: поставить CaptionPanels на рабочий ПК так, чтобы:
- всё работало без доступа к интернету (после первоначальной подготовки);
- не требовались права администратора (по возможности);
- не нужно было править системный PATH;
- для ИБ было понятно, какие внешние exe запускаются и зачем.

Документация по ключам конфига: `docs/CONFIG_REFERENCE.md`.

---

## 0) Коротко: что вообще ставим

1) AE-плагин (AEX) + ресурсы панели (`client/`, `host/`, …)
2) Внешние утилиты:
   - `word2json.exe` (Word -> JSON)
   - WhisperX окружение (Python venv + пакеты) для распознавания/таймингов
   - (опционально) `ffmpeg.exe` portable

---

## 1) Рекомендуемый стандарт папок

Чтобы на всех машинах было одинаково и предсказуемо, используем 2 корня:

- Инструменты (exe/venv): `C:\AE\CaptionPanelsTools\...`
- Данные (выходные файлы, логи): `C:\AE\CaptionPanelsData\...`

### 1.1 Пример структуры

Инструменты:
- `C:\AE\CaptionPanelsTools\word2json\word2json.exe`
- `C:\AE\CaptionPanelsTools\whisperx\` (папка с `.venv` и пакетами)
- `C:\AE\CaptionPanelsTools\ffmpeg\ffmpeg.exe` (если используем portable)

Данные:
- `C:\AE\CaptionPanelsData\word2json\` (куда падает json из Word)
- `C:\AE\CaptionPanelsData\auto_timing\blocks\`
- `C:\AE\CaptionPanelsData\auto_timing\whisperx\`
- `C:\AE\CaptionPanelsData\auto_timing\alignment\`
- `C:\AE\CaptionPanelsData\auto_timing\logs\`

Папки данных создаются автоматически (если есть права на запись).

---

## 2) Установка AEX (плагина)

Ставим вручную копированием.

Типовой путь (может отличаться в зависимости от версии AE):
- `C:\Program Files\Adobe\Adobe After Effects 2024\Support Files\Plug-ins\CaptionPanels\`

Внутри должны быть:
- `CaptionPanels.aex`
- ресурсы панели (папки `client/`, `host/`, и т.д.)
- `config.json` (shipped config внутри папки плагина — базовые дефолты)

---

## 3) Обязательная настройка AE (иначе будет Permission denied)

В After Effects включить:

`Edit -> Preferences -> Scripting & Expressions -> Allow Scripts to Write Files and Access Network`

Без этого ExtendScript не сможет:
- запускать внешние команды (`callSystem`)
- писать файлы (логи/blocks/alignment)
- работать с UNC/сетью

---

## 4) Где лежит config.json и как он применяется

См. подробно: `docs/CONFIG_REFERENCE.md`.

Коротко:
- shipped config: лежит внутри папки плагина
- primary config: `%APPDATA%\CaptionPanels\config.json`
- при запуске конфиг мерджится: AppData перекрывает shipped
- Settings сохраняет изменения в `%APPDATA%\CaptionPanels\config.json`

---

## 5) Что нужно настроить на каждом ПК (минимум)

### 5.1 Word -> JSON
- `word2jsonExePath`: `C:/AE/CaptionPanelsTools/word2json/word2json.exe`
- `word2jsonOutDir`: `C:/AE/CaptionPanelsData/word2json`
- `word2jsonLogsDir`: `C:/AE/CaptionPanelsData/auto_timing/logs`

### 5.2 Auto Timing (WhisperX + align)
- `whisperxPythonPath`: `C:/AE/CaptionPanelsTools/whisperx/.venv/Scripts/python.exe`
- `whisperxModel`: например `medium`
- `whisperxLanguage`: `ru`
- `whisperxDevice`: `cuda`
- `whisperxVadMethod`: `silero`

(Опционально)
- `whisperxAdvancedArgsEnabled` и параметры качества (beam/temperature/...)

### 5.3 CUDA недоступна: что будет

По умолчанию мы пытаемся запускать WhisperX на GPU (`--device cuda`).
Если CUDA на машине недоступна/сломана, плагин автоматически делает **одну повторную попытку** на CPU (`--device cpu`).

Это позволяет не “падать” на рабочих ПК с проблемными драйверами, но CPU будет заметно медленнее.


---

## 6) Offline: почему WhisperX ходит в интернет и как это убрать

### 6.1 Почему ходит в интернет
При первом запуске WhisperX скачивает модели и компоненты (HuggingFace cache).
После этого повторные запуски могут работать офлайн — если кэш уже есть.

### 6.2 Как подготовить офлайн-машину

Вариант A (рекомендуемый):
1) На ПК с интернетом запускаем WhisperX 1 раз с нужной моделью (например `medium`).
2) Копируем кэш на рабочий ПК.

Где обычно лежит кэш на Windows:
- `C:\Users\<USER>\.cache\huggingface\hub\`
- иногда: `C:\Users\<USER>\.cache\ctranslate2\`

Важно:
- это кэш в профиле пользователя (на каждом ПК/у каждого пользователя путь свой).

---

## 7) FFmpeg (если на работе его нет)

Если `ffmpeg.exe` не установлен и нельзя править системный `PATH`:
- используем portable:
  - кладем `ffmpeg.exe` в `C:\AE\CaptionPanelsTools\ffmpeg\ffmpeg.exe`
  - в `config.json` задаем: `ffmpegExePath: C:/AE/CaptionPanelsTools/ffmpeg/ffmpeg.exe`
  - плагин добавит папку ffmpeg в `PATH` **только на время запуска WhisperX** (системный `PATH` не меняется)

Где взять:
- `https://ffmpeg.org/download.html`
- `https://www.gyan.dev/ffmpeg/builds/`

---

## 8) Что показывать ИБ (список исполняемых компонентов)

- `CaptionPanels.aex` — плагин AE
- `word2json.exe` — конвертация `.docx` -> `.json`
- `python.exe` (из venv WhisperX) — запуск `python -m whisperx ...`
- `ffmpeg.exe` (опционально) — чтение/выжимка аудио из `.mp4`

---

## 9) Типовые ошибки

- `callSystem error: Permission denied`:
  - включить опцию в AE (раздел 3)

- Нет модели / WhisperX пытается скачать:
  - значит нет кэша HuggingFace на этом ПК/пользователе

- GPU не виден:
  - драйвер NVIDIA, совместимость torch/torchaudio, CUDA

- Ошибки `can't open file 'C:\\Program'` / `не является внутренней или внешней командой`:
  - это почти всегда ошибка экранирования кавычек в `cmd /C` при путях с пробелами/UNC.
  - правило для кода: не собирать длинный inline `cmd /C "... ..."` с вложенными кавычками; использовать временный `.cmd`-скрипт (как в текущей реализации).
