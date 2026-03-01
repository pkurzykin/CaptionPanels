@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
pushd "%SCRIPT_DIR%\..\.."
if errorlevel 1 (
  echo [ERROR] Failed to switch to repository root.
  pause
  exit /b 1
)

set "PS_EXE=pwsh"
where pwsh >nul 2>&1
if errorlevel 1 (
  set "PS_EXE=powershell"
)

echo [INFO] Starting CaptionPanels plugin sync watch...
echo [INFO] Repo root: %CD%
echo [INFO] Press Ctrl+C to stop.
echo.

"%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File ".\scripts\dev\sync-plugin.ps1" ^
  -AePluginDir "C:\CaptionPanelsLocal\DevPluginSync\plugin" ^
  -Watch ^
  -PostSyncTaskName "CaptionPanels Apply Plugin Sync" ^
  -WaitForPostSyncTask

set "EXIT_CODE=%ERRORLEVEL%"
popd

if not "%EXIT_CODE%"=="0" (
  echo.
  echo [ERROR] Sync watch exited with code %EXIT_CODE%.
  pause
)

exit /b %EXIT_CODE%
