# CaptionPanels offline bundle (best-effort helper)
#
# Задача: собрать папку для переноса на офлайн ПК.
# Этот скрипт НЕ является "инсталлятором" — он просто копирует файлы.
#
# Что копируем:
# - %USERPROFILE%\CaptionPanelsLocal\CaptionPanelTools\word2json\...
# - %USERPROFILE%\CaptionPanelsLocal\CaptionPanelTools\whisperx\...
# - (опционально) %USERPROFILE%\CaptionPanelsLocal\CaptionPanelTools\ffmpeg\ffmpeg.exe
# - (опционально) кэши моделей из профиля пользователя
#
# Пример:
#   powershell -ExecutionPolicy Bypass -File .\make_offline_bundle.ps1 -OutDir D:\CaptionPanels_OfflineBundle

param(
  [Parameter(Mandatory=$true)]
  [string]$OutDir,

  [string]$ToolsRoot = $(Join-Path $env:USERPROFILE "CaptionPanelsLocal\CaptionPanelTools"),
  [string]$DataRoot  = $(Join-Path $env:USERPROFILE "CaptionPanelsLocal\CaptionPanelsData"),

  [switch]$IncludeHFCache,
  [string]$HFCacheDir = "$env:USERPROFILE\\.cache\\huggingface\\hub",

  [switch]$IncludeCTranslateCache,
  [string]$CTranslateCacheDir = "$env:USERPROFILE\\.cache\\ctranslate2",

  [bool]$IncludeDataModels = $true
)

$ErrorActionPreference = "Stop"

Write-Host "[CaptionPanels] Building offline bundle..." -ForegroundColor Cyan
Write-Host "OutDir: $OutDir"
Write-Host "ToolsRoot: $ToolsRoot"
Write-Host "DataRoot:  $DataRoot"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$dstRoot  = Join-Path $OutDir "CaptionPanelsLocal"
$dstTools = Join-Path $dstRoot "CaptionPanelTools"
$dstData  = Join-Path $dstRoot "CaptionPanelsData"

Write-Host "Copy tools from $ToolsRoot -> $dstTools"
if (!(Test-Path $ToolsRoot)) {
  throw "ToolsRoot not found: $ToolsRoot"
}
Copy-Item -Recurse -Force $ToolsRoot $dstTools

# DataRoot мы обычно НЕ копируем целиком, там рабочие артефакты.
# Но создаем структуру папок как подсказку.
Write-Host "Create data skeleton in $dstData"
New-Item -ItemType Directory -Force -Path (Join-Path $dstData "word2json") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $dstData "auto_timing\\blocks") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $dstData "auto_timing\\whisperx") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $dstData "auto_timing\\alignment") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $dstData "auto_timing\\logs") | Out-Null

if ($IncludeDataModels) {
  $srcModels = Join-Path $DataRoot "models"
  $dstModels = Join-Path $dstData "models"
  if (Test-Path $srcModels) {
    Write-Host "Copy DataRoot models $srcModels -> $dstModels"
    Copy-Item -Recurse -Force $srcModels $dstModels
  } else {
    Write-Host "DataRoot models not found: $srcModels (skip)" -ForegroundColor Yellow
  }
}

if ($IncludeHFCache) {
  if (Test-Path $HFCacheDir) {
    $dst = Join-Path $OutDir "hf_cache_hub"
    Write-Host "Copy HF cache $HFCacheDir -> $dst"
    Copy-Item -Recurse -Force $HFCacheDir $dst
  } else {
    Write-Host "HF cache dir not found: $HFCacheDir" -ForegroundColor Yellow
  }
}

if ($IncludeCTranslateCache) {
  if (Test-Path $CTranslateCacheDir) {
    $dst = Join-Path $OutDir "ctranslate2_cache"
    Write-Host "Copy CTranslate2 cache $CTranslateCacheDir -> $dst"
    Copy-Item -Recurse -Force $CTranslateCacheDir $dst
  } else {
    Write-Host "CTranslate2 cache dir not found: $CTranslateCacheDir" -ForegroundColor Yellow
  }
}

function Test-BundleFile {
  param([string]$PathValue)
  return (Test-Path $PathValue)
}

$summary = @{
  generatedAt = (Get-Date).ToString("s")
  outDir = $OutDir
  localRoot = $dstRoot
  toolsRoot = $dstTools
  dataRoot = $dstData
  checks = @{
    word2jsonExe = (Test-BundleFile (Join-Path $dstTools "word2json\\word2json.exe"))
    whisperxPython = (Test-BundleFile (Join-Path $dstTools "whisperx\\.venv\\Scripts\\python.exe"))
    ffmpegExe = (Test-BundleFile (Join-Path $dstTools "ffmpeg\\ffmpeg.exe"))
    dataWordOutDir = (Test-BundleFile (Join-Path $dstData "word2json"))
    dataAutoTimingLogsDir = (Test-BundleFile (Join-Path $dstData "auto_timing\\logs"))
    dataModelsDir = (Test-BundleFile (Join-Path $dstData "models"))
  }
}

$summaryPath = Join-Path $OutDir "bundle_summary.json"
$summary | ConvertTo-Json -Depth 6 | Out-File -FilePath $summaryPath -Encoding UTF8
Write-Host "Bundle summary: $summaryPath"

Write-Host "Done." -ForegroundColor Green
