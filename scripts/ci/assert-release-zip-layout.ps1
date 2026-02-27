[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Version,
    [string]$DistRoot = "dist"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$normalizedVersion = $Version.Trim()
if ($normalizedVersion.StartsWith("v")) {
    $normalizedVersion = $normalizedVersion.Substring(1)
}

if ([string]::IsNullOrWhiteSpace($normalizedVersion)) {
    throw "Version is empty after normalization."
}

$zipPath = Join-Path $DistRoot ("CaptionPanels_{0}_win.zip" -f $normalizedVersion)
if (-not (Test-Path -LiteralPath $zipPath)) {
    throw "Missing release zip: $zipPath"
}

$tempRoot = if ([string]::IsNullOrWhiteSpace($env:RUNNER_TEMP)) {
    [System.IO.Path]::GetTempPath()
} else {
    $env:RUNNER_TEMP
}

$extractRoot = Join-Path $tempRoot ("CaptionPanels_zip_verify_" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $extractRoot -Force | Out-Null

try {
    Expand-Archive -LiteralPath $zipPath -DestinationPath $extractRoot -Force

    $requiredRelativePaths = @(
        "plugin/CaptionPanels.aex",
        "plugin/client/index.html",
        "plugin/host/index.jsx",
        "plugin/config.json",
        "plugin/speakers.json",
        "tools/word2json/README.md",
        "tools/word2json/word2json.exe",
        "tools/word2json/word2json.rules.json",
        "tools/word2json/runtime/win-x64/self-contained/word2json.exe",
        "tools/transcribe_align/transcribe_align.py",
        "config.default.json",
        "BUILDINFO.txt"
    )

    foreach ($relativePath in $requiredRelativePaths) {
        $fullPath = Join-Path $extractRoot $relativePath
        if (-not (Test-Path -LiteralPath $fullPath)) {
            throw "Missing expected path in release zip: $relativePath"
        }
    }

    Write-Host "release zip layout verification: PASS"
}
finally {
    if (Test-Path -LiteralPath $extractRoot) {
        Remove-Item -LiteralPath $extractRoot -Recurse -Force
    }
}
