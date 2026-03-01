[CmdletBinding()]
param(
    [string]$Repository = $env:RELEASE_REPO,
    [string]$Token = $env:RELEASE_REPO_TOKEN,
    [string]$ApiBaseUrl = "https://api.github.com"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Repository)) {
    throw "Release repository is empty. Set RELEASE_REPO."
}

if ([string]::IsNullOrWhiteSpace($Token)) {
    throw "Release repository token is empty. Set RELEASE_REPO_TOKEN."
}

$repo = $Repository.Trim().Trim("/")
$apiRoot = $ApiBaseUrl.TrimEnd("/")
$uri = "{0}/repos/{1}" -f $apiRoot, $repo

$headers = @{
    Accept               = "application/vnd.github+json"
    Authorization        = ("Bearer {0}" -f $Token)
    "X-GitHub-Api-Version" = "2022-11-28"
}

try {
    $response = Invoke-RestMethod -Method Get -Uri $uri -Headers $headers
}
catch {
    $statusCode = $null
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
        $statusCode = [int]$_.Exception.Response.StatusCode
    }

    if ($statusCode -eq 404) {
        throw ("Release repository '{0}' is not accessible (404). Verify RELEASE_REPO and token access." -f $repo)
    }

    if ($statusCode -eq 401 -or $statusCode -eq 403) {
        throw ("Release repository access denied ({0}). Verify RELEASE_REPO_TOKEN scope/permissions." -f $statusCode)
    }

    throw ("Failed to query release repository readiness: {0}" -f $_.Exception.Message)
}

$defaultBranch = [string]$response.default_branch
if ([string]::IsNullOrWhiteSpace($defaultBranch)) {
    throw ("Release repository '{0}' has no default branch. Initialize repository (for example create 'main')." -f $repo)
}

$permissions = $response.permissions
if ($null -ne $permissions -and $permissions.PSObject.Properties.Name -contains "push") {
    if (-not [bool]$permissions.push) {
        throw ("Token does not have push permission for release repository '{0}'." -f $repo)
    }
}

Write-Host ("release repo readiness: PASS (repo={0}, default_branch={1})" -f $repo, $defaultBranch)
