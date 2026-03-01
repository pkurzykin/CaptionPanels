[CmdletBinding()]
param(
    [string]$Commitish = $env:GITHUB_SHA,
    [string]$MainBranch = "main"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Commitish)) {
    throw "Commitish is empty. Provide -Commitish or set GITHUB_SHA."
}

if ([string]::IsNullOrWhiteSpace($MainBranch)) {
    throw "MainBranch is empty."
}

$gitCmd = Get-Command git -ErrorAction SilentlyContinue
if ($null -eq $gitCmd) {
    throw "git is not available in PATH."
}

$mainRef = "origin/$MainBranch"

& $gitCmd.Source fetch origin $MainBranch --depth=1
if ($LASTEXITCODE -ne 0) {
    throw "Failed to fetch '$mainRef' for lineage validation."
}

& $gitCmd.Source rev-parse --verify $Commitish | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Commitish '$Commitish' is not resolvable."
}

& $gitCmd.Source merge-base --is-ancestor $Commitish $mainRef
if ($LASTEXITCODE -ne 0) {
    throw ("Release commit '{0}' is not reachable from '{1}'. Publish is allowed only for commits in main lineage." -f $Commitish, $mainRef)
}

Write-Host ("release commit lineage: PASS ({0} in {1})" -f $Commitish, $mainRef)
