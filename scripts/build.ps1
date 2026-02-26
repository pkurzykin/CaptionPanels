[CmdletBinding()]
param(
    [ValidateSet("Release", "Debug")]
    [string]$Configuration = "Release",
    [string]$Platform = "x64",
    [string]$PluginName = "CaptionPanels",
    [string]$Version = "",
    [string]$BuildRoot = "",
    [string]$OutDir = "",
    [switch]$SkipTools,
    [switch]$SkipAegp,
    [switch]$SkipPackage,
    [switch]$AllowMissingAex
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot "paths.ps1")

function Get-MsBuildPath {
    $msbuildCmd = Get-Command msbuild -ErrorAction SilentlyContinue
    if ($null -ne $msbuildCmd) {
        return $msbuildCmd.Source
    }

    if (![string]::IsNullOrWhiteSpace(${env:ProgramFiles(x86)})) {
        $vswhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
        if (Test-Path -LiteralPath $vswhere) {
            $installPath = & $vswhere -latest -products * -requires Microsoft.Component.MSBuild -property installationPath
            if ($LASTEXITCODE -eq 0 -and ![string]::IsNullOrWhiteSpace($installPath)) {
                $candidate = Join-Path $installPath.Trim() "MSBuild\Current\Bin\MSBuild.exe"
                if (Test-Path -LiteralPath $candidate) {
                    return $candidate
                }
            }
        }
    }

    return $null
}

function Invoke-External {
    param(
        [Parameter(Mandatory = $true)][string]$Executable,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    Write-Host ("> {0} {1}" -f $Executable, ($Arguments -join " "))
    & $Executable @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code $LASTEXITCODE: $Executable $($Arguments -join ' ')"
    }
}

function Build-Word2Json {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [Parameter(Mandatory = $true)][string]$Configuration,
        [Parameter(Mandatory = $true)][string]$DistRoot
    )

    $project = Join-Path $RepoRoot "tools/word2json/src/Word2Json/Word2Json.csproj"
    if (!(Test-Path -LiteralPath $project)) {
        Write-Host "word2json project not found, skipping tool build."
        return
    }

    $dotnetCmd = Get-Command dotnet -ErrorAction SilentlyContinue
    if ($null -eq $dotnetCmd) {
        throw "dotnet SDK not found. Install .NET SDK 8+ or run with -SkipTools."
    }

    Invoke-External -Executable $dotnetCmd.Source -Arguments @("restore", $project)
    Invoke-External -Executable $dotnetCmd.Source -Arguments @("build", $project, "-c", $Configuration)

    $publishDir = Join-Path $DistRoot "word2json/win-x64/self-contained/publish"
    New-Item -ItemType Directory -Path $publishDir -Force | Out-Null
    Invoke-External -Executable $dotnetCmd.Source -Arguments @(
        "publish",
        $project,
        "-c", $Configuration,
        "-r", "win-x64",
        "--self-contained", "true",
        "-o", $publishDir
    )
}

function Build-Aegp {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [Parameter(Mandatory = $true)][string]$Configuration,
        [Parameter(Mandatory = $true)][string]$Platform,
        [Parameter(Mandatory = $true)][string]$BuildRoot
    )

    $solution = Join-Path $RepoRoot "aegp_src/CaptionPanels/Win/CaptionPanels.sln"
    if (!(Test-Path -LiteralPath $solution)) {
        Write-Warning "AEGP solution not found: $solution. Skipping AEGP build."
        return
    }

    $msbuildPath = Get-MsBuildPath
    if ([string]::IsNullOrWhiteSpace($msbuildPath)) {
        Write-Warning "MSBuild not found. Skipping AEGP build."
        return
    }

    $env:AE_PLUGIN_BUILD_DIR = $BuildRoot
    Invoke-External -Executable $msbuildPath -Arguments @(
        $solution,
        "/m",
        "/t:Build",
        "/p:Configuration=$Configuration;Platform=$Platform;AE_PLUGIN_BUILD_DIR=$BuildRoot"
    )
}

$repoRoot = Get-CaptionPanelsRepoRoot -ScriptRoot $PSScriptRoot
$resolvedBuildRoot = Get-CaptionPanelsBuildRoot -BuildRoot $BuildRoot
$distRoot = Get-CaptionPanelsDistRoot -RepoRoot $repoRoot -OutDir $OutDir
$resolvedVersion = Get-CaptionPanelsVersion -RepoRoot $repoRoot -Version $Version

Write-Host ("Configuration: {0}" -f $Configuration)
Write-Host ("Platform:      {0}" -f $Platform)
Write-Host ("Build root:    {0}" -f $resolvedBuildRoot)
Write-Host ("Dist root:     {0}" -f $distRoot)
Write-Host ("Version:       {0}" -f $resolvedVersion)

if (!$SkipTools) {
    Build-Word2Json -RepoRoot $repoRoot -Configuration $Configuration -DistRoot $distRoot
} else {
    Write-Host "Skipping tools build (-SkipTools)."
}

if (!$SkipAegp) {
    Build-Aegp -RepoRoot $repoRoot -Configuration $Configuration -Platform $Platform -BuildRoot $resolvedBuildRoot
} else {
    Write-Host "Skipping AEGP build (-SkipAegp)."
}

if (!$SkipPackage) {
    $packageScript = Join-Path $PSScriptRoot "package.ps1"
    if (!(Test-Path -LiteralPath $packageScript)) {
        throw "Missing package script: $packageScript"
    }

    $packageArgs = @(
        "-PluginName", $PluginName,
        "-Version", $resolvedVersion,
        "-OutDir", $distRoot,
        "-BuildRoot", $resolvedBuildRoot
    )

    if ($AllowMissingAex -or $SkipAegp) {
        $packageArgs += "-AllowMissingAex"
    }

    Write-Host ("> {0} {1}" -f $packageScript, ($packageArgs -join " "))
    & $packageScript @packageArgs
} else {
    Write-Host "Skipping packaging (-SkipPackage)."
}

Write-Host "Build pipeline completed."
