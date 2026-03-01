[CmdletBinding()]
param(
    [string]$AePluginDir = "C:\CaptionPanelsLocal\DevPluginSync\plugin",
    [string]$PostSyncTaskName = "CaptionPanels Apply Plugin Sync",
    [ValidateRange(1, 60)]
    [int]$WatchIntervalSec = 1,
    [switch]$NoWaitForPostSyncTask
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$syncScript = Join-Path $repoRoot "scripts\dev\sync-plugin.ps1"

if (!(Test-Path -LiteralPath $syncScript -PathType Leaf)) {
    throw ("Missing sync script: {0}" -f $syncScript)
}

Set-Location -LiteralPath $repoRoot

Write-Host "[INFO] Starting CaptionPanels plugin sync watch..."
Write-Host ("[INFO] Repo root: {0}" -f $repoRoot.Path)
Write-Host "[INFO] Press Ctrl+C to stop."
Write-Host ""

$arguments = @{
    AePluginDir       = $AePluginDir
    Watch             = $true
    PostSyncTaskName  = $PostSyncTaskName
    WatchIntervalSec  = $WatchIntervalSec
}

if (!$NoWaitForPostSyncTask) {
    $arguments.WaitForPostSyncTask = $true
}

& $syncScript @arguments
