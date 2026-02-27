[CmdletBinding()]
param(
    [string]$ReleaseRepo = $env:RELEASE_REPO,
    [string]$ReleaseRepoToken = $env:RELEASE_REPO_TOKEN
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($ReleaseRepo)) {
    throw "Missing required secret: RELEASE_REPO"
}

if ([string]::IsNullOrWhiteSpace($ReleaseRepoToken)) {
    throw "Missing required secret: RELEASE_REPO_TOKEN"
}

Write-Host "release secrets validation: PASS"
