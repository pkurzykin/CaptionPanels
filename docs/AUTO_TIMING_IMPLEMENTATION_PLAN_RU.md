# Auto Timing: план реализации (RU)

Цель: автоматизировать длительность и положение субтитровых блоков так, чтобы:
- начало/конец каждого блока совпадали с реальным говорением,
- можно было сначала создать блоки и вручную подправить текст/переносы, а затем одним действием применить автотайминги,
- результат был воспроизводимым, с понятными путями, логами и офлайн-режимом.

Целевая платформа: Windows 10, After Effects 2024 (24.2+), NVIDIA GPU.

---

## Термины и артефакты

- `blocks_*.json` — экспорт из AE: список субтитровых блоков (каждый имеет `segId` и текст).
- `whisperx_*.json` — результат WhisperX: распознанный текст + слова с таймкодами.
- `alignment_*.json` — файл сопоставления: для каждого `segId` есть `start/end` (секунды) и `confidence`.
- “Apply Timings” — действие в плагине, которое по `alignment.json` двигает/подрезает слои субтитров.

---

## DONE (что уже реализовано)

- [DONE] Export Blocks в плагине: экспорт блоков субтитров в `blocks_*.json` (есть `segId` и текст).
- [DONE] Apply Timings в плагине: применение `alignment.json` (in/out + смещения) + пересчёт `subtitle_BG`.
- [DONE] Убрано лишнее подтверждение/алерт-предпросмотр — изменения применяются сразу (по просьбе).
- [DONE] Исправлен кейс `[object Object]`/битые ответы ExtendScript (безопасная сериализация).
- [DONE] Исправлено поведение config: дефолтный `config.json` из плагина мерджится с `%APPDATA%\\CaptionPanels\\config.json`, новые ключи не “теряются”.
- [DONE] Создан и проверен тестовый `alignment_test_*.json` (подтверждено, что тайминги применяются).
- [DONE] WhisperX на ноуте запущен на GPU (torch `2.8.0+cu126`), VAD = `silero` (без падения pyannote).

---

## Проблемы/наблюдения (почему нужен следующий этап)

- Качество small недостаточно → планируем переход на `medium`.
- Хаос путей/кэшей (часть уезжает в `%APPDATA%`/`.cache`) → нужен единый корень хранения и предсказуемая структура.
- Из-за ошибок ASR возможны ошибки сопоставления блоков → нужны пороги/“safe apply”/unmatched.

---

## Единый корень данных (обязательное правило)

Все рабочие файлы автотайминга должны храниться под:

`C:\\AE\\CaptionPanelsData\\`

Внутри создаём структуру:

- `C:\AE\CaptionPanelsData\auto_timing\blocks\`
- `C:\AE\CaptionPanelsData\auto_timing\whisperx\`
- `C:\AE\CaptionPanelsData\auto_timing\alignment\`
- `C:\AE\CaptionPanelsData\auto_timing\logs\`
- (для офлайн) `C:\AE\CaptionPanelsData\models\` (контролируемый кэш моделей)

Принцип: плагин/утилита сами создают папки при первом запуске.

---

## Конфиг (единый источник истины)

Настройки должны задаваться через `config.json` плагина и/или пользовательский конфиг в `%APPDATA%\\CaptionPanels\\config.json`.

Требования:
- дефолтные значения поставляются вместе с плагином;
- пользовательские значения могут переопределять дефолтные;
- новые ключи, добавленные в дефолт, должны автоматически работать даже если в `%APPDATA%` старый конфиг (мердж уже сделан — просто придерживаться схемы).

Минимальные ключи для автотайминга (предлагаемые):

- `captionPanelsDataRoot`: `C:/AE/CaptionPanelsData`
- `autoTimingBlocksDir`: `C:/AE/CaptionPanelsData/auto_timing/blocks`
- `autoTimingAlignmentDir`: `C:/AE/CaptionPanelsData/auto_timing/alignment`
- `autoTimingLogsDir`: `C:/AE/CaptionPanelsData/auto_timing/logs`

WhisperX:
- `whisperxPythonPath`: `C:/AE/whisperx/.venv/Scripts/python.exe`
- `whisperxModel`: `medium` (позже можно переключать на `small`)
- `whisperxLanguage`: `ru`
- `whisperxDevice`: `cuda`
- `whisperxVadMethod`: `silero`

Transcribe/Align:
- `transcribeAlignScriptPath`: путь к `tools/transcribe_align/transcribe_align.py` (в сетевом репо)
- (опционально) `transcribeAlignThreshold`, `transcribeAlignMaxSkip`, и т.п.

---

## Нейминг файлов (без рандома)

Формат имён (пример):

- blocks: `blocks_<COMP>_<YYYYMMDD_HHMMSS>.json`
- whisperx: `whisperx_<VIDEO>_<model>_<YYYYMMDD_HHMMSS>.json`
- alignment: `alignment_<COMP>_<VIDEO>_<YYYYMMDD_HHMMSS>.json`

Где:
- `<COMP>` — имя активной композиции (нормализованное),
- `<VIDEO>` — имя исходного видео-файла (нормализованное),
- дата/время — для уникальности и трассировки.

---

## UX в плагине (как будет работать)

### Вариант “правильный сейчас” (2 кнопки)
1) `Build Alignment`:
   - Экспортировать blocks из активной композиции в `...\blocks\`.
   - Определить видео:
     - если выбран видео-слой/footage имеет file path → использовать его;
     - иначе попросить выбрать mp4 вручную.
   - Запустить WhisperX и сохранить `whisperx_*.json` в `...\whisperx\`.
   - Запустить `transcribe_align.py` и сохранить `alignment_*.json` в `...\alignment\`.
   - В конце показать краткий итог (сколько блоков matched/unmatched) + куда сохранено.

2) `Apply Timings`:
   - по умолчанию предложить последний `alignment_*.json` (или picker),
   - применить тайминги к текущей композиции,
   - пересчитать `subtitle_BG`.

### “Одна кнопка” (будущая цель)
`One Click Auto Timing`:
- Export Blocks → взять видео → WhisperX → alignment → Apply Timings.
(Ввод: активная композиция + выбранный видео-слой или файл.)

---

## Безопасность/качество применения (чтобы не ломать таймлайн)

- В `alignment.json` для каждого блока хранить `confidence`.
- В плагине сделать режим:
  - применять только блоки с `confidence >= threshold`,
  - остальные писать в лог и оставить как есть (unmatched/low-confidence).
- В лог писать summary:
  - сколько применено,
  - сколько пропущено,
  - какие `segId` не сопоставились.

---

## Офлайн-режим (важно для офиса без интернета)

Почему WhisperX “ходит в интернет”:
- при первом запуске он скачивает модели (ASR / VAD / tokenizer и т.п.) в локальный кэш.

Что нужно сделать:
- обеспечить возможность подготовить модели на ноуте (с интернетом),
- затем перенести кэш/модели в `C:\AE\CaptionPanelsData\models\` на рабочие ПК,
- заставить WhisperX использовать этот кэш (через env vars или параметры запуска),
- документировать процедуру для ИБ (что скачивается, где хранится, какие файлы/процессы запускаются).

---

## Git и документация (как ведём работу)

- Разработка ведётся небольшими шагами, каждый шаг отдельным коммитом:
  - “Paths & root dir”
  - “WhisperX medium config”
  - “Button Build Alignment (export → whisperx → align)”
  - “Safe apply + logs”
  - “Offline cache strategy”
- Документацию обновляем вместе с кодом (в том же PR/коммите или рядом).
- Версию плагина bump делаем только когда функционал стабилен и готов к распространению.

---

## Следующий этап (когда дадут команду “делаем”)

Этап A: привести все пути к единому корню `C:\AE\CaptionPanelsData\` и убрать “хаос”:
- добавить ключи в config,
- создать подпапки автоматически,
- привести экспорт blocks и output alignment к этому корню,
- добавить централизованный лог в `...\logs\`.

После стабилизации путей — переход на `medium` и кнопка `Build Alignment`.
