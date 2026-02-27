[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Version,
    [string]$UiCorePath = "cep_src/ui/js/app_core.js"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Normalize-VersionString {
    param([string]$Value)

    $v = $Value.Trim()
    if ($v.StartsWith("refs/tags/")) {
        $v = $v.Substring("refs/tags/".Length)
    }
    if ($v.StartsWith("v")) {
        $v = $v.Substring(1)
    }
    return $v
}

$normalizedVersion = Normalize-VersionString -Value $Version
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
