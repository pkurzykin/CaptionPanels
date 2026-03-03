# deploy helpers

Здесь лежат вспомогательные скрипты/заметки для подготовки офлайн-набора утилит (tools bundle).

Идея:
- инструменты кладем в `%USERPROFILE%\CaptionPanelsLocal\CaptionPanelTools\...`
- данные/логи кладем в `%USERPROFILE%\CaptionPanelsLocal\CaptionPanelsData\...`

Скрипты:
- `make_offline_bundle.ps1` — собрать переносимый offline bundle (`CaptionPanelsLocal\...`) и создать `bundle_summary.json`.
- `verify_offline_bundle.ps1` — проверить, что в bundle есть обязательные exe/папки.

Примеры:
- `powershell -ExecutionPolicy Bypass -File .\make_offline_bundle.ps1 -OutDir D:\CaptionPanels_OfflineBundle`
- `powershell -ExecutionPolicy Bypass -File .\verify_offline_bundle.ps1 -BundleRoot D:\CaptionPanels_OfflineBundle -RequireModelCache`

См. также:
- `docs/DEPLOYMENT_GUIDE.md`
- `docs/CONFIG_REFERENCE.md`
