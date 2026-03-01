[CmdletBinding()]
param(
    [string]$Version = "",
    [string]$OutDir = "",
    [string]$PluginName = "CaptionPanels",
    [string]$BuildRoot = "",
    [switch]$AllowMissingAex
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot "paths.ps1")

$repoRoot = Get-CaptionPanelsRepoRoot -ScriptRoot $PSScriptRoot
$distRoot = Get-CaptionPanelsDistRoot -RepoRoot $repoRoot -OutDir $OutDir
$resolvedBuildRoot = Get-CaptionPanelsBuildRoot -BuildRoot $BuildRoot
$resolvedVersion = Get-CaptionPanelsVersion -RepoRoot $repoRoot -Version $Version

$packageScript = Join-Path $PSScriptRoot "package.ps1"
if (!(Test-Path -LiteralPath $packageScript -PathType Leaf)) {
    throw "Missing package script: $packageScript"
}

$packageParams = @{
    PluginName = $PluginName
    Version    = $resolvedVersion
    OutDir     = $distRoot
    BuildRoot  = $resolvedBuildRoot
}
if ($AllowMissingAex) {
    $packageParams["AllowMissingAex"] = $true
}

Write-Host ("Packaging dist layout via package.ps1 (Version={0})" -f $resolvedVersion)
& $packageScript @packageParams

$stageRoot = Join-Path $distRoot $PluginName
if (!(Test-Path -LiteralPath $stageRoot -PathType Container)) {
    throw "Expected package root not found after package.ps1: $stageRoot"
}

$zipPath = Join-Path $distRoot ($PluginName + "_" + $resolvedVersion + "_win.zip")
if (Test-Path -LiteralPath $zipPath -PathType Leaf) {
    Remove-Item -LiteralPath $zipPath -Force
}

Compress-Archive -Path (Join-Path $stageRoot "*") -DestinationPath $zipPath

Write-Host ("Packaged: " + $zipPath)
