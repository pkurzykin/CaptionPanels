[CmdletBinding()]
param(
    [string]$NuGetConfigFile = "",
    [string[]]$NuGetSource = @(),
    [ValidateRange(3, 60)]
    [int]$TimeoutSec = 10
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Get-SourcesFromConfig {
    param(
        [Parameter(Mandatory = $true)][string]$ConfigPath
    )

    if (!(Test-Path -LiteralPath $ConfigPath -PathType Leaf)) {
        throw "NuGet config file not found: $ConfigPath"
    }

    [xml]$configXml = Get-Content -LiteralPath $ConfigPath -Raw
    return @(
        $configXml.configuration.packageSources.add |
        ForEach-Object { $_.value } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
        ForEach-Object { $_.Trim() } |
        Select-Object -Unique
    )
}

function Test-HttpReachability {
    param(
        [Parameter(Mandatory = $true)][uri]$Uri,
        [ValidateRange(3, 60)][int]$TimeoutSec = 10
    )

    $handler = [System.Net.Http.HttpClientHandler]::new()
    $client = [System.Net.Http.HttpClient]::new($handler)
    $client.Timeout = [TimeSpan]::FromSeconds($TimeoutSec)
    $client.DefaultRequestHeaders.UserAgent.ParseAdd("CaptionPanels-NuGet-Check/1.0")

    try {
        $headRequest = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Head, $Uri)
        $headResponse = $client.SendAsync($headRequest).GetAwaiter().GetResult()

        if ([int]$headResponse.StatusCode -eq 405) {
            $getRequest = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get, $Uri)
            $getResponse = $client.SendAsync($getRequest).GetAwaiter().GetResult()
            return [pscustomobject]@{
                Reachable  = $true
                StatusCode = [int]$getResponse.StatusCode
                Reason     = $getResponse.ReasonPhrase
                Method     = "GET"
            }
        }

        return [pscustomobject]@{
            Reachable  = $true
            StatusCode = [int]$headResponse.StatusCode
            Reason     = $headResponse.ReasonPhrase
            Method     = "HEAD"
        }
    } catch {
        return [pscustomobject]@{
            Reachable  = $false
            StatusCode = 0
            Reason     = $_.Exception.Message
            Method     = "HEAD"
        }
    } finally {
        $client.Dispose()
        $handler.Dispose()
    }
}

$resolvedSources = @(
    $NuGetSource |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
    ForEach-Object { $_.Trim() } |
    Select-Object -Unique
)

if ($resolvedSources.Count -eq 0 -and -not [string]::IsNullOrWhiteSpace($NuGetConfigFile)) {
    $resolvedSources = Get-SourcesFromConfig -ConfigPath $NuGetConfigFile
}

if ($resolvedSources.Count -eq 0) {
    $resolvedSources = @("https://api.nuget.org/v3/index.json")
}

$results = @()

foreach ($source in $resolvedSources) {
    $sourceUri = $null
    $sourceHost = ""
    $dnsStatus = "FAIL"
    $dnsDetails = ""
    $httpStatus = "FAIL"
    $httpDetails = ""

    try {
        $sourceUri = [uri]$source
        if (!$sourceUri.IsAbsoluteUri -or (($sourceUri.Scheme -ne "https") -and ($sourceUri.Scheme -ne "http"))) {
            throw "Source must be absolute http/https URL."
        }

        $sourceHost = $sourceUri.DnsSafeHost
        $addresses = [System.Net.Dns]::GetHostAddresses($sourceHost)
        if ($addresses.Count -gt 0) {
            $dnsStatus = "PASS"
            $dnsDetails = (($addresses | Select-Object -First 2 | ForEach-Object { $_.ToString() }) -join ", ")
        } else {
            $dnsDetails = "No DNS addresses returned."
        }

        $httpResult = Test-HttpReachability -Uri $sourceUri -TimeoutSec $TimeoutSec
        if ($httpResult.Reachable) {
            $httpStatus = "PASS"
            $httpDetails = ("{0} {1} ({2})" -f $httpResult.StatusCode, $httpResult.Reason, $httpResult.Method)
        } else {
            $httpDetails = $httpResult.Reason
        }
    } catch {
        if ([string]::IsNullOrWhiteSpace($dnsDetails)) {
            $dnsDetails = $_.Exception.Message
        }
        if ([string]::IsNullOrWhiteSpace($httpDetails)) {
            $httpDetails = $_.Exception.Message
        }
    }

    $overall = if ($dnsStatus -eq "PASS" -and $httpStatus -eq "PASS") { "PASS" } else { "FAIL" }
    $results += [pscustomobject]@{
        Source  = $source
        DNS     = $dnsStatus
        HTTP    = $httpStatus
        Status  = $overall
        Details = ("DNS: {0} | HTTP: {1}" -f $dnsDetails, $httpDetails)
    }
}

Write-Host "NuGet connectivity check"
$results | Format-Table -AutoSize

$failCount = @($results | Where-Object { $_.Status -eq "FAIL" }).Count
if ($failCount -gt 0) {
    exit 1
}

exit 0
