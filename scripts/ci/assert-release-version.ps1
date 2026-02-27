[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Version
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot "release-version-utils.ps1")

$normalizedVersion = Get-NormalizedReleaseVersion -Version $Version

if ([string]::IsNullOrWhiteSpace($normalizedVersion)) {
    throw "Release version is empty after normalization. Expected: vMAJOR.MINOR.PATCH"
}

if ($normalizedVersion -notmatch '^[0-9]+\.[0-9]+\.[0-9]+$') {
    throw ("Invalid release version '{0}'. Expected semantic version: vMAJOR.MINOR.PATCH" -f $Version)
}

Write-Host ("release version validation: PASS ({0})" -f $normalizedVersion)
