[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Version
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$raw = $Version.Trim()
if ($raw.StartsWith("refs/tags/")) {
    $raw = $raw.Substring("refs/tags/".Length)
}

if ($raw.StartsWith("v")) {
    $raw = $raw.Substring(1)
}

if ([string]::IsNullOrWhiteSpace($raw)) {
    throw "Release version is empty after normalization. Expected: vMAJOR.MINOR.PATCH"
}

if ($raw -notmatch '^[0-9]+\.[0-9]+\.[0-9]+$') {
    throw ("Invalid release version '{0}'. Expected semantic version: vMAJOR.MINOR.PATCH" -f $Version)
}

Write-Host ("release version validation: PASS ({0})" -f $raw)
