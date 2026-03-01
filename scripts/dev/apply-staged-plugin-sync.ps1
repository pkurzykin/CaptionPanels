[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$SourceDir,
    [Parameter(Mandatory = $true)][string]$TargetDir,
    [string]$PluginName = "CaptionPanels",
    [switch]$SyncAex
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

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

    $probePath = Join-Path $Path ".cp_apply_probe"
    try {
        Set-Content -LiteralPath $probePath -Value "ok" -Encoding ascii
        Remove-Item -LiteralPath $probePath -Force -ErrorAction SilentlyContinue
    } catch {
        throw ("No write access to {0}." -f $Path)
    }
}

function Invoke-RobocopyMirror {
    param(
        [Parameter(Mandatory = $true)][string]$From,
        [Parameter(Mandatory = $true)][string]$To,
        [string]$ExcludeFileName = ""
    )

    $robocopyCmd = Get-Command robocopy -ErrorAction SilentlyContinue
    if ($null -eq $robocopyCmd) {
        throw "robocopy is required on Windows."
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

    & $robocopyCmd.Source $From $To @args | Out-Null
    $exitCode = $LASTEXITCODE
    if ($exitCode -ge 8) {
        throw ("robocopy failed (exit code {0}) for {1} -> {2}" -f $exitCode, $From, $To)
    }
}

if (-not $IsWindows) {
    throw "apply-staged-plugin-sync.ps1 is Windows-only."
}

if (!(Test-Path -LiteralPath $SourceDir -PathType Container)) {
    throw ("Staging source directory not found: {0}" -f $SourceDir)
}

Ensure-Directory -Path $TargetDir
Ensure-WriteAccess -Path $TargetDir

$excludeAexName = ""
if (-not $SyncAex) {
    $excludeAexName = ($PluginName + ".aex")
}

Invoke-RobocopyMirror -From $SourceDir -To $TargetDir -ExcludeFileName $excludeAexName

if ($SyncAex) {
    $aexFileName = ($PluginName + ".aex")
    $sourceAexPath = Join-Path $SourceDir $aexFileName
    if (Test-Path -LiteralPath $sourceAexPath -PathType Leaf) {
        Copy-Item -LiteralPath $sourceAexPath -Destination (Join-Path $TargetDir $aexFileName) -Force
    } else {
        throw ("-SyncAex requested, but staged AEX is missing: {0}" -f $sourceAexPath)
    }
}

Write-Host ("Applied staged plugin sync: {0} -> {1}" -f $SourceDir, $TargetDir)
