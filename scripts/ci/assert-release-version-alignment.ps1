[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Version,
    [string]$UiCorePath = "cep_src/ui/js/app_core.js"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot "release-version-utils.ps1")

$normalizedVersion = Get-NormalizedReleaseVersion -Version $Version
if ([string]::IsNullOrWhiteSpace($normalizedVersion)) {
    throw "Release version is empty after normalization."
}

if (-not (Test-Path -LiteralPath $UiCorePath -PathType Leaf)) {
    throw "UI core file not found: $UiCorePath"
}

$uiCoreText = Get-Content -LiteralPath $UiCorePath -Raw
if ($uiCoreText -notmatch 'UI_VERSION\s*=\s*"([^"]+)"') {
    throw "Unable to resolve UI_VERSION in $UiCorePath"
}

$uiVersion = $matches[1].Trim()
if ([string]::IsNullOrWhiteSpace($uiVersion)) {
    throw "Resolved UI_VERSION is empty in $UiCorePath"
}

if ($uiVersion -ne $normalizedVersion) {
    throw ("Release tag version '{0}' does not match UI_VERSION '{1}' in {2}" -f $normalizedVersion, $uiVersion, $UiCorePath)
}

Write-Host ("release version alignment: PASS ({0})" -f $normalizedVersion)
