[CmdletBinding()]
param(
    [string]$DistRoot = "dist/CaptionPanels",
    [string]$PluginName = "CaptionPanels",
    [switch]$AllowMissingAex
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$distLayoutAssertScript = Join-Path $repoRoot "scripts/ci/assert-dist-layout.ps1"
if (!(Test-Path -LiteralPath $distLayoutAssertScript -PathType Leaf)) {
    throw "Missing dist layout assertion script: $distLayoutAssertScript"
}

& $distLayoutAssertScript -DistRoot $DistRoot

$pluginRoot = Join-Path $DistRoot "plugin"
$toolsRoot = Join-Path $DistRoot "tools"
$aexPath = Join-Path $pluginRoot ("{0}.aex" -f $PluginName)

if (!(Test-Path -LiteralPath $pluginRoot -PathType Container)) {
    throw "Missing plugin payload directory: $pluginRoot"
}

if (!(Test-Path -LiteralPath $toolsRoot -PathType Container)) {
    throw "Missing tools payload directory: $toolsRoot"
}

if (!(Test-Path -LiteralPath $aexPath -PathType Leaf)) {
    if ($AllowMissingAex) {
        Write-Warning ("Missing required AEX for runtime install: {0}" -f $aexPath)
        Write-Warning "Install test in After Effects is not possible without CaptionPanels.aex."
    } else {
        throw ("Missing required AEX for runtime install: {0}. Build AEGP Release and run package again." -f $aexPath)
    }
}

Write-Host "Install payload verification: PASS"
Write-Host ("AE Plug-ins source: {0}" -f $pluginRoot)
Write-Host ("Tools source:       {0}" -f $toolsRoot)
Write-Host ("Config baseline:    {0}" -f (Join-Path $DistRoot "config.default.json"))
