param(
    [int[]]$MapIds = @(2, 3, 4, 5, 6, 7, 8),
    [uint32]$AppId = 4007690,
    [uint64]$ItemId = 3698375578,
    [ValidateSet("Auto", "CDP", "Log")]
    [string]$Mode = "Auto",
    [int]$CdpPort = 8088,
    [int]$AutoProbeSeconds = 25,
    [int]$TimeoutSeconds = 180,
    [string]$GameLogPath = "$env:LOCALAPPDATA\RobotBridgeDemo\Saved\Logs\RobotBridgeDemo.log",
    [int]$ResX = 1600,
    [int]$ResY = 900,
    [int]$CareerId = 0,
    [int]$EntityId = 0,
    [int]$StabilitySeconds = 60,
    [int]$InterMapDelaySeconds = 15,
    [string]$SteamExe = "C:\Program Files (x86)\Steam\steam.exe",
    [string]$SteamLibrary = "D:\SteamLibrary",
    [string]$ContentFolder = $(Join-Path (Split-Path $PSScriptRoot) "publish-test"),
    [string]$OutDir = $(Join-Path (Split-Path $PSScriptRoot) "artifacts\steam-workshop-e2e"),
    [switch]$SkipContentHashCheck,
    [switch]$ForceStopExisting
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Test-CdpReady {
    try {
        $response = Invoke-WebRequest `
            -Uri "http://127.0.0.1:$CdpPort/json/list" `
            -Headers @{ Host = "localhost:$CdpPort" } `
            -UseBasicParsing `
            -TimeoutSec 2
        return $response.StatusCode -eq 200 -and $response.Content -match '"type"\s*:\s*"page"'
    } catch {
        return $false
    }
}

function Get-GameProcesses {
    return @(
        Get-Process -Name "Gestalt_System", "RobotBridgeDemo-Win64-Shipping" -ErrorAction SilentlyContinue
    )
}

function Stop-ExactGameProcesses {
    param([int[]]$ProcessIds)

    $uniqueIds = @($ProcessIds | Where-Object { $_ -gt 0 } | Sort-Object -Unique)
    foreach ($processId in $uniqueIds) {
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($null -eq $process) { continue }
        if ($process.ProcessName -notin @("Gestalt_System", "RobotBridgeDemo-Win64-Shipping")) {
            Write-Warning "Refusing to stop PID $processId because it is no longer a known game process."
            continue
        }
        try { [void]$process.CloseMainWindow() } catch { }
    }
    if ($uniqueIds.Count -gt 0) { Start-Sleep -Seconds 5 }
    foreach ($processId in $uniqueIds) {
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($null -eq $process) { continue }
        if ($process.ProcessName -notin @("Gestalt_System", "RobotBridgeDemo-Win64-Shipping")) {
            Write-Warning "Refusing to force-stop PID $processId because it is no longer a known game process."
            continue
        }
        try { Stop-Process -Id $processId -Force -ErrorAction Stop } catch { }
    }
}

function Get-LaunchedGameProcesses {
    param(
        [datetime]$LaunchedAt,
        [int[]]$ExcludedProcessIds
    )

    $excluded = @{}
    foreach ($processId in $ExcludedProcessIds) { $excluded[$processId] = $true }
    return @(
        foreach ($process in @(Get-GameProcesses)) {
            if ($excluded.ContainsKey($process.Id)) { continue }
            try {
                if ($process.StartTime -ge $LaunchedAt.AddSeconds(-2)) { $process }
            } catch { }
        }
    )
}

function Wait-ForLaunchedGameProcess {
    param(
        [datetime]$LaunchedAt,
        [int[]]$ExcludedProcessIds,
        [int]$WaitSeconds = 60
    )

    $deadline = (Get-Date).AddSeconds($WaitSeconds)
    $lastProcesses = @()
    do {
        $processes = @(Get-LaunchedGameProcesses `
            -LaunchedAt $LaunchedAt `
            -ExcludedProcessIds $ExcludedProcessIds)
        if ($processes.Count -gt 0) {
            $lastProcesses = $processes
            foreach ($process in @(
                $processes |
                    Sort-Object @{ Expression = { $_.ProcessName -eq "RobotBridgeDemo-Win64-Shipping" }; Descending = $true }
            )) {
                try {
                    $process.Refresh()
                    if ($process.MainWindowHandle -ne [IntPtr]::Zero) { return $process }
                } catch { }
            }
        }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)
    if ($lastProcesses.Count -gt 0) {
        $shipping = @($lastProcesses | Where-Object {
            $_.ProcessName -eq "RobotBridgeDemo-Win64-Shipping"
        } | Select-Object -First 1)
        if ($shipping.Count -gt 0) { return $shipping[0] }
        return $lastProcesses[0]
    }
    throw "The Gestalt System game process did not start within $WaitSeconds seconds."
}

function Get-LogBaseline {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return [pscustomobject]@{ Offset = 0L; CreationTimeUtcTicks = 0L }
    }
    $file = Get-Item -LiteralPath $Path -ErrorAction Stop
    return [pscustomobject]@{
        Offset = [long]$file.Length
        CreationTimeUtcTicks = [long]$file.CreationTimeUtc.Ticks
    }
}

function Test-NewLogTelemetry {
    param(
        [string]$Path,
        [pscustomobject]$Baseline
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
    try {
        $file = Get-Item -LiteralPath $Path -ErrorAction Stop
        $offset = if (
            $file.Length -ge $Baseline.Offset -and
            ($Baseline.CreationTimeUtcTicks -eq 0 -or
                $file.CreationTimeUtc.Ticks -eq $Baseline.CreationTimeUtcTicks)
        ) { $Baseline.Offset } else { 0L }
        $stream = [System.IO.File]::Open(
            $file.FullName,
            [System.IO.FileMode]::Open,
            [System.IO.FileAccess]::Read,
            [System.IO.FileShare]::ReadWrite -bor [System.IO.FileShare]::Delete
        )
        try {
            [void]$stream.Seek($offset, [System.IO.SeekOrigin]::Begin)
            $reader = [System.IO.StreamReader]::new($stream)
            try { $text = $reader.ReadToEnd() } finally { $reader.Dispose() }
        } finally {
            $stream.Dispose()
        }
        return $text.Contains("GESTALT_HUD_E2E ")
    } catch {
        return $false
    }
}

function Select-AutoMode {
    param(
        [string]$Path,
        [pscustomobject]$LogBaseline,
        [System.Diagnostics.Process]$GameProcess
    )

    $deadline = (Get-Date).AddSeconds($AutoProbeSeconds)
    Write-Host "Auto mode: probing CDP and host-log telemetry for up to $AutoProbeSeconds seconds."
    do {
        if (Test-CdpReady) {
            Write-Host "Auto mode selected CDP telemetry."
            return "CDP"
        }
        if (Test-NewLogTelemetry -Path $Path -Baseline $LogBaseline) {
            Write-Host "Auto mode selected host-log telemetry."
            return "Log"
        }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)

    if ($GameProcess.ProcessName -eq "RobotBridgeDemo-Win64-Shipping") {
        Write-Host "Shipping build detected; falling back to host-log telemetry."
    } else {
        Write-Warning "CDP and telemetry were not ready during the auto probe; continuing with the log harness."
    }
    return "Log"
}

function Get-ContentFingerprint {
    param([string]$Root)

    $resolved = (Resolve-Path -LiteralPath $Root).Path
    $lines = foreach ($file in Get-ChildItem -LiteralPath $resolved -Recurse -File | Sort-Object FullName) {
        $relative = [System.IO.Path]::GetRelativePath($resolved, $file.FullName).Replace('\', '/')
        $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        "$relative`t$hash"
    }
    $bytes = [System.Text.Encoding]::UTF8.GetBytes(($lines -join "`n"))
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        return [Convert]::ToHexString($sha.ComputeHash($bytes)).ToLowerInvariant()
    } finally {
        $sha.Dispose()
    }
}

function Set-CdpReportMode {
    param(
        [string]$ReportPath,
        [string]$ScreenshotPath
    )

    if (-not (Test-Path -LiteralPath $ReportPath -PathType Leaf)) { return }
    $report = Get-Content -LiteralPath $ReportPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $report | Add-Member -NotePropertyName mode -NotePropertyValue "CDP" -Force
    $report | Add-Member -NotePropertyName screenshot -NotePropertyValue ([ordered]@{
        path = [System.IO.Path]::GetFullPath($ScreenshotPath)
    }) -Force
    $report | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $ReportPath -Encoding utf8NoBOM
}

if ($MapIds.Count -eq 0) { throw "MapIds must contain at least one map id." }
if ($MapIds | Where-Object { $_ -lt 2 -or $_ -gt 8 }) {
    throw 'MapIds must be in the supported range 2..8. From PowerShell, pass multiple maps as -MapIds @(2,3,4,5,6,7,8).'
}
if ($AutoProbeSeconds -lt 1) { throw "AutoProbeSeconds must be at least 1." }
if ($TimeoutSeconds -lt 1) { throw "TimeoutSeconds must be at least 1." }
if ($StabilitySeconds -lt 1) { throw "StabilitySeconds must be at least 1." }
if ($InterMapDelaySeconds -lt 0) { throw "InterMapDelaySeconds cannot be negative." }
if ($CareerId -lt 0) { throw "CareerId cannot be negative." }
if ($EntityId -lt 0) { throw "EntityId cannot be negative." }
if (($CareerId -gt 0) -xor ($EntityId -gt 0)) {
    throw "CareerId and EntityId must either both be greater than zero or both remain zero."
}
$execCommands = @("SetMatchStatus 1")
$combatRespawnCommand = $null
if ($CareerId -gt 0 -and $EntityId -gt 0) {
    # Standalone autostart creates local player 0 as an observer. Preferred
    # vehicle parameters alone do not replace that observer, so the release
    # harness explicitly enters a deterministic red-team infantry slot after
    # world startup. RespawnByCareer validates that the override matches the
    # requested career before creating the vehicle.
    $combatRespawnCommand = "RespawnByCareer 0 $CareerId 0 3 $EntityId"
    $execCommands += $combatRespawnCommand
}
$execArgument = '-exec="' + ($execCommands -join ';') + '"'
if (-not (Test-Path -LiteralPath $SteamExe -PathType Leaf)) {
    throw "Steam executable not found: $SteamExe"
}
if (-not (Test-Path -LiteralPath $ContentFolder -PathType Container)) {
    throw "Workshop staging folder not found: $ContentFolder"
}

$manifestPath = Join-Path $ContentFolder "manifest.json"
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "manifest.json not found: $manifestPath"
}
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$expectedName = [string]$manifest.name
$expectedVersion = [string]$manifest.version

$installedFolder = Join-Path $SteamLibrary "steamapps\workshop\content\$AppId\$ItemId"
$workshopState = Join-Path $SteamLibrary "steamapps\workshop\appworkshop_$AppId.acf"
if (-not (Test-Path -LiteralPath $workshopState -PathType Leaf)) {
    throw "Steam Workshop state file not found: $workshopState"
}
if ((Get-Content -LiteralPath $workshopState -Raw) -match [regex]::Escape([string]$ItemId)) {
    Write-Host "Workshop item $ItemId is present in Steam's local cache."
} else {
    Write-Warning "Workshop item $ItemId is not recorded in Steam's local cache."
}
Write-Warning 'A cached/installed Workshop folder does not prove that the current Steam account is subscribed. The in-game iframe or host-log assertion is authoritative.'
if (-not (Test-Path -LiteralPath $installedFolder -PathType Container)) {
    throw "Workshop item $ItemId is not installed: $installedFolder"
}

if (-not $SkipContentHashCheck) {
    $stagingHash = Get-ContentFingerprint -Root $ContentFolder
    $installedHash = Get-ContentFingerprint -Root $installedFolder
    Write-Host "Staging hash:  $stagingHash"
    Write-Host "Installed hash: $installedHash"
    if ($stagingHash -ne $installedHash) {
        throw "Installed Workshop content does not match staging. Wait for Steam to finish updating item $ItemId."
    }
}

$existing = @(Get-GameProcesses)
if ($existing.Count -gt 0) {
    if (-not $ForceStopExisting) {
        throw "Gestalt System is already running. Close it or pass -ForceStopExisting."
    }
    Stop-ExactGameProcesses -ProcessIds @($existing.Id)
    $remainingExisting = @(Get-GameProcesses)
    if ($remainingExisting.Count -gt 0) {
        throw "Existing Gestalt System process did not stop: $(@($remainingExisting.Id) -join ', ')"
    }
    if ($InterMapDelaySeconds -gt 0) {
        Write-Host "Waiting $InterMapDelaySeconds seconds for Steam to release the previous app session."
        Start-Sleep -Seconds $InterMapDelaySeconds
    }
}
if ($Mode -ne "Log" -and (Test-CdpReady)) {
    throw "CEF CDP port $CdpPort is already active before the test. Refusing to attach to a stale target."
}

$resolvedOut = [System.IO.Path]::GetFullPath($OutDir)
New-Item -ItemType Directory -Path $resolvedOut -Force | Out-Null
$results = @()
$completedMapCount = 0
$activeGameProcessIds = @()
$currentLaunchAt = $null
$currentBaselineProcessIds = @()

try {
    foreach ($mapId in $MapIds) {
        Write-Host "=== Steam Workshop HUD E2E: map $mapId ===" -ForegroundColor Cyan
        $mapOut = Join-Path $resolvedOut "map-$mapId"
        New-Item -ItemType Directory -Path $mapOut -Force | Out-Null
        $reportPath = Join-Path $mapOut "map-$mapId-report.json"
        $screenshotPath = Join-Path $mapOut "map-$mapId-hud.png"
        $logBaseline = Get-LogBaseline -Path $GameLogPath
        $baselineProcessIds = @(
            Get-GameProcesses | ForEach-Object { $_.Id }
        )
        $launchedAt = Get-Date
        $currentLaunchAt = $launchedAt
        $currentBaselineProcessIds = $baselineProcessIds
        $steamArgs = @(
            "-applaunch", "$AppId",
            "-windowed", "-ResX=$ResX", "-ResY=$ResY",
            "-autostart", "-mapid=$mapId", "-nettype=0", "-connmethod=0",
            "-autostartdelay=3000", "-execdelay=15000", "-hudhidden=0",
            "-EchoPuertsDebugPort=0", $execArgument
        )
        if ($Mode -ne "Log") {
            $steamArgs += "-cefdebug=$CdpPort"
        }
        if ($CareerId -gt 0 -and $EntityId -gt 0) {
            $steamArgs += "-careerid=$CareerId", "-entityid=$EntityId"
        }
        Start-Process -FilePath $SteamExe -ArgumentList $steamArgs | Out-Null

        $gameProcess = Wait-ForLaunchedGameProcess `
            -LaunchedAt $launchedAt `
            -ExcludedProcessIds $baselineProcessIds
        $activeGameProcessIds = @($gameProcess.Id)
        Write-Host "Tracking game PID $($gameProcess.Id) ($($gameProcess.ProcessName))."

        $selectedMode = if ($Mode -eq "Auto") {
            Select-AutoMode `
                -Path $GameLogPath `
                -LogBaseline $logBaseline `
                -GameProcess $gameProcess
        } else { $Mode }

        if ($selectedMode -eq "CDP") {
            & node (Join-Path $PSScriptRoot "workshop-hud-e2e.mjs") `
                --port "$CdpPort" `
                --map-id "$mapId" `
                --expected-name "$expectedName" `
                --expected-version "$expectedVersion" `
                --timeout-ms "$($TimeoutSeconds * 1000)" `
                --stability-ms "$($StabilitySeconds * 1000)" `
                --out "$mapOut"
            $exitCode = $LASTEXITCODE
            Set-CdpReportMode -ReportPath $reportPath -ScreenshotPath $screenshotPath
        } else {
            $pwshExe = (Get-Process -Id $PID).Path
            & $pwshExe -NoProfile -File (Join-Path $PSScriptRoot "workshop-hud-log-e2e.ps1") `
                -MapId $mapId `
                -ExpectedName $expectedName `
                -ExpectedVersion $expectedVersion `
                -ExpectedCareerId $CareerId `
                -ItemId $ItemId `
                -LogPath $GameLogPath `
                -LogStartOffset $logBaseline.Offset `
                -LogStartCreationTimeUtcTicks $logBaseline.CreationTimeUtcTicks `
                -TimeoutSeconds $TimeoutSeconds `
                -StabilitySeconds $StabilitySeconds `
                -GameProcessId $gameProcess.Id `
                -OutDir $mapOut
            $exitCode = $LASTEXITCODE
        }

        $results += [pscustomobject]@{
            mapId = $mapId
            mode = $selectedMode
            exitCode = $exitCode
            passed = ($exitCode -eq 0)
            report = $reportPath
            screenshot = $screenshotPath
        }

        $launchedProcesses = @(Get-LaunchedGameProcesses `
            -LaunchedAt $launchedAt `
            -ExcludedProcessIds $baselineProcessIds)
        $activeGameProcessIds = @($launchedProcesses | ForEach-Object { $_.Id })
        Stop-ExactGameProcesses -ProcessIds $activeGameProcessIds
        $activeGameProcessIds = @()
        $currentLaunchAt = $null
        $currentBaselineProcessIds = @()
        $completedMapCount++

        if ($selectedMode -eq "CDP") {
            $deadline = (Get-Date).AddSeconds(30)
            while ((Get-Date) -lt $deadline -and (Test-CdpReady)) {
                Start-Sleep -Milliseconds 500
            }
            if (Test-CdpReady) {
                throw "CEF CDP port $CdpPort did not close after map $mapId"
            }
        }
        if ($exitCode -eq 2) {
            Write-Warning "Fatal E2E failure on map $mapId; stopping the matrix."
            break
        }
        if ($completedMapCount -lt $MapIds.Count -and $InterMapDelaySeconds -gt 0) {
            Write-Host "Waiting $InterMapDelaySeconds seconds before the next Steam launch."
            Start-Sleep -Seconds $InterMapDelaySeconds
        }
    }
} finally {
    if ($null -ne $currentLaunchAt) {
        $activeGameProcessIds += @(
            Get-LaunchedGameProcesses `
                -LaunchedAt $currentLaunchAt `
                -ExcludedProcessIds $currentBaselineProcessIds |
                ForEach-Object { $_.Id }
        )
        $activeGameProcessIds = @($activeGameProcessIds | Sort-Object -Unique)
    }
    if ($activeGameProcessIds.Count -gt 0) {
        Stop-ExactGameProcesses -ProcessIds $activeGameProcessIds
    }
}

$summary = [pscustomobject]@{
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    appId = $AppId
    itemId = $ItemId
    hudName = $expectedName
    hudVersion = $expectedVersion
    requestedMode = $Mode
    careerId = $CareerId
    entityId = $EntityId
    combatRespawnCommand = $combatRespawnCommand
    gameLogPath = [System.IO.Path]::GetFullPath($GameLogPath)
    maps = $results
    passed = (
        $results.Count -eq $MapIds.Count -and
        @($results | Where-Object { -not $_.passed }).Count -eq 0
    )
}
$summaryPath = Join-Path $resolvedOut "summary.json"
$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $summaryPath -Encoding utf8NoBOM
Write-Host "Summary: $summaryPath"

if (-not $summary.passed) { exit 1 }
