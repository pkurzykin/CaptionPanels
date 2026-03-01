[CmdletBinding()]
param(
    [string]$TaskName = "CaptionPanels Apply Plugin Sync",
    [switch]$Wait,
    [ValidateRange(10, 3600)]
    [int]$TimeoutSec = 180
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not $IsWindows) {
    throw "run-elevated-plugin-sync.ps1 is Windows-only."
}

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($null -eq $task) {
    throw ("Scheduled task not found: {0}. Run scripts/dev/register-elevated-plugin-sync-task.ps1 as Administrator first." -f $TaskName)
}

Start-ScheduledTask -TaskName $TaskName
Write-Host ("Triggered scheduled task: {0}" -f $TaskName)

if (-not $Wait) {
    exit 0
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
