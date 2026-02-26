# Tools Directory

`tools/` хранит исходники и вспомогательные ресурсы внешних инструментов CaptionPanels.

Текущая организация: один каталог на инструмент.

- `word2json/`
- `transcribe_align/`
- `deploy/`

Порядок сборки/упаковки:
- build: `pwsh -NoProfile -File .\scripts\build.ps1`
- package: `pwsh -NoProfile -File .\scripts\package.ps1`

Контракт layout и policy по бинарникам: `docs/dev/tools-layout.md`.
