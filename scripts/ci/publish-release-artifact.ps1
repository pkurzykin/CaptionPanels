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

. (Join-Path $PSScriptRoot "release-version-utils.ps1")

$normalizedVersion = Get-NormalizedReleaseVersion -Version $Version

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

$releaseRelativeDir = Join-Path "releases" ("v{0}" -f $normalizedVersion)
$releaseRelativeDir = $releaseRelativeDir -replace "\\", "/"

Push-Location $ReleaseRepoPath
try {
    $insideWorkTree = (git rev-parse --is-inside-work-tree).Trim()
    if ($LASTEXITCODE -ne 0 -or $insideWorkTree -ne "true") {
        throw "Release repository path is not a git working tree: $ReleaseRepoPath"
    }

    $statusLines = @(git status --porcelain)
    if ($LASTEXITCODE -ne 0) {
        throw "git status failed with exit code $LASTEXITCODE"
    }

    $outsideChanges = @()
    foreach ($line in $statusLines) {
        if ([string]::IsNullOrWhiteSpace($line)) {
            continue
        }

        if ($line.Length -lt 4) {
            $outsideChanges += $line
            continue
        }

        $path = $line.Substring(3).Trim()
        $renameParts = $path -split " -> ", 2
        if ($renameParts.Count -eq 2) {
            $path = $renameParts[1].Trim()
        }

        $normalizedPath = $path -replace "\\", "/"
        if ($normalizedPath -eq $releaseRelativeDir -or $normalizedPath.StartsWith($releaseRelativeDir + "/")) {
            continue
        }

        $outsideChanges += $line
    }

    if ($outsideChanges.Count -gt 0) {
        throw ("Release repository has unrelated changes outside '{0}':`n{1}" -f $releaseRelativeDir, ($outsideChanges -join "`n"))
    }

    $destinationDir = Join-Path (Get-Location).Path ("releases/v{0}" -f $normalizedVersion)
    New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null

    $destinationZip = Join-Path $destinationDir $zipFileName
    Copy-Item -LiteralPath $sourceZip -Destination $destinationZip -Force

    $hashPath = Join-Path $destinationDir "sha256.txt"
    (Get-FileHash -LiteralPath $sourceZip -Algorithm SHA256).Hash | Out-File -LiteralPath $hashPath -Encoding ascii

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
