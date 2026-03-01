[CmdletBinding()]
param(
    [ValidateSet("Source", "Dist")]
    [string]$Mode = "Source",
    [string]$AePluginDir = "",
    [string]$PluginName = "CaptionPanels",
    [string]$BuildRoot = "",
    [switch]$SyncAex,
    [switch]$Watch,
    [string]$PostSyncTaskName = "",
    [switch]$WaitForPostSyncTask,
    [ValidateRange(10, 3600)]
    [int]$PostSyncTaskTimeoutSec = 180,
    [ValidateRange(1, 60)]
    [int]$WatchIntervalSec = 1
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

. (Join-Path (Split-Path -Path $PSScriptRoot -Parent) "paths.ps1")

function Resolve-DefaultAePluginDir {
    param(
        [string]$PluginName = "CaptionPanels"
    )

    $programFiles = $env:ProgramFiles
    if ([string]::IsNullOrWhiteSpace($programFiles)) {
        return $null
    }

    $adobeRoot = Join-Path $programFiles "Adobe"
    if (!(Test-Path -LiteralPath $adobeRoot -PathType Container)) {
        return $null
    }

    $aeCandidates = Get-ChildItem -LiteralPath $adobeRoot -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like "Adobe After Effects *" } |
        Sort-Object Name -Descending

    foreach ($aeDir in $aeCandidates) {
        $pluginPath = Join-Path $aeDir.FullName ("Support Files\Plug-ins\" + $PluginName)
        if (Test-Path -LiteralPath $pluginPath -PathType Container) {
            return $pluginPath
        }
    }

    # Fallback for default AE 2024 location.
    return (Join-Path $adobeRoot ("Adobe After Effects 2024\Support Files\Plug-ins\" + $PluginName))
}

function Ensure-Directory {
    param(
        [Parameter(Mandatory = $true)][string]$Path
    )

    if (!(Test-Path -LiteralPath $Path -PathType Container)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Ensure-WriteAccess {
    param(
        [Parameter(Mandatory = $true)][string]$Path
    )

    $probePath = Join-Path $Path ".cp_sync_probe"
    try {
        Set-Content -LiteralPath $probePath -Value "ok" -Encoding ascii
        Remove-Item -LiteralPath $probePath -Force -ErrorAction SilentlyContinue
    } catch {
        throw ("No write access to {0}. Run elevated PowerShell or use junction/symlink to writable path." -f $Path)
    }
}

function Invoke-RobocopyMirror {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination,
        [string]$ExcludeFileName = ""
    )

    if (!(Test-Path -LiteralPath $Source -PathType Container)) {
        throw ("Missing source directory: {0}" -f $Source)
    }

    Ensure-Directory -Path $Destination

    $robocopyCmd = Get-Command robocopy -ErrorAction SilentlyContinue
    if ($null -eq $robocopyCmd) {
        throw "robocopy is required for sync-plugin.ps1 and is available on Windows."
    }

    $args = @(
        "/MIR",
        "/R:1",
        "/W:1",
        "/NFL",
        "/NDL",
        "/NJH",
        "/NJS",
        "/NP",
        "/XF", ".DS_Store", "._.DS_Store"
    )

    if (![string]::IsNullOrWhiteSpace($ExcludeFileName)) {
        $args += @("/XF", $ExcludeFileName)
    }

    & $robocopyCmd.Source $Source $Destination @args | Out-Null
    $exitCode = $LASTEXITCODE

    if ($exitCode -ge 8) {
        throw ("robocopy failed (exit code {0}) for {1} -> {2}" -f $exitCode, $Source, $Destination)
    }
}

function Copy-FileChecked {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    if (!(Test-Path -LiteralPath $Source -PathType Leaf)) {
        throw ("Missing source file: {0}" -f $Source)
    }

    $destinationDir = Split-Path -Path $Destination -Parent
    Ensure-Directory -Path $destinationDir
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
}

function Invoke-PostSyncTask {
    param(
        [Parameter(Mandatory = $true)][string]$TaskName,
        [switch]$WaitForCompletion,
        [ValidateRange(10, 3600)][int]$TimeoutSec = 180
    )

    if ([string]::IsNullOrWhiteSpace($TaskName)) {
        return
    }

    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($null -eq $task) {
        throw ("Scheduled task not found: {0}. Register it first via scripts/dev/register-elevated-plugin-sync-task.ps1." -f $TaskName)
    }

    Start-ScheduledTask -TaskName $TaskName
    Write-Host ("Triggered scheduled task: {0}" -f $TaskName)

    if (-not $WaitForCompletion) {
        return
    }

    $deadlineUtc = (Get-Date).ToUniversalTime().AddSeconds($TimeoutSec)
    while ($true) {
        Start-Sleep -Seconds 1
        $state = (Get-ScheduledTask -TaskName $TaskName).State
        if ($state -ne "Running") {
            break
        }

        if ((Get-Date).ToUniversalTime() -ge $deadlineUtc) {
            throw ("Scheduled task timeout ({0}s): {1}" -f $TimeoutSec, $TaskName)
        }
    }

    $taskInfo = Get-ScheduledTaskInfo -TaskName $TaskName
    if ($taskInfo.LastTaskResult -ne 0) {
        throw ("Scheduled task failed (LastTaskResult={0}): {1}" -f $taskInfo.LastTaskResult, $TaskName)
    }

    Write-Host ("Scheduled task completed: {0}" -f $TaskName)
}

function Get-TreeFingerprint {
    param(
        [Parameter(Mandatory = $true)][string[]]$Paths
    )

    $entries = @()

    foreach ($path in $Paths) {
        if (!(Test-Path -LiteralPath $path)) {
            $entries += ("missing|{0}" -f $path)
            continue
        }

        if (Test-Path -LiteralPath $path -PathType Leaf) {
            $item = Get-Item -LiteralPath $path -Force
            $entries += ("file|{0}|{1}|{2}" -f $item.FullName, $item.Length, $item.LastWriteTimeUtc.Ticks)
            continue
        }

        $files = Get-ChildItem -LiteralPath $path -Recurse -File -Force -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -notin @(".DS_Store", "._.DS_Store") } |
            Sort-Object FullName

        foreach ($file in $files) {
            $entries += ("file|{0}|{1}|{2}" -f $file.FullName, $file.Length, $file.LastWriteTimeUtc.Ticks)
        }
    }

    $serialized = ($entries -join "`n")
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($serialized)
    $hashBytes = [System.Security.Cryptography.SHA256]::HashData($bytes)
    return ([System.Convert]::ToHexString($hashBytes))
}

function Sync-PluginPayload {
    param(
        [Parameter(Mandatory = $true)][hashtable]$Context
    )

    $timestamp = (Get-Date).ToString("HH:mm:ss")
    Write-Host ("[{0}] Sync start (Mode={1})" -f $timestamp, $Context.Mode)

    if ($Context.Mode -eq "Source") {
        Invoke-RobocopyMirror -Source $Context.UiRoot -Destination (Join-Path $Context.TargetRoot "client")
        Invoke-RobocopyMirror -Source $Context.JsxRoot -Destination (Join-Path $Context.TargetRoot "host")
        Copy-FileChecked -Source $Context.PublicApiPath -Destination (Join-Path $Context.TargetRoot "host/public_api.js")
        Copy-FileChecked -Source $Context.ConfigPath -Destination (Join-Path $Context.TargetRoot "config.json")
        Copy-FileChecked -Source $Context.SpeakersPath -Destination (Join-Path $Context.TargetRoot "speakers.json")
    } else {
        $excludeAexName = ""
        if (-not $Context.SyncAex) {
            $excludeAexName = ($Context.PluginName + ".aex")
        }

        Invoke-RobocopyMirror `
            -Source $Context.DistPluginRoot `
            -Destination $Context.TargetRoot `
            -ExcludeFileName $excludeAexName
    }

    if ($Context.SyncAex) {
        Copy-FileChecked `
            -Source $Context.BuiltAexPath `
            -Destination (Join-Path $Context.TargetRoot ($Context.PluginName + ".aex"))
    }

    if (![string]::IsNullOrWhiteSpace($Context.PostSyncTaskName)) {
        Invoke-PostSyncTask `
            -TaskName $Context.PostSyncTaskName `
            -WaitForCompletion:$Context.WaitForPostSyncTask `
            -TimeoutSec $Context.PostSyncTaskTimeoutSec
    }

    $doneTimestamp = (Get-Date).ToString("HH:mm:ss")
    Write-Host ("[{0}] Sync complete -> {1}" -f $doneTimestamp, $Context.TargetRoot)
}

if (-not $IsWindows) {
    throw "sync-plugin.ps1 is Windows-only (target: After Effects Plug-ins on Windows)."
}

$repoRoot = Get-CaptionPanelsRepoRoot -ScriptRoot (Split-Path -Path $PSScriptRoot -Parent)
$resolvedAePluginDir = $AePluginDir
if ([string]::IsNullOrWhiteSpace($resolvedAePluginDir)) {
    $resolvedAePluginDir = Resolve-DefaultAePluginDir -PluginName $PluginName
}
if ([string]::IsNullOrWhiteSpace($resolvedAePluginDir)) {
    throw "Unable to resolve AE Plug-ins directory. Pass -AePluginDir explicitly."
}

Ensure-Directory -Path $resolvedAePluginDir
Ensure-WriteAccess -Path $resolvedAePluginDir

$resolvedBuildRoot = Get-CaptionPanelsBuildRoot -BuildRoot $BuildRoot
$builtAexPath = Get-CaptionPanelsBuiltAexPath -BuildRoot $resolvedBuildRoot -PluginName $PluginName

$syncContext = @{
    Mode                   = $Mode
    PluginName             = $PluginName
    SyncAex                = [bool]$SyncAex
    TargetRoot             = $resolvedAePluginDir
    BuiltAexPath           = $builtAexPath
    PostSyncTaskName       = $PostSyncTaskName
    WaitForPostSyncTask    = [bool]$WaitForPostSyncTask
    PostSyncTaskTimeoutSec = $PostSyncTaskTimeoutSec
}

$watchPaths = @()

if ($Mode -eq "Source") {
    $uiRoot = Join-Path $repoRoot "cep_src/ui"
    $jsxRoot = Join-Path $repoRoot "cep_src/jsx"
    $publicApiPath = Join-Path $repoRoot "cep_src/host/public_api.js"
    $configPath = Join-Path $repoRoot "cep_src/shared/config.json"
    $speakersPath = Join-Path $repoRoot "cep_src/shared/speakers.json"

    foreach ($requiredPath in @($uiRoot, $jsxRoot, $publicApiPath, $configPath, $speakersPath)) {
        if (!(Test-Path -LiteralPath $requiredPath)) {
            throw ("Missing required source path: {0}" -f $requiredPath)
        }
    }

    $syncContext["UiRoot"] = $uiRoot
    $syncContext["JsxRoot"] = $jsxRoot
    $syncContext["PublicApiPath"] = $publicApiPath
    $syncContext["ConfigPath"] = $configPath
    $syncContext["SpeakersPath"] = $speakersPath

    $watchPaths += @($uiRoot, $jsxRoot, $publicApiPath, $configPath, $speakersPath)
} else {
    $distPluginRoot = Join-Path $repoRoot "dist/$PluginName/plugin"
    if (!(Test-Path -LiteralPath $distPluginRoot -PathType Container)) {
        throw ("Missing dist plugin payload: {0}. Run scripts/package.ps1 first." -f $distPluginRoot)
    }

    $syncContext["DistPluginRoot"] = $distPluginRoot
    $watchPaths += $distPluginRoot
}

if ($SyncAex) {
    if (!(Test-Path -LiteralPath $builtAexPath -PathType Leaf)) {
        throw ("-SyncAex was requested, but built .aex was not found: {0}" -f $builtAexPath)
    }

    $watchPaths += $builtAexPath
}

Write-Host ("Target AE plugin dir: {0}" -f $resolvedAePluginDir)
if ($SyncAex) {
    Write-Host ("AEX sync enabled: {0}" -f $builtAexPath)
} else {
    Write-Host "AEX sync disabled (default). Existing .aex in Plug-ins is preserved."
}
if (![string]::IsNullOrWhiteSpace($PostSyncTaskName)) {
    Write-Host ("Post-sync scheduled task: {0}" -f $PostSyncTaskName)
}

Sync-PluginPayload -Context $syncContext

if ($Watch) {
    Write-Host ("Watch mode enabled. Poll interval: {0}s" -f $WatchIntervalSec)
    $previousFingerprint = Get-TreeFingerprint -Paths $watchPaths

    while ($true) {
        Start-Sleep -Seconds $WatchIntervalSec
        $currentFingerprint = Get-TreeFingerprint -Paths $watchPaths
        if ($currentFingerprint -eq $previousFingerprint) {
            continue
        }

        try {
            Sync-PluginPayload -Context $syncContext
        } catch {
            Write-Warning ("Sync failed: {0}" -f $_.Exception.Message)
        } finally {
            $previousFingerprint = $currentFingerprint
        }
    }
}
