[CmdletBinding()]
param(
    [string]$Commitish = $env:GITHUB_SHA,
    [string]$MainBranch = "main"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($Commitish)) {
    throw "Commitish is empty. Provide -Commitish or set GITHUB_SHA."
}

if ([string]::IsNullOrWhiteSpace($MainBranch)) {
    throw "MainBranch is empty."
}

$gitCmd = Get-Command git -ErrorAction SilentlyContinue
if ($null -eq $gitCmd) {
    throw "git is not available in PATH."
}

$mainRef = "origin/$MainBranch"

function Invoke-GitStrict {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args,
        [Parameter(Mandatory = $true)]
        [string]$ErrorMessage
    )

    $output = & $gitCmd.Source @Args 2>&1
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        $cmdText = "git " + ($Args -join " ")
        $details = ($output | Out-String).Trim()
        if ([string]::IsNullOrWhiteSpace($details)) {
            $details = "<no output>"
        }
        throw ("{0}`nCommand: {1}`nExitCode: {2}`nOutput: {3}" -f $ErrorMessage, $cmdText, $exitCode, $details)
    }

    return $output
}

function Test-IsAncestor {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Ancestor,
        [Parameter(Mandatory = $true)]
        [string]$Descendant
    )

    & $gitCmd.Source merge-base --is-ancestor $Ancestor $Descendant
    $exitCode = $LASTEXITCODE
    if ($exitCode -eq 0) {
        return $true
    }
    if ($exitCode -eq 1) {
        return $false
    }

    throw ("Failed to evaluate ancestry via merge-base (exit code {0}) for '{1}' vs '{2}'." -f $exitCode, $Ancestor, $Descendant)
}

Invoke-GitStrict -Args @("fetch", "origin", $MainBranch, "--depth=1") -ErrorMessage ("Failed to fetch '{0}' for lineage validation." -f $mainRef) | Out-Null

$resolvedCommit = (Invoke-GitStrict -Args @("rev-parse", "--verify", $Commitish) -ErrorMessage ("Commitish '{0}' is not resolvable." -f $Commitish) | Select-Object -Last 1).Trim()
$resolvedMainRef = (Invoke-GitStrict -Args @("rev-parse", "--verify", $mainRef) -ErrorMessage ("Main ref '{0}' is not resolvable after fetch." -f $mainRef) | Select-Object -Last 1).Trim()

$isInLineage = Test-IsAncestor -Ancestor $resolvedCommit -Descendant $resolvedMainRef

if (-not $isInLineage) {
    $isShallowOutput = (& $gitCmd.Source rev-parse --is-shallow-repository).Trim().ToLowerInvariant()
    $isShallow = $isShallowOutput -eq "true"

    if ($isShallow) {
        Write-Warning ("Initial lineage check failed for commit {0}. Repository is shallow; fetching full history and retrying..." -f $resolvedCommit)

        Invoke-GitStrict -Args @("fetch", "--unshallow", "origin") -ErrorMessage "Failed to unshallow repository for lineage validation." | Out-Null
        Invoke-GitStrict -Args @("fetch", "origin", $MainBranch, "--prune") -ErrorMessage ("Failed to refresh '{0}' after unshallow." -f $mainRef) | Out-Null

        $resolvedMainRef = (Invoke-GitStrict -Args @("rev-parse", "--verify", $mainRef) -ErrorMessage ("Main ref '{0}' is not resolvable after unshallow fetch." -f $mainRef) | Select-Object -Last 1).Trim()
        $isInLineage = Test-IsAncestor -Ancestor $resolvedCommit -Descendant $resolvedMainRef
    }

    if (-not $isInLineage) {
        throw ("Release commit is outside main lineage. Commitish='{0}' (resolved={1}), MainRef='{2}' (resolved={3}). Publish is allowed only for commits in main lineage." -f $Commitish, $resolvedCommit, $mainRef, $resolvedMainRef)
    }
}

Write-Host ("release commit lineage: PASS (commitish={0}, resolved={1}, main={2}, mainResolved={3})" -f $Commitish, $resolvedCommit, $mainRef, $resolvedMainRef)
