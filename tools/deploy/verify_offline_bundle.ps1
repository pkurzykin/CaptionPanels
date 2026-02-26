# CaptionPanels offline bundle verifier
#
# Проверяет, что в собранном offline bundle есть базовые файлы/папки для запуска.
#
# Пример:
#   powershell -ExecutionPolicy Bypass -File .\verify_offline_bundle.ps1 -BundleRoot D:\CaptionPanels_OfflineBundle

param(
  [Parameter(Mandatory=$true)]
  [string]$BundleRoot,

  [switch]$RequireModelCache
)

$ErrorActionPreference = "Stop"

function Resolve-LocalRoot {
  param([string]$Root)

  $r = (Resolve-Path -LiteralPath $Root).Path
  if (Test-Path (Join-Path $r "CaptionPanelsLocal")) {
    return (Join-Path $r "CaptionPanelsLocal")
  }
  return $r
}

function Add-Check {
  param(
    [ref]$List,
    [string]$Name,
    [bool]$Ok,
    [string]$Path
  )
  $List.Value += [pscustomobject]@{
    name = $Name
    ok = $Ok
    path = $Path
  }
}

$localRoot = Resolve-LocalRoot $BundleRoot
$toolsRoot = Join-Path $localRoot "CaptionPanelTools"
$dataRoot = Join-Path $localRoot "CaptionPanelsData"

$checks = @()
Add-Check ([ref]$checks) "tools root" (Test-Path $toolsRoot) $toolsRoot
Add-Check ([ref]$checks) "data root" (Test-Path $dataRoot) $dataRoot
Add-Check ([ref]$checks) "word2json.exe" (Test-Path (Join-Path $toolsRoot "word2json\\word2json.exe")) (Join-Path $toolsRoot "word2json\\word2json.exe")
Add-Check ([ref]$checks) "whisperx python.exe" (Test-Path (Join-Path $toolsRoot "whisperx\\.venv\\Scripts\\python.exe")) (Join-Path $toolsRoot "whisperx\\.venv\\Scripts\\python.exe")
Add-Check ([ref]$checks) "ffmpeg.exe" (Test-Path (Join-Path $toolsRoot "ffmpeg\\ffmpeg.exe")) (Join-Path $toolsRoot "ffmpeg\\ffmpeg.exe")
Add-Check ([ref]$checks) "word2json output dir" (Test-Path (Join-Path $dataRoot "word2json")) (Join-Path $dataRoot "word2json")
Add-Check ([ref]$checks) "auto_timing logs dir" (Test-Path (Join-Path $dataRoot "auto_timing\\logs")) (Join-Path $dataRoot "auto_timing\\logs")

if ($RequireModelCache) {
  Add-Check ([ref]$checks) "models cache dir" (Test-Path (Join-Path $dataRoot "models")) (Join-Path $dataRoot "models")
}

$fails = @($checks | Where-Object { -not $_.ok })
$oks = @($checks | Where-Object { $_.ok })

Write-Host "[CaptionPanels] Offline bundle check" -ForegroundColor Cyan
Write-Host "BundleRoot: $BundleRoot"
Write-Host "LocalRoot:  $localRoot"
Write-Host ""
Write-Host ("OK:   {0}" -f $oks.Count) -ForegroundColor Green
Write-Host ("FAIL: {0}" -f $fails.Count) -ForegroundColor Yellow
Write-Host ""

foreach ($c in $checks) {
  $mark = if ($c.ok) { "[OK]  " } else { "[FAIL]" }
  Write-Host ("{0} {1}: {2}" -f $mark, $c.name, $c.path)
}

if ($fails.Count -gt 0) {
  exit 1
}

exit 0
