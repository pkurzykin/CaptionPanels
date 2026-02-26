[CmdletBinding()]
param(
    [string]$PluginName = "CaptionPanels",
    [string]$Version = "",
    [string]$OutDir = "",
    [string]$BuildRoot = "",
    [switch]$AllowMissingAex
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot "paths.ps1")

function Copy-DirectoryFiltered {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination,
        [string[]]$ExcludeDirectoryNames = @(),
        [string[]]$ExcludeFileNames = @()
    )

    if (!(Test-Path -LiteralPath $Source -PathType Container)) {
        throw "Missing source directory: $Source"
    }

    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    $children = Get-ChildItem -LiteralPath $Source -Force

    foreach ($child in $children) {
        if ($child.PSIsContainer) {
            if ($ExcludeDirectoryNames -contains $child.Name) {
                continue
            }

            Copy-DirectoryFiltered `
                -Source $child.FullName `
                -Destination (Join-Path $Destination $child.Name) `
                -ExcludeDirectoryNames $ExcludeDirectoryNames `
                -ExcludeFileNames $ExcludeFileNames
            continue
        }

        if ($ExcludeFileNames -contains $child.Name) {
            continue
        }

        Copy-Item -LiteralPath $child.FullName -Destination (Join-Path $Destination $child.Name) -Force
    }
}

$repoRoot = Get-CaptionPanelsRepoRoot -ScriptRoot $PSScriptRoot
$resolvedBuildRoot = Get-CaptionPanelsBuildRoot -BuildRoot $BuildRoot
$distRoot = Get-CaptionPanelsDistRoot -RepoRoot $repoRoot -OutDir $OutDir
$resolvedVersion = Get-CaptionPanelsVersion -RepoRoot $repoRoot -Version $Version

$packageRoot = Join-Path $distRoot $PluginName
$pluginRoot = Join-Path $packageRoot "plugin"
$toolsRoot = Join-Path $packageRoot "tools"
$aexPath = Get-CaptionPanelsBuiltAexPath -BuildRoot $resolvedBuildRoot -PluginName $PluginName

if (Test-Path -LiteralPath $packageRoot) {
    Remove-Item -LiteralPath $packageRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $pluginRoot -Force | Out-Null
New-Item -ItemType Directory -Path $toolsRoot -Force | Out-Null

$excludedDirs = @("bin", "obj", ".git", ".vs", "x64", "Debug", "Release")
$excludedFiles = @(".DS_Store", "._.DS_Store")

if (Test-Path -LiteralPath $aexPath) {
    Copy-Item -LiteralPath $aexPath -Destination (Join-Path $pluginRoot ($PluginName + ".aex")) -Force
} elseif (!$AllowMissingAex) {
    throw "Missing built plugin: $aexPath. Build Release first or pass -AllowMissingAex."
} else {
    Write-Warning "Built plugin not found, packaging without .aex: $aexPath"
}

$uiRoot = Join-Path $repoRoot "cep_src/ui"
$jsxRoot = Join-Path $repoRoot "cep_src/jsx"
$sharedRoot = Join-Path $repoRoot "cep_src/shared"
$publicApiPath = Join-Path $repoRoot "cep_src/host/public_api.js"

Copy-DirectoryFiltered `
    -Source $uiRoot `
    -Destination (Join-Path $pluginRoot "client") `
    -ExcludeDirectoryNames $excludedDirs `
    -ExcludeFileNames $excludedFiles

Copy-DirectoryFiltered `
    -Source $jsxRoot `
    -Destination (Join-Path $pluginRoot "host") `
    -ExcludeDirectoryNames $excludedDirs `
    -ExcludeFileNames $excludedFiles

if (!(Test-Path -LiteralPath $publicApiPath)) {
    throw "Missing public API layer file: $publicApiPath"
}

Copy-Item -LiteralPath $publicApiPath -Destination (Join-Path $pluginRoot "host/public_api.js") -Force
Copy-Item -LiteralPath (Join-Path $sharedRoot "config.json") -Destination (Join-Path $pluginRoot "config.json") -Force
Copy-Item -LiteralPath (Join-Path $sharedRoot "speakers.json") -Destination (Join-Path $pluginRoot "speakers.json") -Force
Copy-Item -LiteralPath (Join-Path $sharedRoot "config.json") -Destination (Join-Path $packageRoot "config.default.json") -Force

Copy-DirectoryFiltered `
    -Source (Join-Path $repoRoot "tools") `
    -Destination $toolsRoot `
    -ExcludeDirectoryNames $excludedDirs `
    -ExcludeFileNames $excludedFiles

$gitCommit = "unknown"
$gitBranch = "unknown"

try {
    $gitCommit = (git -C $repoRoot rev-parse --short HEAD).Trim()
    $gitBranch = (git -C $repoRoot rev-parse --abbrev-ref HEAD).Trim()
} catch {
    Write-Warning "Unable to read git metadata for BUILDINFO.txt"
}

$buildInfo = @(
    "Package=$PluginName"
    "Version=$resolvedVersion"
    "Branch=$gitBranch"
    "Commit=$gitCommit"
    "GeneratedUtc=$((Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))"
    "RepoRoot=$repoRoot"
    "BuildRoot=$resolvedBuildRoot"
    "AexPath=$aexPath"
    "AexIncluded=$([bool](Test-Path -LiteralPath $aexPath))"
    "Layout=plugin/,tools/,config.default.json"
)

Set-Content -Path (Join-Path $packageRoot "BUILDINFO.txt") -Value $buildInfo -Encoding utf8

Write-Host ("Packaged layout: " + $packageRoot)
