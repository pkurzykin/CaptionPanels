Set-StrictMode -Version Latest

function Get-NormalizedReleaseVersion {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Version
    )

    $normalized = $Version.Trim()
    if ($normalized.StartsWith("refs/tags/")) {
        $normalized = $normalized.Substring("refs/tags/".Length)
    }
    if ($normalized.StartsWith("v")) {
        $normalized = $normalized.Substring(1)
    }

    return $normalized
}
