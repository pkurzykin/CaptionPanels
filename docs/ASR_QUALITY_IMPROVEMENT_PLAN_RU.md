# План улучшения качества распознавания (WhisperX) для Auto Timing

Дата: 2026-02-09
Ветка разработки: `feature/auto-timing`

## Зачем это нужно
Сейчас Auto Timing в целом работает, но часть блоков субтитров иногда не находит корректные границы (не подрезается/не встаёт на место). Главная причина обычно одна из двух:
1) ошибки распознавания (ASR) -> в тексте WhisperX нет нужных слов/они искажены;
2) наш aligner (`transcribe_align.py`) слишком строго сопоставляет текст блока с распознанным текстом.

Этот план про пункт (1): как повысить качество распознавания и сделать это настраиваемым.

## Цель
- Повысить точность распознавания русской речи, чтобы aligner чаще находил слова блока.
- Сделать параметры распознавания настраиваемыми через `config.json` (без правки кода).
- Минимизировать «хаос путей» и обеспечить офлайн-работу на рабочих ПК.

## Базовая идея
1) Делаем шаг распознавания WhisperX управляемым параметрами (модель + декодирование).
2) Добавляем правильный кэш моделей/артефактов в `%USERPROFILE%\CaptionPanelsLocal\CaptionPanelsData\...`.
3) Тестируем на реальных роликах: сравниваем процент «успешно выставленных блоков».

## Параметры, которые нужно поддержать (настройки)
Параметры, которые ты попросил добавить как будущие настройки:

- `model = large-v3`
- `language = ru`
- `beam_size = 5`
- `temperature = 0.0`
- `no_speech_threshold = 0.6`
- `logprob_threshold = -1.0`
- `condition_on_previous_text = false`

### Как это ляжет на наш `config.json`
Предлагаемые ключи (все опциональные, с дефолтами):
- `whisperxModel`: строка, напр. `"medium"` / `"large-v3"`
- `whisperxLanguage`: `"ru"`
- `whisperxBeamSize`: число, напр. `5`
- `whisperxTemperature`: число, напр. `0.0`
- `whisperxNoSpeechThreshold`: число, напр. `0.6`
- `whisperxLogProbThreshold`: число, напр. `-1.0`
- `whisperxConditionOnPreviousText`: boolean, напр. `false`

Важно: фактические имена CLI-флагов у WhisperX/движка (faster-whisper) нужно сверить командой на Windows:
- `%USERPROFILE%\CaptionPanelsLocal\CaptionPanelTools\whisperx\.venv\Scripts\python.exe -m whisperx --help`

Если каких-то флагов в CLI нет, делаем альтернативный путь (см. ниже).

## Реализация (шаги)

### Шаг 1. Инвентаризация: какие флаги реально поддерживает CLI WhisperX
Что делаем:
- На Windows запускаем `python -m whisperx --help` из нашего окружения `%USERPROFILE%\CaptionPanelsLocal\CaptionPanelTools\whisperx`.
- Выписываем:
  - как задаётся модель (имя модели и доступность `large-v3`),
  - как задаются параметры декодирования (beam/temperature),
  - какие есть параметры фильтра «тишины» (no_speech_threshold/logprob_threshold),
  - есть ли `condition_on_previous_text`.

Результат:
- Таблица «хотим -> есть/нет в CLI -> чем заменяем».

### Шаг 2. Поддержка параметров в плагине

#### Вариант А (предпочтительный): просто прокидываем CLI-флаги
Условия:
- CLI WhisperX принимает нужные параметры.

Что делаем:
- В `cep_src/shared/config.json` добавляем новые поля (см. список выше).
- В `cep_src/jsx/lib/auto_timing.jsx`:
  - читаем новые поля,
  - собираем команду WhisperX с дополнительными флагами,
  - логируем итоговую команду в `%USERPROFILE%\CaptionPanelsLocal\CaptionPanelsData\auto_timing\logs`.

#### Вариант B (если CLI не поддерживает часть параметров): делаем наш wrapper-скрипт
Условия:
- CLI WhisperX не даёт настроить то, что нам нужно.

Что делаем:
- Создаём `cep_src/jsx/tools/whisperx_runner/run_whisperx.py`.
- Плагин вызывает не `-m whisperx ...`, а:
  - `python.exe run_whisperx.py --video ... --out-dir ... --model ... --beam-size ...` и т.д.
- Внутри `run_whisperx.py` используем Python API WhisperX/faster-whisper и выставляем параметры напрямую.

Плюсы:
- Полный контроль параметров.
Минусы:
- Нужно чуть больше кода и тестирования.

### Шаг 3. Приводим пути/кэш к единому стандарту (офлайн-готовность)
Цель: на рабочих ПК без интернета всё должно отрабатывать, если модели уже есть.

Что делаем:
- Стандартизируем один корень:
  - `paths.dataRoot = %USERPROFILE%/CaptionPanelsLocal/CaptionPanelsData`
- Добавляем (или фиксируем) подкаталоги:
  - `%USERPROFILE%\CaptionPanelsLocal\CaptionPanelsData\auto_timing\blocks`
  - `%USERPROFILE%\CaptionPanelsLocal\CaptionPanelsData\auto_timing\whisperx\<runId>`
  - `%USERPROFILE%\CaptionPanelsLocal\CaptionPanelsData\auto_timing\alignment\<runId>`
  - `%USERPROFILE%\CaptionPanelsLocal\CaptionPanelsData\auto_timing\logs`
  - `%USERPROFILE%\CaptionPanelsLocal\CaptionPanelsData\models\` (если решим хранить модели централизованно)
  - `%USERPROFILE%\CaptionPanelsLocal\CaptionPanelsData\hf_cache\` (кэш HuggingFace)

Идея для офлайна:
- На ноуте (с интернетом) один раз прогреваем скачивание моделей.
- Копируем кэш (`hf_cache`) на рабочие ПК (или на шару, если ИБ позволит),
- На рабочих ПК используем уже готовый кэш.

Техническая деталь (сверить на практике):
- WhisperX/pyannote/transformers используют кэш HuggingFace. Его можно направить переменными окружения (`HF_HOME`, `HF_HUB_CACHE`).
- Если через `cmd.exe` сложно выставлять env, можно делать это в wrapper-скрипте (Вариант B) или добавлять `set HF_HOME=... && ...` в команду.

### Шаг 4. Тест-план качества
Делаем маленькую «метрику качества» для себя:
- Берём 3 ролика разной длины (2-3 мин, 10 мин, 20+ мин).
- Для каждого:
  1) создаём субтитры как обычно,
  2) запускаем Auto Timing,
  3) считаем:
     - сколько блоков успешно подрезались/встали,
     - сколько пропущено (и почему — из лога/отчёта),
     - сколько «ошибочно подрезало» (редко, но возможно).

Сравниваем режимы:
- `small` vs `medium` vs `large-v3`
- `beam_size = 1` vs `5`
- `condition_on_previous_text = true/false`

### Шаг 5. Документация для согласования (ИБ/внедрение)
Нужно подготовить понятный документ:
- что это за утилита/модуль,
- какие бинарники используются (`python.exe` из venv, ffmpeg, whisperx),
- какие файлы куда пишет,
- какие сетевые доступы нужны (идеально: не нужны),
- как обновлять модели и как работать офлайн.

## Риски и компромиссы
- `large-v3` точнее, но медленнее и требует больше VRAM/диска.
- `beam_size=5` почти всегда повышает качество, но замедляет.
- `temperature=0.0` делает результат более стабильным (меньше «случайностей»), но иногда хуже в сложных местах.
- `condition_on_previous_text=false` может снизить «залипание» ошибок между сегментами, но иногда ухудшает связность.

## Что будет «готово», когда можно считать задачу закрытой
- Параметры распознавания настраиваются через `config.json`.
- Пути сохранения и кэш моделей стандартизированы под `%USERPROFILE%\CaptionPanelsLocal\CaptionPanelsData\...`.
- Есть краткий тест-отчёт: «на 3 роликах medium/large-v3 даёт X% успешного тайминга».
