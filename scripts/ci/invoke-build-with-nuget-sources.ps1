[CmdletBinding()]
param(
    [ValidateSet("Release", "Debug")]
    [string]$BuildConfiguration = "Release",
    [switch]$SkipTools,
    [switch]$SkipAegp,
    [switch]$SkipPackage,
    [switch]$AllowMissingAex,
    [string]$NuGetSourcesPrimary = "",
    [string]$NuGetSourcesFallback = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$buildScript = Join-Path $PSScriptRoot "..\build.ps1"
$buildScript = (Resolve-Path -LiteralPath $buildScript).Path

$buildParams = @{
    Configuration = $BuildConfiguration
}
if ($SkipTools) {
    $buildParams["SkipTools"] = $true
}
if ($SkipAegp) {
    $buildParams["SkipAegp"] = $true
}
if ($SkipPackage) {
    $buildParams["SkipPackage"] = $true
}
if ($AllowMissingAex) {
    $buildParams["AllowMissingAex"] = $true
}

$nugetSourcesRaw = $NuGetSourcesPrimary
if ([string]::IsNullOrWhiteSpace($nugetSourcesRaw)) {
    $nugetSourcesRaw = $NuGetSourcesFallback
}

if (-not [string]::IsNullOrWhiteSpace($nugetSourcesRaw)) {
    $sources = @(
        $nugetSourcesRaw -split "[,;`r`n]+" |
        ForEach-Object { $_.Trim() } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    )

    if ($sources.Count -gt 0) {
        $buildParams["NuGetSource"] = $sources
    }
}

& $buildScript @buildParams
