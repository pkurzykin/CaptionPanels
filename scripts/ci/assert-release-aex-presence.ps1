[CmdletBinding()]
param(
    [string]$BuildRoot = "",
    [string]$PluginName = "CaptionPanels"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot "..\paths.ps1")

$resolvedBuildRoot = Get-CaptionPanelsBuildRoot -BuildRoot $BuildRoot
$aexPath = Get-CaptionPanelsBuiltAexPath -BuildRoot $resolvedBuildRoot -PluginName $PluginName

if (-not (Test-Path -LiteralPath $aexPath -PathType Leaf)) {
    throw ("Missing built plugin for publish mode: {0}. Ensure .aex is built on self-hosted runner (or set AE_PLUGIN_BUILD_DIR)." -f $aexPath)
}

Write-Host ("release aex presence: PASS ({0})" -f $aexPath)
