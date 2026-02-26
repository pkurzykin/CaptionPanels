Set-StrictMode -Version Latest

function Get-CaptionPanelsRepoRoot {
    param(
        [string]$ScriptRoot = $PSScriptRoot
    )

    return (Resolve-Path (Join-Path $ScriptRoot "..")).Path
}

function Get-CaptionPanelsBuildRoot {
    param(
        [string]$BuildRoot = ""
    )

    if (![string]::IsNullOrWhiteSpace($BuildRoot)) {
        return $BuildRoot
    }

    if (![string]::IsNullOrWhiteSpace($env:AE_PLUGIN_BUILD_DIR)) {
        return $env:AE_PLUGIN_BUILD_DIR
    }

    return "C:\AE\PluginBuild"
}

function Get-CaptionPanelsDistRoot {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [string]$OutDir = ""
    )

    if (![string]::IsNullOrWhiteSpace($OutDir)) {
        return $OutDir
    }

    return (Join-Path $RepoRoot "dist")
}

function Get-CaptionPanelsBuiltAexPath {
    param(
        [Parameter(Mandatory = $true)][string]$BuildRoot,
        [string]$PluginName = "CaptionPanels"
    )

    return (Join-Path $BuildRoot ("AEGP\" + $PluginName + "\" + $PluginName + ".aex"))
}

function Get-CaptionPanelsVersion {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [string]$Version = ""
    )

    $resolved = $Version
    if ([string]::IsNullOrWhiteSpace($resolved) -and $env:GITHUB_REF_NAME) {
        $resolved = $env:GITHUB_REF_NAME
    }

    if ([string]::IsNullOrWhiteSpace($resolved)) {
        $corePath = Join-Path $RepoRoot "cep_src/ContentPanels/client/js/app_core.js"
        if (Test-Path $corePath) {
            $core = Get-Content $corePath -Raw
            if ($core -match 'UI_VERSION\s*=\s*"([^"]+)"') {
                $resolved = $matches[1]
            }
        }
    }

    if ([string]::IsNullOrWhiteSpace($resolved)) {
        return "0.0.0-local"
    }

    if ($resolved.StartsWith("v")) {
        return $resolved.Substring(1)
    }

    return $resolved
}
