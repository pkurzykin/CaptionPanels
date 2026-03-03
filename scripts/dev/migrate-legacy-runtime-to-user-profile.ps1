[CmdletBinding()]
param(
    [string]$LegacyRoot = "C:\CaptionPanelsLocal",
    [string]$PackageRoot = "",
    [string]$TargetRoot = "",
    [switch]$SkipData,
    [switch]$SkipTools,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not $IsWindows) {
    throw "This script is Windows-only. Run it on the target Windows workstation."
}

if ([string]::IsNullOrWhiteSpace($TargetRoot)) {
    $TargetRoot = Join-Path $env:USERPROFILE "CaptionPanelsLocal"
}

function Write-Step {
    param([string]$Message)
    Write-Host ("[STEP] " + $Message)
}

function Write-Info {
    param([string]$Message)
    Write-Host ("[INFO] " + $Message)
}

function Write-WarnMsg {
    param([string]$Message)
    Write-Warning $Message
}

function Ensure-Dir {
    param([Parameter(Mandatory = $true)][string]$Path)
    if ($DryRun) {
        Write-Info ("DRY-RUN mkdir: " + $Path)
        return
    }
    if (!(Test-Path -LiteralPath $Path -PathType Container)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Copy-DirMirror {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    if (!(Test-Path -LiteralPath $Source -PathType Container)) {
        Write-WarnMsg ("Source does not exist, skipping: " + $Source)
        return $false
    }

    Ensure-Dir -Path $Destination

    if ($DryRun) {
        Write-Info ("DRY-RUN copy: " + $Source + " -> " + $Destination)
        return $true
    }

    $null = robocopy $Source $Destination /E /R:2 /W:1 /NFL /NDL /NJH /NJS /NP
    $code = $LASTEXITCODE
    if ($code -ge 8) {
        throw ("robocopy failed: exit code " + $code + " | " + $Source + " -> " + $Destination)
    }
    return $true
}

function Resolve-RepoRoot {
    try {
        return (Resolve-Path (Join-Path $PSScriptRoot "..\..") | Select-Object -ExpandProperty Path)
    } catch {
        return ""
    }
}

function Resolve-PackageToolsRoot {
    param([string]$ResolvedRepoRoot)

    $candidate = [string]$PackageRoot
    if ([string]::IsNullOrWhiteSpace($candidate) -and ![string]::IsNullOrWhiteSpace($ResolvedRepoRoot)) {
        $candidate = Join-Path $ResolvedRepoRoot "dist/CaptionPanels"
    }
    if ([string]::IsNullOrWhiteSpace($candidate)) {
        return ""
    }

    $candidate = [string](Join-Path $candidate ".")
    $leaf = Split-Path -Path $candidate -Leaf
    if ($leaf -ieq "tools") {
        return $candidate
    }
    return (Join-Path $candidate "tools")
}

function Resolve-FirstExistingDirectory {
    param([string[]]$Candidates)
    foreach ($c in $Candidates) {
        if ([string]::IsNullOrWhiteSpace($c)) { continue }
        if (Test-Path -LiteralPath $c -PathType Container) {
            return $c
        }
    }
    return ""
}

function Ensure-AppDataConfigFromTemplate {
    param([string]$ResolvedRepoRoot)

    $appDataDir = Join-Path $env:APPDATA "CaptionPanels"
    $appDataCfg = Join-Path $appDataDir "config.json"
    if (Test-Path -LiteralPath $appDataCfg -PathType Leaf) {
        Write-Info ("AppData config already exists: " + $appDataCfg)
        return
    }

    if ([string]::IsNullOrWhiteSpace($ResolvedRepoRoot)) {
        Write-WarnMsg "Unable to resolve repository root, skip AppData config initialization."
        return
    }

    $templateCandidates = @(
        (Join-Path $ResolvedRepoRoot "dist/CaptionPanels/plugin/config.json"),
        (Join-Path $ResolvedRepoRoot "cep_src/shared/config.json")
    )

    $templatePath = ""
    foreach ($candidate in $templateCandidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            $templatePath = $candidate
            break
        }
    }

    if ([string]::IsNullOrWhiteSpace($templatePath)) {
        Write-WarnMsg "No config template found (dist/CaptionPanels/plugin/config.json or cep_src/shared/config.json)."
        return
    }

    if ($DryRun) {
        Write-Info ("DRY-RUN init config: " + $templatePath + " -> " + $appDataCfg)
        return
    }

    Ensure-Dir -Path $appDataDir
    Copy-Item -LiteralPath $templatePath -Destination $appDataCfg -Force
    Write-Info ("Initialized AppData config: " + $appDataCfg)
}

Write-Host "CaptionPanels runtime migration (legacy -> user-profile)"
Write-Host ("Legacy root: " + $LegacyRoot)
if (![string]::IsNullOrWhiteSpace($PackageRoot)) {
    Write-Host ("Package root (input): " + $PackageRoot)
}
Write-Host ("Target root: " + $TargetRoot)
if ($DryRun) { Write-Host "[MODE] DRY-RUN (no filesystem changes)" }

$legacyTools = Join-Path $LegacyRoot "CaptionPanelTools"
$legacyData = Join-Path $LegacyRoot "CaptionPanelsData"

$targetTools = Join-Path $TargetRoot "CaptionPanelTools"
$targetData = Join-Path $TargetRoot "CaptionPanelsData"
$repoRoot = Resolve-RepoRoot
$packageTools = Resolve-PackageToolsRoot -ResolvedRepoRoot $repoRoot

if (!$SkipTools) {
    Write-Step "Migrate tools root"
    Write-Info ("Tools source candidate #1 (legacy): " + $legacyTools)
    if (![string]::IsNullOrWhiteSpace($packageTools)) {
        Write-Info ("Tools source candidate #2 (package): " + $packageTools)
    }

    $toolsSource = Resolve-FirstExistingDirectory -Candidates @($legacyTools, $packageTools)
    if (![string]::IsNullOrWhiteSpace($toolsSource)) {
        if (([System.IO.Path]::GetFullPath($toolsSource)).TrimEnd('\') -ieq ([System.IO.Path]::GetFullPath($targetTools)).TrimEnd('\')) {
            Write-Info "Tools source equals target, skip copy."
        } else {
            [void](Copy-DirMirror -Source $toolsSource -Destination $targetTools)
        }
    } else {
        Ensure-Dir -Path $targetTools
        $expectedSources = @($legacyTools)
        if (![string]::IsNullOrWhiteSpace($packageTools)) {
            $expectedSources += $packageTools
        }
        Write-WarnMsg ("Tools source not found. Expected one of: " + ($expectedSources -join " OR "))
        Write-WarnMsg "Copy dist/CaptionPanels/tools/* to the target tools root and run this script again."
    }
} else {
    Write-Info "Skip tools migration by flag."
}

if (!$SkipData) {
    Write-Step "Migrate data root"
    if (Test-Path -LiteralPath $legacyData -PathType Container) {
        [void](Copy-DirMirror -Source $legacyData -Destination $targetData)
    } else {
        Ensure-Dir -Path $targetData
        Write-Info ("Legacy data root not found, ensured target data root exists: " + $targetData)
    }
} else {
    Write-Info "Skip data migration by flag."
}

Write-Step "Ensure AppData config exists"
Ensure-AppDataConfigFromTemplate -ResolvedRepoRoot $repoRoot

Write-Step "Validation snapshot"
$checks = @(
    @{ Name = "toolsRoot"; Path = $targetTools; Kind = "dir" },
    @{ Name = "dataRoot"; Path = $targetData; Kind = "dir" },
    @{ Name = "word2json"; Path = (Join-Path $targetTools "word2json/word2json.exe"); Kind = "file" },
    @{ Name = "word2jsonRuntime"; Path = (Join-Path $targetTools "word2json/runtime/win-x64/self-contained/word2json.exe"); Kind = "file" },
    @{ Name = "whisperxPython"; Path = (Join-Path $targetTools "whisperx/.venv/Scripts/python.exe"); Kind = "file" },
    @{ Name = "ffmpeg"; Path = (Join-Path $targetTools "ffmpeg/ffmpeg.exe"); Kind = "file" },
    @{ Name = "appDataConfig"; Path = (Join-Path $env:APPDATA "CaptionPanels/config.json"); Kind = "file" }
)

foreach ($c in $checks) {
    $exists = $false
    if ($c.Kind -eq "dir") {
        $exists = Test-Path -LiteralPath $c.Path -PathType Container
    } else {
        $exists = Test-Path -LiteralPath $c.Path -PathType Leaf
    }
    $state = if ($exists) { "OK" } else { "MISSING" }
    Write-Host (" - " + $c.Name + ": " + $state + " | " + $c.Path)
}

Write-Host "Done."
