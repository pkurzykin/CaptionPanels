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
    try {
        Remove-Item -LiteralPath $packageRoot -Recurse -Force -ErrorAction Stop
    } catch {
        if (Test-Path -LiteralPath $packageRoot) {
            Start-Sleep -Milliseconds 200
            Remove-Item -LiteralPath $packageRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    if (Test-Path -LiteralPath $packageRoot) {
        throw "Failed to clean package root: $packageRoot"
    }
}

New-Item -ItemType Directory -Path $pluginRoot -Force | Out-Null
New-Item -ItemType Directory -Path $toolsRoot -Force | Out-Null

$pluginExcludedDirs = @("bin", "obj", ".git", ".vs", "x64", "Debug", "Release")
$toolsExcludedDirs = @("bin", "obj", "x64", ".git", ".vs", "Debug", "Release")
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
    -ExcludeDirectoryNames $pluginExcludedDirs `
    -ExcludeFileNames $excludedFiles

Copy-DirectoryFiltered `
    -Source $jsxRoot `
    -Destination (Join-Path $pluginRoot "host") `
    -ExcludeDirectoryNames $pluginExcludedDirs `
    -ExcludeFileNames $excludedFiles

if (!(Test-Path -LiteralPath $publicApiPath)) {
    throw "Missing public API layer file: $publicApiPath"
}

Copy-Item -LiteralPath $publicApiPath -Destination (Join-Path $pluginRoot "host/public_api.js") -Force
Copy-Item -LiteralPath (Join-Path $sharedRoot "config.json") -Destination (Join-Path $pluginRoot "config.json") -Force
Copy-Item -LiteralPath (Join-Path $sharedRoot "speakers.json") -Destination (Join-Path $pluginRoot "speakers.json") -Force
Copy-Item -LiteralPath (Join-Path $sharedRoot "config.json") -Destination (Join-Path $packageRoot "config.default.json") -Force

$toolsSourceRoot = Join-Path $repoRoot "tools"
$toolFolders = @("word2json", "transcribe_align", "deploy")
foreach ($toolFolder in $toolFolders) {
    $toolSource = Join-Path $toolsSourceRoot $toolFolder
    if (!(Test-Path -LiteralPath $toolSource -PathType Container)) {
        throw "Missing tool source directory: $toolSource"
    }

    Copy-DirectoryFiltered `
        -Source $toolSource `
        -Destination (Join-Path $toolsRoot $toolFolder) `
        -ExcludeDirectoryNames $toolsExcludedDirs `
        -ExcludeFileNames $excludedFiles
}

$word2jsonPublishRoot = Get-CaptionPanelsWord2JsonPublishRoot -DistRoot $distRoot
$word2jsonRuntimeIncluded = $false
if (Test-Path -LiteralPath $word2jsonPublishRoot -PathType Container) {
    $word2jsonToolRoot = Join-Path $toolsRoot "word2json"
    $word2jsonRuntimeRoot = Join-Path $word2jsonToolRoot "runtime/win-x64/self-contained"

    Copy-DirectoryFiltered `
        -Source $word2jsonPublishRoot `
        -Destination $word2jsonRuntimeRoot `
        -ExcludeFileNames $excludedFiles

    $word2jsonExePath = Join-Path $word2jsonPublishRoot "word2json.exe"
    if (Test-Path -LiteralPath $word2jsonExePath -PathType Leaf) {
        Copy-Item -LiteralPath $word2jsonExePath -Destination (Join-Path $word2jsonToolRoot "word2json.exe") -Force
    }

    $word2jsonRulesPath = Join-Path $word2jsonPublishRoot "word2json.rules.json"
    if (Test-Path -LiteralPath $word2jsonRulesPath -PathType Leaf) {
        Copy-Item -LiteralPath $word2jsonRulesPath -Destination (Join-Path $word2jsonToolRoot "word2json.rules.json") -Force
    }

    $word2jsonRuntimeIncluded = $true
}

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
    "Word2JsonPublishRoot=$word2jsonPublishRoot"
    "Word2JsonRuntimeIncluded=$word2jsonRuntimeIncluded"
    "Layout=plugin/,tools/,config.default.json"
)

Set-Content -Path (Join-Path $packageRoot "BUILDINFO.txt") -Value $buildInfo -Encoding utf8

Write-Host ("Packaged layout: " + $packageRoot)
