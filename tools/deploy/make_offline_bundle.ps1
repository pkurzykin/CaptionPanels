# CaptionPanels offline bundle (best-effort helper)
#
# Задача: собрать папку для переноса на офлайн ПК.
# Этот скрипт НЕ является "инсталлятором" — он просто копирует файлы.
#
# Что копируем:
# - C:\CaptionPanelsLocal\CaptionPanelTools\word2json\...
# - C:\CaptionPanelsLocal\CaptionPanelTools\whisperx\...
# - (опционально) C:\CaptionPanelsLocal\CaptionPanelTools\ffmpeg\ffmpeg.exe
# - (опционально) кэши моделей из профиля пользователя
#
# Пример:
#   powershell -ExecutionPolicy Bypass -File .\make_offline_bundle.ps1 -OutDir D:\CaptionPanels_OfflineBundle

param(
  [Parameter(Mandatory=$true)]
  [string]$OutDir,

  [string]$ToolsRoot = "C:\\CaptionPanelsLocal\\CaptionPanelTools",
  [string]$DataRoot  = "C:\\CaptionPanelsLocal\\CaptionPanelsData",

  [switch]$IncludeHFCache,
  [string]$HFCacheDir = "$env:USERPROFILE\\.cache\\huggingface\\hub",

  [switch]$IncludeCTranslateCache,
  [string]$CTranslateCacheDir = "$env:USERPROFILE\\.cache\\ctranslate2"
)

$ErrorActionPreference = "Stop"

Write-Host "[CaptionPanels] Building offline bundle..." -ForegroundColor Cyan
Write-Host "OutDir: $OutDir"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$dstRoot  = Join-Path $OutDir "CaptionPanelsLocal"
$dstTools = Join-Path $dstRoot "CaptionPanelTools"
$dstData  = Join-Path $dstRoot "CaptionPanelsData"

Write-Host "Copy tools from $ToolsRoot -> $dstTools"
Copy-Item -Recurse -Force $ToolsRoot $dstTools

# DataRoot мы обычно НЕ копируем целиком, там рабочие артефакты.
# Но создаем структуру папок как подсказку.
Write-Host "Create data skeleton in $dstData"
New-Item -ItemType Directory -Force -Path (Join-Path $dstData "word2json") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $dstData "auto_timing\\blocks") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $dstData "auto_timing\\whisperx") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $dstData "auto_timing\\alignment") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $dstData "auto_timing\\logs") | Out-Null

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

Write-Host "Done." -ForegroundColor Green
