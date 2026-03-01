[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Version,
    [string]$ZipNamePrefix = "CaptionPanels",
    [string]$DistRoot = "dist",
    [switch]$ExportToGitHubEnv
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot "release-version-utils.ps1")

$normalizedVersion = Get-NormalizedReleaseVersion -Version $Version
if ([string]::IsNullOrWhiteSpace($normalizedVersion)) {
    throw "Resolved release version is empty after normalization."
}

$releaseZipPath = Join-Path $DistRoot ("{0}_{1}_win.zip" -f $ZipNamePrefix, $normalizedVersion)
$releaseZipPath = $releaseZipPath.Replace("\", "/")

$pairs = @(
    ("RELEASE_VERSION_NORMALIZED={0}" -f $normalizedVersion),
    ("RELEASE_ZIP_PATH={0}" -f $releaseZipPath)
)

if ($ExportToGitHubEnv) {
    if ([string]::IsNullOrWhiteSpace($env:GITHUB_ENV)) {
        throw "GITHUB_ENV is not set. Use -ExportToGitHubEnv only in GitHub Actions or provide GITHUB_ENV."
    }

    foreach ($pair in $pairs) {
        $pair | Out-File -FilePath $env:GITHUB_ENV -Encoding utf8 -Append
    }
}

foreach ($pair in $pairs) {
    Write-Host $pair
}
