[CmdletBinding()]
param(
    [string]$BundlePath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'dist\workshop.umd.js'),
    [switch]$Check
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'workshop-common.ps1')

$root = Split-Path $PSScriptRoot -Parent
$bundle = (Resolve-Path -LiteralPath $BundlePath).Path
$targets = @(
    'template-workshop',
    'template-workshop-1v1',
    'template-workshop-rmuc2026',
    'template-workshop-rmul2026',
    'publish-test'
)
$sourceHash = (Get-FileHash -LiteralPath $bundle -Algorithm SHA256).Hash

foreach ($relativeTarget in $targets) {
    $target = Join-Path $root $relativeTarget
    $targetBundle = Join-Path $target 'gestalt-hud-sdk.workshop.umd.js'
    $manifest = Get-Content -LiteralPath (Join-Path $target 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json

    if ($Check) {
        if (-not (Test-Path -LiteralPath $targetBundle -PathType Leaf)) {
            throw "Missing UMD bundle: $targetBundle"
        }
        $targetHash = (Get-FileHash -LiteralPath $targetBundle -Algorithm SHA256).Hash
        if ($targetHash -ne $sourceHash) {
            throw "Stale UMD bundle: $targetBundle"
        }
        $manifestScriptPath = Join-Path $target 'manifest.js'
        if (-not (Test-Path -LiteralPath $manifestScriptPath -PathType Leaf)) {
            throw "Missing manifest.js: $manifestScriptPath"
        }
        $actualManifestScript = [IO.File]::ReadAllText($manifestScriptPath).Replace("`r`n", "`n")
        $expectedManifestScript = Get-WorkshopManifestScriptContent -Manifest $manifest
        if ($actualManifestScript -ne $expectedManifestScript) {
            throw "Stale manifest.js: $manifestScriptPath"
        }
    }
    else {
        Copy-Item -LiteralPath $bundle -Destination $targetBundle -Force
        Write-WorkshopManifestScript -ContentFolder $target -Manifest $manifest
        Write-Host "Synced: $relativeTarget" -ForegroundColor DarkGray
    }
}

Write-Host "Workshop assets $($(if ($Check) { 'verified' } else { 'synchronized' }))." -ForegroundColor Green
