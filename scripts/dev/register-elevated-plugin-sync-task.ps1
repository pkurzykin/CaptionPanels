[CmdletBinding()]
param(
    [string]$TaskName = "CaptionPanels Apply Plugin Sync",
    [string]$AePluginDir = "",
    [string]$StagingDir = $(Join-Path $env:USERPROFILE "CaptionPanelsLocal\DevPluginSync\plugin"),
    [string]$PluginName = "CaptionPanels",
    [switch]$SyncAex,
    [switch]$Force
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Test-IsAdministrator {
    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [System.Security.Principal.WindowsPrincipal]::new($identity)
    return $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
}

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

    return (Join-Path $adobeRoot ("Adobe After Effects 2024\Support Files\Plug-ins\" + $PluginName))
}

if (-not $IsWindows) {
    throw "register-elevated-plugin-sync-task.ps1 is Windows-only."
}

if (-not (Test-IsAdministrator)) {
    throw "Run this script from an elevated (Administrator) PowerShell."
}

$resolvedAePluginDir = $AePluginDir
if ([string]::IsNullOrWhiteSpace($resolvedAePluginDir)) {
    $resolvedAePluginDir = Resolve-DefaultAePluginDir -PluginName $PluginName
}
if ([string]::IsNullOrWhiteSpace($resolvedAePluginDir)) {
    throw "Unable to resolve AE Plug-ins directory. Pass -AePluginDir explicitly."
}

New-Item -ItemType Directory -Path $StagingDir -Force | Out-Null
New-Item -ItemType Directory -Path $resolvedAePluginDir -Force | Out-Null

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$applyScriptPath = Join-Path $PSScriptRoot "apply-staged-plugin-sync.ps1"
if (!(Test-Path -LiteralPath $applyScriptPath -PathType Leaf)) {
    throw ("Missing helper script: {0}" -f $applyScriptPath)
}

$pwshCmd = Get-Command pwsh -ErrorAction SilentlyContinue
if ($null -eq $pwshCmd) {
    throw "pwsh executable not found in PATH."
}

$argumentList = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", ('"{0}"' -f $applyScriptPath),
    "-SourceDir", ('"{0}"' -f $StagingDir),
    "-TargetDir", ('"{0}"' -f $resolvedAePluginDir),
    "-PluginName", ('"{0}"' -f $PluginName)
)
if ($SyncAex) {
    $argumentList += "-SyncAex"
}
$arguments = $argumentList -join " "

$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($null -ne $existingTask) {
    if (-not $Force) {
        throw ("Task already exists: {0}. Re-run with -Force to overwrite." -f $TaskName)
    }

    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

$action = New-ScheduledTaskAction `
    -Execute $pwshCmd.Source `
    -Argument $arguments `
    -WorkingDirectory $repoRoot

$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask `
    -TaskName $TaskName `
    -Description "Apply staged CaptionPanels plugin payload into AE Plug-ins with elevated rights." `
    -Action $action `
    -Principal $principal `
    -Settings $settings | Out-Null

Write-Host ("Registered scheduled task: {0}" -f $TaskName)
Write-Host ("Staging dir: {0}" -f $StagingDir)
Write-Host ("AE plugin dir: {0}" -f $resolvedAePluginDir)
Write-Host ""
Write-Host "Run from non-admin shell:"
Write-Host ("  pwsh -NoProfile -File .\scripts\dev\run-elevated-plugin-sync.ps1 -TaskName ""{0}""" -f $TaskName)
