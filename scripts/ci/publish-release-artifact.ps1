[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Version,
    [string]$DistRoot = "dist",
    [string]$ReleaseRepoPath = "release-repo",
    [string]$PluginName = "CaptionPanels",
    [string]$GitUserName = "release-bot",
    [string]$GitUserEmail = "release-bot@users.noreply.github.com",
    [switch]$SkipPush
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$normalizedVersion = $Version.Trim()
if ($normalizedVersion.StartsWith("v")) {
    $normalizedVersion = $normalizedVersion.Substring(1)
}

if ([string]::IsNullOrWhiteSpace($normalizedVersion)) {
    throw "Version is empty after normalization."
}

$zipFileName = "{0}_{1}_win.zip" -f $PluginName, $normalizedVersion
$sourceZip = Join-Path $DistRoot $zipFileName
if (-not (Test-Path -LiteralPath $sourceZip -PathType Leaf)) {
    throw "Missing release artifact: $sourceZip"
}

if (-not (Test-Path -LiteralPath $ReleaseRepoPath -PathType Container)) {
    throw "Release repository path not found: $ReleaseRepoPath"
}

$destinationDir = Join-Path $ReleaseRepoPath ("releases/v{0}" -f $normalizedVersion)
New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
$releaseRelativeDir = Join-Path "releases" ("v{0}" -f $normalizedVersion)
$releaseRelativeDir = $releaseRelativeDir -replace "\\", "/"

$destinationZip = Join-Path $destinationDir $zipFileName
Copy-Item -LiteralPath $sourceZip -Destination $destinationZip -Force

$hashPath = Join-Path $destinationDir "sha256.txt"
(Get-FileHash -LiteralPath $sourceZip -Algorithm SHA256).Hash | Out-File -LiteralPath $hashPath -Encoding ascii

Push-Location $ReleaseRepoPath
try {
    git config user.name $GitUserName
    git config user.email $GitUserEmail

    git add --all -- $releaseRelativeDir
    if ($LASTEXITCODE -ne 0) {
        throw "git add failed with exit code $LASTEXITCODE"
    }

    $pendingChanges = (git diff --cached --name-only -- $releaseRelativeDir) -join ""
    if ([string]::IsNullOrWhiteSpace($pendingChanges)) {
        Write-Host "release publish: nothing to commit"
        return
    }

    git commit -m ("Release v{0}" -f $normalizedVersion) -- $releaseRelativeDir
    if ($LASTEXITCODE -ne 0) {
        throw "git commit failed with exit code $LASTEXITCODE"
    }

    if ($SkipPush) {
        Write-Host "release publish: committed locally (push skipped)"
        return
    }

    git push
    if ($LASTEXITCODE -ne 0) {
        throw "git push failed with exit code $LASTEXITCODE"
    }

    Write-Host "release publish: PASS"
}
finally {
    Pop-Location
}
