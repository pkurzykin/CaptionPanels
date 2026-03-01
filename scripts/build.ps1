[CmdletBinding()]
param(
    [ValidateSet("Release", "Debug")]
    [string]$Configuration = "Release",
    [string]$Platform = "x64",
    [string]$PluginName = "CaptionPanels",
    [string]$Version = "",
    [string]$BuildRoot = "",
    [string]$OutDir = "",
    [string]$NuGetConfigFile = "",
    [string[]]$NuGetSource = @(),
    [ValidateRange(1, 10)]
    [int]$DotnetRetryCount = 3,
    [ValidateRange(1, 120)]
    [int]$DotnetRetryDelaySeconds = 10,
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
        throw "Command failed with exit code $($LASTEXITCODE): $Executable $($Arguments -join ' ')"
    }
}

function Invoke-ExternalWithRetry {
    param(
        [Parameter(Mandatory = $true)][string]$Executable,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$OperationName,
        [ValidateRange(1, 10)][int]$RetryCount = 3,
        [ValidateRange(1, 120)][int]$RetryDelaySeconds = 10
    )

    for ($attempt = 1; $attempt -le $RetryCount; $attempt++) {
        try {
            Invoke-External -Executable $Executable -Arguments $Arguments
            return
        } catch {
            if ($attempt -ge $RetryCount) {
                throw
            }

            Write-Warning ("{0} failed (attempt {1}/{2}). Retrying in {3}s..." -f $OperationName, $attempt, $RetryCount, $RetryDelaySeconds)
            Start-Sleep -Seconds $RetryDelaySeconds
        }
    }
}

function Acquire-ExclusiveFileLock {
    param(
        [Parameter(Mandatory = $true)][string]$LockPath
    )

    $lockDir = Split-Path -Path $LockPath -Parent
    if (!(Test-Path -LiteralPath $lockDir -PathType Container)) {
        New-Item -ItemType Directory -Path $lockDir -Force | Out-Null
    }

    try {
        $stream = [System.IO.File]::Open(
            $LockPath,
            [System.IO.FileMode]::OpenOrCreate,
            [System.IO.FileAccess]::ReadWrite,
            [System.IO.FileShare]::None
        )
    } catch {
        throw "Another build process is already running (lock: $LockPath). Wait until it completes and retry."
    }

    $lockContent = "pid=$PID`nstartedUtc=$((Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))`n"
    $lockBytes = [System.Text.Encoding]::UTF8.GetBytes($lockContent)
    $stream.SetLength(0)
    $stream.Write($lockBytes, 0, $lockBytes.Length)
    $stream.Flush()

    return $stream
}

function Build-Word2Json {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [Parameter(Mandatory = $true)][string]$Configuration,
        [Parameter(Mandatory = $true)][string]$DistRoot,
        [string]$NuGetConfigFile = "",
        [string[]]$NuGetSource = @(),
        [ValidateRange(1, 10)][int]$DotnetRetryCount = 3,
        [ValidateRange(1, 120)][int]$DotnetRetryDelaySeconds = 10
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

    # Keep dotnet first-run artifacts and NuGet cache inside project build area when env vars are not provided.
    $toolsBuildRoot = Get-CaptionPanelsToolsBuildRoot -DistRoot $DistRoot
    $dotnetCliHome = $env:DOTNET_CLI_HOME
    if ([string]::IsNullOrWhiteSpace($dotnetCliHome)) {
        $dotnetCliHome = Join-Path $toolsBuildRoot "dotnet-home"
        $env:DOTNET_CLI_HOME = $dotnetCliHome
    }

    if (!(Test-Path -LiteralPath $dotnetCliHome -PathType Container)) {
        New-Item -ItemType Directory -Path $dotnetCliHome -Force | Out-Null
    }

    $nugetPackages = $env:NUGET_PACKAGES
    if ([string]::IsNullOrWhiteSpace($nugetPackages)) {
        $nugetPackages = Join-Path $toolsBuildRoot "nuget-packages"
        $env:NUGET_PACKAGES = $nugetPackages
    }

    if (!(Test-Path -LiteralPath $nugetPackages -PathType Container)) {
        New-Item -ItemType Directory -Path $nugetPackages -Force | Out-Null
    }

    if ([string]::IsNullOrWhiteSpace($env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE)) {
        $env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE = "1"
    }
    if ([string]::IsNullOrWhiteSpace($env:DOTNET_CLI_TELEMETRY_OPTOUT)) {
        $env:DOTNET_CLI_TELEMETRY_OPTOUT = "1"
    }

    $resolvedNuGetSources = @(
        $NuGetSource |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
        ForEach-Object { $_.Trim() }
    )

    if (($resolvedNuGetSources.Count -gt 0) -and (-not [string]::IsNullOrWhiteSpace($NuGetConfigFile))) {
        throw "Use either -NuGetConfigFile or -NuGetSource, not both."
    }

    $resolvedNuGetConfig = $NuGetConfigFile
    if ([string]::IsNullOrWhiteSpace($resolvedNuGetConfig)) {
        $resolvedNuGetConfig = Join-Path $toolsBuildRoot "NuGet.Config"
    } elseif (!(Test-Path -LiteralPath $resolvedNuGetConfig -PathType Leaf)) {
        throw "NuGet config file not found: $resolvedNuGetConfig"
    }

    if (($resolvedNuGetSources.Count -gt 0) -or !(Test-Path -LiteralPath $resolvedNuGetConfig -PathType Leaf)) {
        if ($resolvedNuGetSources.Count -eq 0) {
            $resolvedNuGetSources = @("https://api.nuget.org/v3/index.json")
        }

        $nugetConfigContent = @(
            '<?xml version="1.0" encoding="utf-8"?>'
            '<configuration>'
            '  <packageSources>'
            '    <clear />'
        )

        for ($i = 0; $i -lt $resolvedNuGetSources.Count; $i++) {
            $sourceUrl = $resolvedNuGetSources[$i]
            $escapedSourceUrl = [System.Security.SecurityElement]::Escape($sourceUrl)
            $nugetConfigContent += ('    <add key="source{0}" value="{1}" protocolVersion="3" />' -f ($i + 1), $escapedSourceUrl)
        }

        $nugetConfigContent += @(
            '  </packageSources>'
            '</configuration>'
        )

        Set-Content -LiteralPath $resolvedNuGetConfig -Value $nugetConfigContent -Encoding utf8
    }

    Write-Host ("NuGet config: {0}" -f $resolvedNuGetConfig)
    Write-Host ("dotnet retry policy: attempts={0}, delay={1}s" -f $DotnetRetryCount, $DotnetRetryDelaySeconds)

    try {
        Invoke-ExternalWithRetry `
            -Executable $dotnetCmd.Source `
            -Arguments @("restore", $project, "--configfile", $resolvedNuGetConfig) `
            -OperationName "dotnet restore (word2json)" `
            -RetryCount $DotnetRetryCount `
            -RetryDelaySeconds $DotnetRetryDelaySeconds
    } catch {
        $nugetSourcesText = ""
        try {
            $nugetSourcesText = (& $dotnetCmd.Source "nuget" "list" "source" "--configfile" $resolvedNuGetConfig 2>$null | Out-String).Trim()
        } catch {}

        $hint = @(
            "dotnet restore failed for word2json."
            "NuGet client is bundled with .NET SDK; separate nuget.exe installation is usually not required."
            "Check network/proxy access to NuGet feeds and verify configured sources."
            "Helpful checks:"
            "  dotnet --info"
            "  dotnet nuget list source"
        )

        if (![string]::IsNullOrWhiteSpace($nugetSourcesText)) {
            $hint += "Configured sources:"
            $hint += $nugetSourcesText
        }

        throw ($_.Exception.Message + "`n" + ($hint -join "`n"))
    }
    Invoke-External -Executable $dotnetCmd.Source -Arguments @("build", $project, "-c", $Configuration)

    $publishDir = Get-CaptionPanelsWord2JsonPublishRoot -DistRoot $DistRoot
    if (Test-Path -LiteralPath $publishDir) {
        Remove-Item -LiteralPath $publishDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path $publishDir -Force | Out-Null
    Invoke-ExternalWithRetry `
        -Executable $dotnetCmd.Source `
        -Arguments @(
            "publish",
            $project,
            "-c", $Configuration,
            "-r", "win-x64",
            "--self-contained", "true",
            "-o", $publishDir
        ) `
        -OperationName "dotnet publish (word2json)" `
        -RetryCount $DotnetRetryCount `
        -RetryDelaySeconds $DotnetRetryDelaySeconds
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

$buildLockPath = Join-Path $distRoot ".build.lock"
$buildLock = $null

try {
    $buildLock = Acquire-ExclusiveFileLock -LockPath $buildLockPath

    Write-Host ("Configuration: {0}" -f $Configuration)
    Write-Host ("Platform:      {0}" -f $Platform)
    Write-Host ("Build root:    {0}" -f $resolvedBuildRoot)
    Write-Host ("Dist root:     {0}" -f $distRoot)
    Write-Host ("Version:       {0}" -f $resolvedVersion)

    if (!$SkipTools) {
        Build-Word2Json `
            -RepoRoot $repoRoot `
            -Configuration $Configuration `
            -DistRoot $distRoot `
            -NuGetConfigFile $NuGetConfigFile `
            -NuGetSource $NuGetSource `
            -DotnetRetryCount $DotnetRetryCount `
            -DotnetRetryDelaySeconds $DotnetRetryDelaySeconds
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

        $packageParams = @{
            PluginName = $PluginName
            Version    = $resolvedVersion
            OutDir     = $distRoot
            BuildRoot  = $resolvedBuildRoot
        }

        $packageArgsForLog = @(
            "-PluginName", $PluginName,
            "-Version", $resolvedVersion,
            "-OutDir", $distRoot,
            "-BuildRoot", $resolvedBuildRoot
        )

        if ($AllowMissingAex -or $SkipAegp) {
            $packageParams["AllowMissingAex"] = $true
            $packageArgsForLog += "-AllowMissingAex"
        }

        Write-Host ("> {0} {1}" -f $packageScript, ($packageArgsForLog -join " "))
        & $packageScript @packageParams
    } else {
        Write-Host "Skipping packaging (-SkipPackage)."
    }

    Write-Host "Build pipeline completed."
} finally {
    if ($null -ne $buildLock) {
        try {
            $buildLock.Dispose()
        } catch {}
    }

    if (Test-Path -LiteralPath $buildLockPath -PathType Leaf) {
        Remove-Item -LiteralPath $buildLockPath -Force -ErrorAction SilentlyContinue
    }
}
