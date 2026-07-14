[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ContentFolder,
    [switch]$PassThru
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'workshop-common.ps1')

$result = Test-WorkshopHud -ContentFolder $ContentFolder
Write-Host 'Workshop HUD validation passed.' -ForegroundColor Green
Write-Host "  Name:       $($result.Name)"
Write-Host "  Version:    $($result.Version)"
Write-Host "  Entry:      $($result.Entry)"
Write-Host "  Content:    $($result.ContentFolder)"

if ($PassThru) {
    $result
}
