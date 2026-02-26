# Tools Layout (Developer)

## Scope

Документ фиксирует текущую структуру `tools/`, правила упаковки и ожидаемую эволюцию без breaking changes.

## Source layout (`tools/`)

Текущая модель: один top-level каталог на один инструмент.

- `tools/word2json/`
  - `README.md`
  - `src/` (исходники .NET)
  - `runtime/` (опционально; локальные бинарники/артефакты)
- `tools/transcribe_align/`
  - `transcribe_align.py`
  - `schemas/`, `sample/`
- `tools/deploy/`
  - вспомогательные deploy/offline-скрипты

Правило: новые инструменты добавляются отдельной папкой `tools/<tool-name>/`.

## Packaging behavior

`scripts/package.ps1` формирует `dist/CaptionPanels/tools` в 2 шага:

1. Копирует whitelist-каталоги tools:
   - `word2json`
   - `transcribe_align`
   - `deploy`
2. Если есть publish-выход `word2json` из `scripts/build.ps1`, делает overlay в:
   - `dist/CaptionPanels/tools/word2json/runtime/win-x64/self-contained`

Для обратной совместимости дополнительно дублируются:
- `word2json.exe` -> `dist/CaptionPanels/tools/word2json/word2json.exe`
- `word2json.rules.json` -> `dist/CaptionPanels/tools/word2json/word2json.rules.json`

## Binary policy (current)

- Уже присутствующие бинарники в tool-папках не удаляются автоматически и не ломают упаковку.
- Папки `bin/`, `obj/`, `x64/`, `.git/`, `.vs/`, `Debug/`, `Release/` не попадают в инсталляционный payload.

## Preferred future model (documented only)

- Хранить в git только исходники и metadata, а runtime-бинарники получать из build/CI.
- Стандартизовать runtime-артефакты по схеме `runtime/<rid>/<mode>/...`.
- Продолжать использовать только `dist/CaptionPanels` как deployment source of truth.
