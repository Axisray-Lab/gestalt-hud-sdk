[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
    [Parameter(Mandatory = $true)][string]$ContentFolder,
    [string]$Title,
    [string]$Description,
    [string]$ChangeNote = 'Update',
    [uint64]$ItemId = 0,
    [switch]$CreateNew,
    [uint32]$AppId = 4007690,
    [ValidateSet('Public', 'FriendsOnly', 'Private', 'Unlisted')]
    [string]$Visibility = 'Private',
    [switch]$ConfirmPublic,
    [string]$PreviewImage,
    [string]$SteamCmdPath = 'C:\steamcmd\steamcmd.exe',
    [string]$SteamUser,
    [string]$StagingRoot = (Join-Path $env:TEMP 'gestalt-workshop-staging'),
    [switch]$DryRun,
    [switch]$KeepStaging
)

<#
.SYNOPSIS
    Validate, stage, and create or update a Gestalt HUD Steam Workshop item.

.DESCRIPTION
    This publisher is intentionally HUD-only. It validates manifest schema v2,
    enforces the production CSP, copies an allowlisted set of runtime files into
    an isolated staging directory, writes UTF-8 VDF, and invokes SteamCMD.

    No password parameter is accepted. SteamCMD requests the password and Steam
    Guard code interactively, so credentials are not exposed in the process list.

.EXAMPLE
    .\upload-workshop-hud.ps1 -ContentFolder .\publish-test -ItemId 3698375578 -DryRun

.EXAMPLE
    .\upload-workshop-hud.ps1 -ContentFolder .\publish-test -ItemId 3698375578 `
        -Visibility Private -ChangeNote 'SDK v0.2 compatibility' -SteamUser builder

.EXAMPLE
    .\upload-workshop-hud.ps1 -ContentFolder .\my-hud -CreateNew -Visibility Private `
        -SteamUser builder
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'scripts\workshop-common.ps1')

function ConvertTo-VdfValue {
    param([AllowEmptyString()][string]$Value)

    return $Value.Replace('\', '\\').Replace('"', '\"').Replace("`r", '').Replace("`n", '\n')
}

if ($CreateNew -and $ItemId -ne 0) {
    throw 'Use either -CreateNew or -ItemId, not both.'
}
if (-not $CreateNew -and $ItemId -eq 0) {
    throw 'Choose the target explicitly: pass -CreateNew or -ItemId <existing item id>.'
}
if ($Visibility -eq 'Public' -and -not $ConfirmPublic) {
    throw 'Public publishing requires the explicit -ConfirmPublic switch.'
}

$sourceValidation = Test-WorkshopHud -ContentFolder $ContentFolder
if (-not $Title) { $Title = $sourceValidation.Name }
if (-not $Description) { $Description = [string]$sourceValidation.Manifest.description }

if (-not $PreviewImage) {
    $candidatePreview = Join-Path $sourceValidation.ContentFolder 'preview.png'
    if (Test-Path -LiteralPath $candidatePreview -PathType Leaf) {
        $PreviewImage = $candidatePreview
    }
}
if ($PreviewImage) {
    $PreviewImage = (Resolve-Path -LiteralPath $PreviewImage).Path
    if ([IO.Path]::GetExtension($PreviewImage).ToLowerInvariant() -notin @('.png', '.jpg', '.jpeg')) {
        throw 'Preview image must be PNG or JPEG.'
    }
}

$stagingRootPath = [IO.Path]::GetFullPath($StagingRoot)
New-Item -ItemType Directory -Path $stagingRootPath -Force | Out-Null
$workingDirectory = Join-Path $stagingRootPath ("gestalt-workshop-{0}" -f [Guid]::NewGuid().ToString('N'))
$stagedContent = Join-Path $workingDirectory 'content'
$vdfPath = Join-Path $workingDirectory 'workshop-item.vdf'
$uploadSucceeded = $false

try {
    New-Item -ItemType Directory -Path $workingDirectory -Force | Out-Null
    $null = Copy-WorkshopHudContent -Source $sourceValidation.ContentFolder -Destination $stagedContent
    $stagedValidation = Test-WorkshopHud -ContentFolder $stagedContent

    $visibilityValues = @{
        Public = 0
        FriendsOnly = 1
        Private = 2
        Unlisted = 3
    }
    $publishedFileId = if ($CreateNew) { 0 } else { $ItemId }
    $vdfLines = @(
        '"workshopitem"',
        '{',
        "    `"appid`" `"$AppId`"",
        "    `"publishedfileid`" `"$publishedFileId`"",
        "    `"contentfolder`" `"$(ConvertTo-VdfValue $stagedContent)`"",
        "    `"title`" `"$(ConvertTo-VdfValue $Title)`"",
        "    `"description`" `"$(ConvertTo-VdfValue $Description)`"",
        "    `"changenote`" `"$(ConvertTo-VdfValue $ChangeNote)`"",
        "    `"visibility`" `"$($visibilityValues[$Visibility])`""
    )
    if ($PreviewImage) {
        $vdfLines += "    `"previewfile`" `"$(ConvertTo-VdfValue $PreviewImage)`""
    }
    $vdfLines += @(
        '    "tags"',
        '    {',
        '        "0" "HUD"',
        '    }',
        '}'
    )
    [IO.File]::WriteAllText($vdfPath, ($vdfLines -join "`r`n") + "`r`n", [Text.UTF8Encoding]::new($false))

    Write-Host '=== Workshop HUD release candidate ===' -ForegroundColor Cyan
    Write-Host "  Content:     $($sourceValidation.ContentFolder)"
    Write-Host "  Staging:     $stagedContent"
    Write-Host "  Title:       $Title"
    Write-Host "  Version:     $($stagedValidation.Version)"
    Write-Host "  Manifest:    schema v$($stagedValidation.Manifest.sdk_version), HUD-only"
    Write-Host "  AppId:       $AppId"
    Write-Host "  ItemId:      $(if ($CreateNew) { 'NEW' } else { $ItemId })"
    Write-Host "  Visibility:  $Visibility"
    Write-Host "  Preview:     $(if ($PreviewImage) { $PreviewImage } else { 'none' })"
    Write-Host "  VDF:         $vdfPath"

    if ($DryRun) {
        Write-Host 'Dry run complete. Nothing was uploaded; staging was kept for inspection.' -ForegroundColor Yellow
        return
    }

    if (-not (Test-Path -LiteralPath $SteamCmdPath -PathType Leaf)) {
        $steamCommand = Get-Command steamcmd.exe -ErrorAction SilentlyContinue
        if ($steamCommand) {
            $SteamCmdPath = $steamCommand.Source
        }
        else {
            throw "SteamCMD not found: $SteamCmdPath"
        }
    }
    if (-not $SteamUser) { $SteamUser = $env:STEAM_BUILDER_USER }
    if (-not $SteamUser) { $SteamUser = Read-Host 'Steam account name' }
    if ([string]::IsNullOrWhiteSpace($SteamUser)) {
        throw 'A Steam account name is required.'
    }

    $targetLabel = if ($CreateNew) { "new private Workshop item for app $AppId" } else { "Workshop item $ItemId for app $AppId" }
    if (-not $PSCmdlet.ShouldProcess($targetLabel, "Upload HUD version $($stagedValidation.Version) as $Visibility")) {
        Write-Host 'Upload cancelled. Staging was kept for inspection.' -ForegroundColor Yellow
        $KeepStaging = $true
        return
    }

    Write-Host 'Starting SteamCMD. Enter password and Steam Guard code only at its interactive prompt.' -ForegroundColor Yellow
    & $SteamCmdPath +login $SteamUser +workshop_build_item $vdfPath +quit
    if ($LASTEXITCODE -ne 0) {
        throw "SteamCMD exited with code $LASTEXITCODE. Staging was kept: $workingDirectory"
    }

    $uploadSucceeded = $true
    Write-Host 'Workshop upload completed.' -ForegroundColor Green
    if ($CreateNew) {
        $updatedVdf = Get-Content -LiteralPath $vdfPath -Raw -Encoding UTF8
        if ($updatedVdf -match '"publishedfileid"\s+"(\d+)"' -and $Matches[1] -ne '0') {
            Write-Host "  New ItemId: $($Matches[1])" -ForegroundColor Green
        }
        else {
            Write-Host 'Read the new publishedfileid from the SteamCMD output before the next update.' -ForegroundColor Yellow
        }
    }
}
finally {
    if ($DryRun -or $KeepStaging -or -not $uploadSucceeded) {
        Write-Host "Staging retained: $workingDirectory" -ForegroundColor DarkGray
    }
    else {
        Remove-WorkshopWorkingDirectory -WorkingDirectory $workingDirectory -StagingRoot $stagingRootPath
    }
}
