[CmdletBinding()]
param(
    [string]$OutDir = "",
    [switch]$RemoveBuildCache,
    [switch]$RemoveArchives
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot "paths.ps1")

function Remove-PathIfExists {
    param(
        [Parameter(Mandatory = $true)][string]$LiteralPath
    )

    if (!(Test-Path -LiteralPath $LiteralPath)) {
        return $false
    }

    Remove-Item -LiteralPath $LiteralPath -Recurse -Force
    return $true
}

$repoRoot = Get-CaptionPanelsRepoRoot -ScriptRoot $PSScriptRoot
$distRoot = Get-CaptionPanelsDistRoot -RepoRoot $repoRoot -OutDir $OutDir

if (!(Test-Path -LiteralPath $distRoot -PathType Container)) {
    Write-Host ("dist root does not exist, nothing to clean: {0}" -f $distRoot)
    exit 0
}

$removed = @()

# Remove stale lock files that can remain after interrupted runs.
foreach ($lockName in @(".build.lock", ".package.lock")) {
    $lockPath = Join-Path $distRoot $lockName
    if (Remove-PathIfExists -LiteralPath $lockPath) {
        $removed += $lockPath
    }
}

# Remove temporary release smoke folders.
$tempDirs = Get-ChildItem -LiteralPath $distRoot -Directory -Force |
    Where-Object { $_.Name -like "_tmp*" }
foreach ($dir in $tempDirs) {
    if (Remove-PathIfExists -LiteralPath $dir.FullName) {
        $removed += $dir.FullName
    }
}

# Remove legacy top-level build folders no longer used by the dist contract.
foreach ($legacyDirName in @("word2json")) {
    $legacyDirPath = Join-Path $distRoot $legacyDirName
    if (Remove-PathIfExists -LiteralPath $legacyDirPath) {
        $removed += $legacyDirPath
    }
}

# Remove platform metadata files that should never be part of payload.
$metadataFiles = Get-ChildItem -LiteralPath $distRoot -Recurse -Force -File -ErrorAction SilentlyContinue |
    Where-Object { ($_.Name -eq ".DS_Store") -or ($_.Name -eq "._.DS_Store") }
foreach ($file in $metadataFiles) {
    if (Remove-PathIfExists -LiteralPath $file.FullName) {
        $removed += $file.FullName
    }
}

if ($RemoveBuildCache) {
    $buildCacheRoot = Join-Path $distRoot "_build"
    if (Remove-PathIfExists -LiteralPath $buildCacheRoot) {
        $removed += $buildCacheRoot
    }
}

if ($RemoveArchives) {
    $archives = Get-ChildItem -LiteralPath $distRoot -File -Force |
        Where-Object { $_.Name -match '^CaptionPanels_.+_win\.zip$' }
    foreach ($archive in $archives) {
        if (Remove-PathIfExists -LiteralPath $archive.FullName) {
            $removed += $archive.FullName
        }
    }
}

Write-Host ("Cleaned dist root: {0}" -f $distRoot)
Write-Host ("Removed entries: {0}" -f $removed.Count)
foreach ($entry in $removed) {
    Write-Host (" - {0}" -f $entry)
}
