param(
    [string]$Version = "",
    [string]$OutDir = "",
    [string]$PluginName = "CaptionPanels",
    [string]$BuildRoot = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

if ([string]::IsNullOrWhiteSpace($OutDir)) {
    $OutDir = Join-Path $repoRoot "dist"
}

if ([string]::IsNullOrWhiteSpace($Version)) {
    if ($env:GITHUB_REF_NAME) {
        $Version = $env:GITHUB_REF_NAME
    } else {
        $corePath = Join-Path $repoRoot "cep_src/ContentPanels/client/js/app_core.js"
        if (Test-Path $corePath) {
            $core = Get-Content $corePath -Raw
            if ($core -match 'UI_VERSION\s*=\s*\"([^\"]+)\"') {
                $Version = $matches[1]
            }
        }
    }
}

if ([string]::IsNullOrWhiteSpace($Version)) {
    throw "Version is not set. Pass -Version or set GITHUB_REF_NAME."
}

$ver = $Version
if ($ver.StartsWith("v")) { $ver = $ver.Substring(1) }

if ([string]::IsNullOrWhiteSpace($BuildRoot)) {
    if ($env:AE_PLUGIN_BUILD_DIR) {
        $BuildRoot = $env:AE_PLUGIN_BUILD_DIR
    } else {
        $BuildRoot = "C:\AE\PluginBuild"
    }
}

$pluginRoot = Join-Path $BuildRoot ("AEGP\" + $PluginName)
$aexPath = Join-Path $pluginRoot ($PluginName + ".aex")

if (!(Test-Path $aexPath)) {
    throw "Missing built plugin: $aexPath"
}

$stageRoot = Join-Path $OutDir $PluginName
if (Test-Path $stageRoot) { Remove-Item $stageRoot -Recurse -Force }
New-Item -ItemType Directory -Path $stageRoot | Out-Null

Copy-Item $aexPath $stageRoot -Force
Copy-Item (Join-Path $repoRoot "cep_src/ContentPanels/client") (Join-Path $stageRoot "client") -Recurse -Force
Copy-Item (Join-Path $repoRoot "cep_src/ContentPanels/host") (Join-Path $stageRoot "host") -Recurse -Force
Copy-Item (Join-Path $repoRoot "cep_src/ContentPanels/config.json") (Join-Path $stageRoot "config.json") -Force
Copy-Item (Join-Path $repoRoot "cep_src/ContentPanels/speakers.json") (Join-Path $stageRoot "speakers.json") -Force
Copy-Item (Join-Path $repoRoot "aex_bridge/README.md") (Join-Path $stageRoot "README.md") -Force

if (!(Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }
$zipPath = Join-Path $OutDir ($PluginName + "_" + $ver + "_win.zip")
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

Compress-Archive -Path (Join-Path $stageRoot "*") -DestinationPath $zipPath

Write-Host ("Packaged: " + $zipPath)
