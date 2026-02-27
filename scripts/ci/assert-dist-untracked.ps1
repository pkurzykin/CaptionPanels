[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$trackedDist = git ls-files -- dist
if (-not [string]::IsNullOrWhiteSpace($trackedDist)) {
    Write-Host $trackedDist
    throw "Policy violation: dist/ contains tracked files. dist/ must remain build output only."
}

Write-Host "dist tracking policy: PASS"
