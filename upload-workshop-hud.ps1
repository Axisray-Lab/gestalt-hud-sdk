param(
    [Parameter(Mandatory = $true)]
    [string]$ContentFolder,

    [Parameter(Mandatory = $false)]
    [string]$Title,

    [Parameter(Mandatory = $false)]
    [string]$Description,

    [Parameter(Mandatory = $false)]
    [string]$ChangeNote = "Update",

    [Parameter(Mandatory = $false)]
    [uint64]$ItemId = 0,

    [Parameter(Mandatory = $false)]
    [uint32]$AppId = 4007690,

    [Parameter(Mandatory = $false)]
    [string]$PreviewImage,

    [Parameter(Mandatory = $false)]
    [string]$SteamCmdPath = "C:\steamcmd\steamcmd.exe",

    [Parameter(Mandatory = $false)]
    [string]$SteamUser,

    [Parameter(Mandatory = $false)]
    [string]$SteamPass
)

<#
.SYNOPSIS
    Create or update a Steam Workshop HUD item for Gestalt System.

.DESCRIPTION
    Reads manifest.json from the content folder to extract metadata,
    then uses SteamCMD workshop_build_item to upload.

    First-time upload (ItemId = 0): creates a new Workshop item.
    Subsequent uploads (ItemId > 0): updates the existing item.

.PARAMETER ContentFolder
    Path to the HUD content folder containing manifest.json and entry HTML.

.PARAMETER ItemId
    Existing Workshop item ID to update. 0 = create new item.

.PARAMETER AppId
    Steam App ID for the game. Defaults to 4007690 (Gestalt System).
    Falls back to STEAM_APP_ID env var, then version.json in the parent directory.

.PARAMETER PreviewImage
    Path to a preview image (recommended 616x353 PNG). If omitted,
    the script looks for preview.png inside ContentFolder.

.EXAMPLE
    .\upload-workshop-hud.ps1 -ContentFolder ".\my-hud" -SteamUser builder -SteamPass secret

.EXAMPLE
    .\upload-workshop-hud.ps1 -ContentFolder ".\my-hud" -ItemId 123456789 -ChangeNote "Fixed crosshair"
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Resolve paths
$ContentFolder = Resolve-Path $ContentFolder
$ManifestPath = Join-Path $ContentFolder "manifest.json"

if (-not (Test-Path $ManifestPath)) {
    Write-Error "manifest.json not found at: $ManifestPath"
    exit 1
}

# Read manifest
$manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json

if (-not $Title) {
    $Title = $manifest.name
}
if (-not $Description) {
    $Description = $manifest.description
}
if (-not $Title) {
    Write-Error "Title is required (either via -Title or manifest.json 'name' field)"
    exit 1
}

Write-Host "=== Workshop HUD Upload ===" -ForegroundColor Cyan
Write-Host "  Content:     $ContentFolder"
Write-Host "  Title:       $Title"
Write-Host "  Version:     $($manifest.version)"
Write-Host "  SDK Version: $($manifest.sdk_version)"
Write-Host "  ItemId:      $(if ($ItemId -gt 0) { $ItemId } else { 'NEW' })"
Write-Host ""

# Resolve Steam credentials
if (-not $SteamUser) {
    $SteamUser = $env:STEAM_BUILDER_USER
}
if (-not $SteamPass) {
    $SteamPass = $env:STEAM_BUILDER_PASS
}

if (-not $SteamUser -or -not $SteamPass) {
    Write-Error "Steam credentials required. Use -SteamUser/-SteamPass or STEAM_BUILDER_USER/STEAM_BUILDER_PASS env vars."
    exit 1
}

# Resolve AppId: parameter > env var > version.json
if ($AppId -eq 0 -and $env:STEAM_APP_ID) {
    $AppId = [uint32]$env:STEAM_APP_ID
}
if ($AppId -eq 0) {
    $VersionJsonPath = Join-Path (Split-Path $PSScriptRoot) "version.json"
    if (Test-Path $VersionJsonPath) {
        $versionData = Get-Content $VersionJsonPath -Raw | ConvertFrom-Json
        if ($versionData.steamAppId) {
            $AppId = [uint32]$versionData.steamAppId
        }
    }
}
if ($AppId -eq 0) {
    Write-Error "Steam AppId required. Use -AppId, STEAM_APP_ID env var, or ensure version.json exists."
    exit 1
}

Write-Host "  AppId:       $AppId"

# Resolve preview image
if (-not $PreviewImage) {
    $AutoPreview = Join-Path $ContentFolder "preview.png"
    if (Test-Path $AutoPreview) {
        $PreviewImage = $AutoPreview
    }
}
if ($PreviewImage) {
    $PreviewImage = Resolve-Path $PreviewImage
    Write-Host "  Preview:     $PreviewImage"
}

Write-Host ""

# Create VDF for workshop_build_item
$VdfDir = Join-Path $env:TEMP "gestalt_workshop_vdf"
New-Item -ItemType Directory -Path $VdfDir -Force | Out-Null

$VdfLines = @(
    '"workshopitem"',
    '{',
    "    `"appid`"           `"$AppId`"",
    "    `"publishedfileid`" `"$ItemId`"",
    "    `"contentfolder`"   `"$ContentFolder`"",
    "    `"title`"           `"$($Title -replace '"', '\"')`"",
    "    `"description`"     `"$($Description -replace '"', '\"')`"",
    "    `"changenote`"      `"$($ChangeNote -replace '"', '\"')`"",
    "    `"visibility`"      `"0`""
)

if ($PreviewImage) {
    $VdfLines += "    `"previewfile`"     `"$PreviewImage`""
}

$VdfLines += @(
    '    "tags"',
    '    {',
    '        "0" "HUD"',
    '    }',
    '}'
)

$VdfContent = $VdfLines -join "`r`n"
$VdfPath = Join-Path $VdfDir "workshop_item.vdf"
$VdfContent | Out-File -FilePath $VdfPath -Encoding ASCII
Write-Host "VDF written to: $VdfPath" -ForegroundColor DarkGray

# Run SteamCMD
if (-not (Test-Path $SteamCmdPath)) {
    Write-Error "SteamCMD not found at: $SteamCmdPath"
    exit 1
}

Write-Host "Uploading via SteamCMD..." -ForegroundColor Yellow
& $SteamCmdPath +login $SteamUser $SteamPass +workshop_build_item $VdfPath +quit

$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
    Write-Error "SteamCMD exited with code $exitCode"
    exit $exitCode
}

Write-Host ""
Write-Host "=== Upload Complete ===" -ForegroundColor Green
if ($ItemId -eq 0) {
    Write-Host "New Workshop item created. Check SteamCMD output for the item ID."
    Write-Host "Use -ItemId <id> for future updates."
}
