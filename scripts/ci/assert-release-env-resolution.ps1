[CmdletBinding()]
param(
    [string]$ResolverScriptPath = "scripts/ci/resolve-release-env.ps1"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not (Test-Path -LiteralPath $ResolverScriptPath -PathType Leaf)) {
    throw "Release env resolver script not found: $ResolverScriptPath"
}

function Assert-ResolverCase {
    param(
        [Parameter(Mandatory = $true)][string]$InputVersion,
        [Parameter(Mandatory = $true)][string]$ExpectedNormalizedVersion,
        [Parameter(Mandatory = $true)][string]$ExpectedZipPath
    )

    $tempEnvFile = [System.IO.Path]::GetTempFileName()
    try {
        Remove-Item -LiteralPath $tempEnvFile -Force

        $oldGitHubEnv = $env:GITHUB_ENV
        $env:GITHUB_ENV = $tempEnvFile
        try {
            & $ResolverScriptPath -Version $InputVersion -ExportToGitHubEnv | Out-Null
        } finally {
            $env:GITHUB_ENV = $oldGitHubEnv
        }

        if (-not (Test-Path -LiteralPath $tempEnvFile -PathType Leaf)) {
            throw "Resolver did not write GITHUB_ENV file for input '$InputVersion'."
        }

        $lines = Get-Content -LiteralPath $tempEnvFile
        $map = @{}
        foreach ($line in $lines) {
            if ([string]::IsNullOrWhiteSpace($line)) {
                continue
            }
            $pair = $line -split "=", 2
            if ($pair.Count -ne 2) {
                throw "Unexpected line in resolver output: '$line'"
            }
            $map[$pair[0]] = $pair[1]
        }

        $actualNormalizedVersion = $map["RELEASE_VERSION_NORMALIZED"]
        $actualZipPath = $map["RELEASE_ZIP_PATH"]

        if ($actualNormalizedVersion -ne $ExpectedNormalizedVersion) {
            throw ("Resolver mismatch for '{0}': expected RELEASE_VERSION_NORMALIZED='{1}', got '{2}'" -f $InputVersion, $ExpectedNormalizedVersion, $actualNormalizedVersion)
        }
        if ($actualZipPath -ne $ExpectedZipPath) {
            throw ("Resolver mismatch for '{0}': expected RELEASE_ZIP_PATH='{1}', got '{2}'" -f $InputVersion, $ExpectedZipPath, $actualZipPath)
        }
    } finally {
        if (Test-Path -LiteralPath $tempEnvFile -PathType Leaf) {
            Remove-Item -LiteralPath $tempEnvFile -Force
        }
    }
}

Assert-ResolverCase -InputVersion "v2.4.1" -ExpectedNormalizedVersion "2.4.1" -ExpectedZipPath "dist/CaptionPanels_2.4.1_win.zip"
Assert-ResolverCase -InputVersion "refs/tags/v2.4.1" -ExpectedNormalizedVersion "2.4.1" -ExpectedZipPath "dist/CaptionPanels_2.4.1_win.zip"
Assert-ResolverCase -InputVersion "2.4.1" -ExpectedNormalizedVersion "2.4.1" -ExpectedZipPath "dist/CaptionPanels_2.4.1_win.zip"

Write-Host "release env resolver verification: PASS"
