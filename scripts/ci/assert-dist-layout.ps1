[CmdletBinding()]
param(
    [string]$DistRoot = "dist/CaptionPanels"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$requiredRelativePaths = @(
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
    $fullPath = Join-Path $DistRoot $relativePath
    if (-not (Test-Path -LiteralPath $fullPath)) {
        throw "Missing expected path in dist layout: $fullPath"
    }
}

Write-Host "dist layout verification: PASS"
