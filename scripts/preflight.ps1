[CmdletBinding()]
param(
    [switch]$Strict,
    [switch]$SkipAegpChecks,
    [switch]$CheckNuGetConnectivity,
    [string]$NuGetConfigFile = "",
    [string[]]$NuGetSource = @(),
    [ValidateRange(3, 60)]
    [int]$NuGetConnectivityTimeoutSec = 10
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Add-CheckResult {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][ValidateSet("PASS", "WARN", "FAIL")][string]$Status,
        [Parameter(Mandatory = $true)][string]$Details
    )

    $script:results += [pscustomobject]@{
        Name    = $Name
        Status  = $Status
        Details = $Details
    }
}

$results = @()

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$distRoot = Join-Path $repoRoot "dist"
$toolsBuildRoot = Join-Path $distRoot "_build/tools"

# PowerShell
$psVersion = $PSVersionTable.PSVersion
if ($psVersion.Major -ge 7) {
    Add-CheckResult -Name "PowerShell" -Status "PASS" -Details ("{0}.{1}.{2}" -f $psVersion.Major, $psVersion.Minor, $psVersion.Patch)
} else {
    Add-CheckResult -Name "PowerShell" -Status "FAIL" -Details ("PowerShell 7+ is required, current: {0}" -f $psVersion)
}

# dotnet SDK
$dotnetCmd = Get-Command dotnet -ErrorAction SilentlyContinue
if ($null -eq $dotnetCmd) {
    Add-CheckResult -Name "dotnet" -Status "FAIL" -Details "dotnet SDK not found in PATH."
} else {
    # Align with build.ps1: isolate dotnet first-run artifacts and cache in dist/_build/tools when env vars are not provided.
    $dotnetCliHome = $env:DOTNET_CLI_HOME
    if ([string]::IsNullOrWhiteSpace($dotnetCliHome)) {
        $dotnetCliHome = Join-Path $toolsBuildRoot "dotnet-home"
        $env:DOTNET_CLI_HOME = $dotnetCliHome
    }
    if (!(Test-Path -LiteralPath $dotnetCliHome -PathType Container)) {
        New-Item -ItemType Directory -Path $dotnetCliHome -Force | Out-Null
    }

    $nugetPackages = $env:NUGET_PACKAGES
    if ([string]::IsNullOrWhiteSpace($nugetPackages)) {
        $nugetPackages = Join-Path $toolsBuildRoot "nuget-packages"
        $env:NUGET_PACKAGES = $nugetPackages
    }
    if (!(Test-Path -LiteralPath $nugetPackages -PathType Container)) {
        New-Item -ItemType Directory -Path $nugetPackages -Force | Out-Null
    }

    $dotnetVersionText = ""
    try {
        $dotnetVersionText = (& $dotnetCmd.Source --version).Trim()
        $dotnetVersion = [version]$dotnetVersionText
        if ($dotnetVersion.Major -ge 8) {
            Add-CheckResult -Name "dotnet" -Status "PASS" -Details ("SDK {0}" -f $dotnetVersionText)
        } else {
            Add-CheckResult -Name "dotnet" -Status "WARN" -Details ("SDK {0}. Recommended: 8.0+" -f $dotnetVersionText)
        }
    } catch {
        Add-CheckResult -Name "dotnet" -Status "WARN" -Details ("Found at {0}, but version check failed: {1}" -f $dotnetCmd.Source, $_.Exception.Message)
    }

    try {
        $nugetList = (& $dotnetCmd.Source nuget list source 2>&1 | Out-String).Trim()
        if ($LASTEXITCODE -eq 0) {
            Add-CheckResult -Name "NuGet sources" -Status "PASS" -Details "NuGet source list is readable."
        } else {
            Add-CheckResult -Name "NuGet sources" -Status "WARN" -Details ("dotnet nuget list source failed: {0}" -f $nugetList)
        }
    } catch {
        Add-CheckResult -Name "NuGet sources" -Status "WARN" -Details ("NuGet source check failed: {0}" -f $_.Exception.Message)
    }

    if ($CheckNuGetConnectivity) {
        $nugetConnectivityScript = Join-Path $repoRoot "scripts/check-nuget-connectivity.ps1"
        if (!(Test-Path -LiteralPath $nugetConnectivityScript -PathType Leaf)) {
            Add-CheckResult -Name "NuGet connectivity" -Status "FAIL" -Details ("Missing script: {0}" -f $nugetConnectivityScript)
        } else {
            $connectivityParams = @{
                TimeoutSec = $NuGetConnectivityTimeoutSec
                Quiet      = $true
            }
            if (![string]::IsNullOrWhiteSpace($NuGetConfigFile)) {
                $connectivityParams["NuGetConfigFile"] = $NuGetConfigFile
            }
            $resolvedNuGetSources = @()
            foreach ($source in $NuGetSource) {
                if (![string]::IsNullOrWhiteSpace($source)) {
                    $resolvedNuGetSources += $source.Trim()
                }
            }
            if ($resolvedNuGetSources.Count -gt 0) {
                $connectivityParams["NuGetSource"] = $resolvedNuGetSources
            }

            $connectivityOutput = ""
            try {
                $connectivityOutput = (& $nugetConnectivityScript @connectivityParams 2>&1 | Out-String).Trim()
                if ($LASTEXITCODE -eq 0) {
                    Add-CheckResult -Name "NuGet connectivity" -Status "PASS" -Details "Connectivity check passed."
                } else {
                    $details = "Connectivity check failed. Run scripts/check-nuget-connectivity.ps1 for details."
                    Add-CheckResult -Name "NuGet connectivity" -Status "FAIL" -Details $details
                }
            } catch {
                Add-CheckResult -Name "NuGet connectivity" -Status "FAIL" -Details ("Connectivity check crashed: {0}" -f $_.Exception.Message)
            }
        }
    }
}

if ($SkipAegpChecks) {
    Add-CheckResult -Name "AEGP checks" -Status "PASS" -Details "Skipped (-SkipAegpChecks)."
} else {
    # msbuild (for AEGP)
    $msbuildCmd = Get-Command msbuild -ErrorAction SilentlyContinue
    if ($null -ne $msbuildCmd) {
        Add-CheckResult -Name "MSBuild" -Status "PASS" -Details ("Found: {0}" -f $msbuildCmd.Source)
    } else {
        Add-CheckResult -Name "MSBuild" -Status "WARN" -Details "msbuild not found; AEGP build will be skipped by build.ps1."
    }

    # AEGP env checks
    if ($IsWindows) {
        $aeSdk = $env:AE_SDK_ROOT
        if ([string]::IsNullOrWhiteSpace($aeSdk)) {
            Add-CheckResult -Name "AE_SDK_ROOT" -Status "WARN" -Details "Environment variable is not set."
        } elseif (Test-Path -LiteralPath $aeSdk) {
            Add-CheckResult -Name "AE_SDK_ROOT" -Status "PASS" -Details $aeSdk
        } else {
            Add-CheckResult -Name "AE_SDK_ROOT" -Status "WARN" -Details ("Path not found: {0}" -f $aeSdk)
        }

        $webView2 = $env:WEBVIEW2_SDK
        if ([string]::IsNullOrWhiteSpace($webView2)) {
            Add-CheckResult -Name "WEBVIEW2_SDK" -Status "WARN" -Details "Environment variable is not set."
        } elseif (Test-Path -LiteralPath $webView2) {
            Add-CheckResult -Name "WEBVIEW2_SDK" -Status "PASS" -Details $webView2
        } else {
            Add-CheckResult -Name "WEBVIEW2_SDK" -Status "WARN" -Details ("Path not found: {0}" -f $webView2)
        }
    } else {
        Add-CheckResult -Name "AEGP platform" -Status "WARN" -Details ("Current platform is non-Windows ({0}); AEGP build is Windows-only." -f [System.Runtime.InteropServices.RuntimeInformation]::OSDescription)
    }
}

# Required scripts
$requiredScripts = @("scripts/build.ps1", "scripts/package.ps1", "scripts/paths.ps1")
foreach ($scriptPath in $requiredScripts) {
    $fullPath = Join-Path $repoRoot $scriptPath
    if (Test-Path -LiteralPath $fullPath -PathType Leaf) {
        Add-CheckResult -Name ("File " + $scriptPath) -Status "PASS" -Details "Present"
    } else {
        Add-CheckResult -Name ("File " + $scriptPath) -Status "FAIL" -Details "Missing"
    }
}

# Dist writeability
try {
    New-Item -ItemType Directory -Path $distRoot -Force | Out-Null
    $probePath = Join-Path $distRoot ".preflight_write_test"
    Set-Content -LiteralPath $probePath -Value "ok" -Encoding ascii
    Remove-Item -LiteralPath $probePath -Force -ErrorAction SilentlyContinue
    Add-CheckResult -Name "dist writeability" -Status "PASS" -Details $distRoot
} catch {
    Add-CheckResult -Name "dist writeability" -Status "FAIL" -Details $_.Exception.Message
}

Write-Host "CaptionPanels build preflight"
Write-Host ("Repo: {0}" -f $repoRoot)
Write-Host ""
$results | Format-Table -AutoSize

$passCount = @($results | Where-Object { $_.Status -eq "PASS" }).Count
$warnCount = @($results | Where-Object { $_.Status -eq "WARN" }).Count
$failCount = @($results | Where-Object { $_.Status -eq "FAIL" }).Count

Write-Host ""
Write-Host ("Summary: PASS={0} WARN={1} FAIL={2}" -f $passCount, $warnCount, $failCount)

if ($failCount -gt 0) {
    exit 1
}

if ($Strict -and $warnCount -gt 0) {
    exit 2
}

exit 0
