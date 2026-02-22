# Schemas Reference (RU)

Этап 3.2: формализованные схемы данных для основных JSON-артефактов.

## Файлы схем

- `docs/schemas/import.schema.json` — входной JSON для импорта текста/сегментов.
- `docs/schemas/blocks.schema.json` — экспорт subtitle blocks из AE.
- `docs/schemas/alignment.schema.json` — результат align-пайплайна для применения таймингов.

## Runtime-валидация в плагине

Host-модуль: `cep_src/ContentPanels/host/lib/schema_validation.jsx`.

Что валидируется в рантайме:

1) Import:
- `importJsonFromFile(...)` проверяет payload через `cpValidateImportPayload`.
- При ошибках схема-валидации импорт прерывается с понятным списком причин.

2) Blocks export:
- `exportSubtitleBlocks()` проверяет итоговый payload через `cpValidateBlocksPayload` перед записью файла.

3) Alignment apply/preview:
- `autoTimingPreviewApply(...)` и `autoTimingApply(...)` проверяют `alignment.json` через `cpValidateAlignmentPayload`.
- При критических расхождениях применение таймингов блокируется.

## Почему это важно

- Убираем «тихие» падения и неочевидные ошибки формата.
- Быстрее дебажим проблемы на рабочих машинах.
- Готовим базу для дальнейшей типизации протоколов (Этап 3).
