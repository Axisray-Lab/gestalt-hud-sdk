param(
    [Parameter(Mandatory = $true)]
    [int]$MapId,
    [Parameter(Mandatory = $true)]
    [string]$ExpectedName,
    [string]$ExpectedVersion = "",
    [int]$ExpectedCareerId = 0,
    [uint64]$ItemId = 3698375578,
    [string]$LogPath = "$env:LOCALAPPDATA\RobotBridgeDemo\Saved\Logs\RobotBridgeDemo.log",
    [long]$LogStartOffset = 0,
    [long]$LogStartCreationTimeUtcTicks = 0,
    [int]$TimeoutSeconds = 180,
    [int]$StabilitySeconds = 60,
    [int]$GameProcessId = 0,
    [Parameter(Mandatory = $true)]
    [string]$OutDir
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
if ($ExpectedCareerId -lt 0) { throw "ExpectedCareerId cannot be negative." }

$telemetryMarker = "GESTALT_HUD_E2E "
$resolvedOut = [System.IO.Path]::GetFullPath($OutDir)
$reportPath = Join-Path $resolvedOut "map-$MapId-report.json"
$screenshotPath = Join-Path $resolvedOut "map-$MapId-hud.png"
$protocolReportPath = Join-Path $resolvedOut "map-$MapId-protocol.json"
$report = [ordered]@{
    startedAt = (Get-Date).ToUniversalTime().ToString("o")
    mapId = $MapId
    expectedName = $ExpectedName
    expectedVersion = $ExpectedVersion
    expectedCareerId = $ExpectedCareerId
    mode = "Log+TrustedWebSocket"
    logPath = [System.IO.Path]::GetFullPath($LogPath)
    logWindow = [ordered]@{
        startOffset = $LogStartOffset
        startCreationTimeUtcTicks = $LogStartCreationTimeUtcTicks
    }
    workshop = [ordered]@{
        state = @()
        manifest = @()
        path = @()
    }
    webSocket = [ordered]@{
        host = "127.0.0.1"
        port = $null
        evidence = @()
    }
    mapEntered = [ordered]@{
        expectedId = $MapId
        localPlayerId = $null
        observedIds = @()
        evidence = @()
    }
    worldReady = [ordered]@{
        expectedId = $MapId
        observations = @()
        evidence = @()
    }
    trustedProtocol = [ordered]@{
        path = [System.IO.Path]::GetFullPath($protocolReportPath)
        localPlayerId = 0
        exitCode = $null
        stdout = ""
        stderr = ""
        report = $null
    }
    telemetry = [ordered]@{
        required = $false
        markerCount = 0
    }
    initialDiagnostics = $null
    diagnostics = $null
    screenshot = $null
    exceptions = @()
    checks = @()
    passed = $false
}

function Add-Check {
    param(
        [string]$Name,
        [bool]$Passed,
        [string]$Detail = ""
    )

    $report.checks += [ordered]@{
        name = $Name
        passed = $Passed
        detail = $Detail
    }
    $prefix = if ($Passed) { "PASS" } else { "FAIL" }
    Write-Host "[workshop-log-e2e] $prefix $Name$(if ($Detail) { " - $Detail" })"
    return $Passed
}

function Test-FiniteNumber {
    param([object]$Value)

    if ($null -eq $Value) { return $false }
    try {
        $number = [double]$Value
        return -not [double]::IsNaN($number) -and -not [double]::IsInfinity($number)
    } catch {
        return $false
    }
}

function Read-AppendedLogLines {
    param([pscustomobject]$State)

    if (-not (Test-Path -LiteralPath $State.Path -PathType Leaf)) {
        return @()
    }

    $file = Get-Item -LiteralPath $State.Path -ErrorAction Stop
    $creationTicks = $file.CreationTimeUtc.Ticks
    if (
        $file.Length -lt $State.Offset -or
        ($State.CreationTimeUtcTicks -ne 0 -and $creationTicks -ne $State.CreationTimeUtcTicks)
    ) {
        $State.Offset = 0L
        $State.Partial = ""
    }
    $State.CreationTimeUtcTicks = $creationTicks

    $stream = [System.IO.File]::Open(
        $State.Path,
        [System.IO.FileMode]::Open,
        [System.IO.FileAccess]::Read,
        [System.IO.FileShare]::ReadWrite -bor [System.IO.FileShare]::Delete
    )
    try {
        [void]$stream.Seek($State.Offset, [System.IO.SeekOrigin]::Begin)
        $reader = [System.IO.StreamReader]::new(
            $stream,
            [System.Text.UTF8Encoding]::new($false, $false),
            $true,
            4096,
            $true
        )
        try {
            $chunk = $reader.ReadToEnd()
            $State.Offset = $stream.Position
        } finally {
            $reader.Dispose()
        }
    } finally {
        $stream.Dispose()
    }

    if (-not $chunk) { return @() }
    $combined = $State.Partial + $chunk
    $parts = [regex]::Split($combined, "\r?\n")
    if ($combined.EndsWith("`n")) {
        $State.Partial = ""
        if ($parts.Count -gt 0 -and $parts[-1] -eq "") {
            $parts = @($parts[0..($parts.Count - 2)])
        }
    } else {
        $State.Partial = $parts[-1]
        if ($parts.Count -eq 1) { return @() }
        $parts = @($parts[0..($parts.Count - 2)])
    }
    return @($parts)
}

function ConvertFrom-TelemetryLine {
    param([string]$Line)

    $markerIndex = $Line.IndexOf($telemetryMarker, [System.StringComparison]::Ordinal)
    if ($markerIndex -lt 0) { return $null }
    $json = $Line.Substring($markerIndex + $telemetryMarker.Length).Trim()
    try {
        return $json | ConvertFrom-Json -ErrorAction Stop
    } catch {
        Write-Warning "Ignored malformed HUD telemetry marker: $($_.Exception.Message)"
        return $null
    }
}

function Add-UniqueEvidence {
    param(
        [string]$Bucket,
        [string]$Line
    )

    if ($report.workshop[$Bucket] -notcontains $Line) {
        $report.workshop[$Bucket] += $Line
    }
}

function Save-GameWindowScreenshot {
    param(
        [int]$ProcessId,
        [string]$Destination
    )

    if ($ProcessId -le 0) {
        throw "A game process id was not supplied"
    }
    if (-not ("GestaltHudE2E.NativeWindow" -as [type])) {
        Add-Type -AssemblyName System.Drawing
        Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

namespace GestaltHudE2E {
    public static class NativeWindow {
        [StructLayout(LayoutKind.Sequential)]
        public struct RECT { public int Left, Top, Right, Bottom; }

        [DllImport("user32.dll")]
        public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

        [DllImport("user32.dll")]
        public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint flags);

        [DllImport("user32.dll")]
        public static extern bool IsIconic(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern bool ShowWindow(IntPtr hWnd, int command);
    }
}
'@
    }

    $deadline = (Get-Date).AddSeconds(20)
    $handle = [IntPtr]::Zero
    do {
        $process = Get-Process -Id $ProcessId -ErrorAction Stop
        $process.Refresh()
        $handle = $process.MainWindowHandle
        if ($handle -ne [IntPtr]::Zero) { break }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)
    if ($handle -eq [IntPtr]::Zero) {
        throw "Game process $ProcessId has no main window"
    }

    if ([GestaltHudE2E.NativeWindow]::IsIconic($handle)) {
        [void][GestaltHudE2E.NativeWindow]::ShowWindow($handle, 9)
        Start-Sleep -Milliseconds 750
    }

    $rect = [GestaltHudE2E.NativeWindow+RECT]::new()
    if (-not [GestaltHudE2E.NativeWindow]::GetWindowRect($handle, [ref]$rect)) {
        throw "GetWindowRect failed for game process $ProcessId"
    }
    $width = $rect.Right - $rect.Left
    $height = $rect.Bottom - $rect.Top
    if ($width -le 0 -or $height -le 0) {
        throw "Game window has invalid bounds: ${width}x${height}"
    }

    $bitmap = [System.Drawing.Bitmap]::new($width, $height)
    try {
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $hdc = $graphics.GetHdc()
            try {
                $captured = [GestaltHudE2E.NativeWindow]::PrintWindow($handle, $hdc, 2)
            } finally {
                $graphics.ReleaseHdc($hdc)
            }
            if (-not $captured) {
                $graphics.CopyFromScreen(
                    $rect.Left,
                    $rect.Top,
                    0,
                    0,
                    [System.Drawing.Size]::new($width, $height),
                    [System.Drawing.CopyPixelOperation]::SourceCopy
                )
            }
        } finally {
            $graphics.Dispose()
        }
        $bitmap.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $bitmap.Dispose()
    }

    return [ordered]@{
        path = [System.IO.Path]::GetFullPath($Destination)
        width = $width
        height = $height
        processId = $ProcessId
    }
}

New-Item -ItemType Directory -Path $resolvedOut -Force | Out-Null
$state = [pscustomobject]@{
    Path = [System.IO.Path]::GetFullPath($LogPath)
    Offset = [math]::Max(0L, $LogStartOffset)
    CreationTimeUtcTicks = [math]::Max(0L, $LogStartCreationTimeUtcTicks)
    Partial = ""
}
$telemetry = [System.Collections.Generic.List[object]]::new()
$initial = $null
$final = $null
$initialObservedAt = $null
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$fatal = $false
$protocolProcess = $null
$protocolStdoutTask = $null
$protocolStderrTask = $null

function Process-AppendedLogLine {
    param([string]$Line)

    if ($Line -match "WebSocket server started on\s+127\.0\.0\.1:(?<port>\d+)") {
        $observedPort = [int]$Matches.port
        if ($observedPort -ge 1 -and $observedPort -le 65535) {
            $script:report.webSocket.port = $observedPort
            if ($script:report.webSocket.evidence -notcontains $Line) {
                $script:report.webSocket.evidence += $Line
            }
        }
    }
    if ($Line -match "\[AutoStart\]\s+Game entered.*`"map_id`"\s*:\s*(?<mapId>\d+)") {
        $observedMapId = [int]$Matches.mapId
        if ($script:report.mapEntered.observedIds -notcontains $observedMapId) {
            $script:report.mapEntered.observedIds += $observedMapId
        }
        if ($script:report.mapEntered.evidence -notcontains $Line) {
            $script:report.mapEntered.evidence += $Line
        }
        if ($Line -match "`"local_unique_player_id`"\s*:\s*(?<localPlayerId>\d+)") {
            $script:report.mapEntered.localPlayerId = [int]$Matches.localPlayerId
        }
    }
    if (
        $Line -match "\[LoadingGate\]\s+world_ready" -and
        $Line -match "actual_map_id=(?<mapId>\d+).*battle_map_id=(?<battleMapId>\S+).*base_count=(?<baseCount>\d+)"
    ) {
        $observation = [ordered]@{
            mapId = [int]$Matches.mapId
            battleMapId = [string]$Matches.battleMapId
            baseCount = [int]$Matches.baseCount
        }
        $duplicate = @($script:report.worldReady.observations | Where-Object {
            $_.mapId -eq $observation.mapId -and
            $_.battleMapId -eq $observation.battleMapId -and
            $_.baseCount -eq $observation.baseCount
        }).Count -gt 0
        if (-not $duplicate) {
            $script:report.worldReady.observations += $observation
        }
        if ($script:report.worldReady.evidence -notcontains $Line) {
            $script:report.worldReady.evidence += $Line
        }
    }
    if ($Line -match "\[Workshop\].*Item\s+$ItemId\s+state:") {
        Add-UniqueEvidence -Bucket "state" -Line $Line
    }
    if ($Line -match "\[Workshop\].*Item\s+$ItemId\s+manifest OK:") {
        Add-UniqueEvidence -Bucket "manifest" -Line $Line
    }
    if (
        $Line -match "Workshop HUD (?:path set to|set from):" -and
        $Line -match [regex]::Escape([string]$ItemId)
    ) {
        Add-UniqueEvidence -Bucket "path" -Line $Line
    }

    $snapshot = ConvertFrom-TelemetryLine -Line $Line
    if ($null -eq $snapshot) { return }
    $script:telemetry.Add($snapshot)
    $script:report.telemetry.markerCount = $script:telemetry.Count
    try {
        if (
            $null -eq $script:initial -and
            $snapshot.initReceived -eq $true -and
            $snapshot.readySent -eq $true -and
            [int64]$snapshot.updateCount -gt 0
        ) {
            $script:initial = $snapshot
            $script:initialObservedAt = Get-Date
            Write-Host "[workshop-log-e2e] Optional telemetry received at update $($snapshot.updateCount)."
        }
        if (
            $null -ne $script:initial -and
            [int64]$snapshot.updateCount -gt [int64]$script:initial.updateCount -and
            ((Get-Date) - $script:initialObservedAt).TotalSeconds -ge $StabilitySeconds
        ) {
            $script:final = $snapshot
        }
    } catch {
        Write-Warning "Ignored incomplete optional HUD telemetry: $($_.Exception.Message)"
    }
}

function Test-RequiredLogEvidence {
    $stateReady = @($report.workshop.state | Where-Object {
        $_ -match "Subscribed=1" -and $_ -match "Installed=1" -and
        $_ -match "NeedsUpdate=0" -and $_ -match "Downloading=0"
    }).Count -gt 0
    $manifestReady = @($report.workshop.manifest | Where-Object {
        $_ -match [regex]::Escape("name='$ExpectedName'") -and
        (-not $ExpectedVersion -or $_ -match [regex]::Escape("version='$ExpectedVersion'"))
    }).Count -gt 0
    $worldReady = @($report.worldReady.observations | Where-Object {
        $_.mapId -eq $MapId -and
        $_.battleMapId -ne "null" -and
        $_.baseCount -gt 0
    }).Count -gt 0
    return (
        $null -ne $report.webSocket.port -and
        $report.mapEntered.observedIds -contains $MapId -and
        $null -ne $report.mapEntered.localPlayerId -and
        $worldReady -and
        $stateReady -and
        $manifestReady -and
        $report.workshop.path.Count -gt 0
    )
}

function Start-TrustedProtocolProbe {
    if ($null -ne $script:protocolProcess) { return }
    $remainingMilliseconds = [math]::Max(
        1,
        [int][math]::Floor(($script:deadline - (Get-Date)).TotalMilliseconds)
    )
    $nodePath = (Get-Command node -ErrorAction Stop).Source
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $nodePath
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    foreach ($argument in @(
        (Join-Path $PSScriptRoot "trusted-game-protocol-e2e.mjs"),
        "--port", [string]$script:report.webSocket.port,
        "--map-id", [string]$MapId,
        "--local-player-id", [string]$script:report.trustedProtocol.localPlayerId,
        "--expected-career-id", [string]$ExpectedCareerId,
        "--timeout-ms", [string]$remainingMilliseconds,
        "--stability-ms", [string]($StabilitySeconds * 1000),
        "--out", $protocolReportPath
    )) {
        [void]$startInfo.ArgumentList.Add($argument)
    }
    $script:protocolProcess = [System.Diagnostics.Process]::Start($startInfo)
    if ($null -eq $script:protocolProcess) {
        throw "Failed to start the trusted protocol probe"
    }
    $script:protocolStdoutTask = $script:protocolProcess.StandardOutput.ReadToEndAsync()
    $script:protocolStderrTask = $script:protocolProcess.StandardError.ReadToEndAsync()
    Write-Host (
        "[workshop-log-e2e] Trusted protocol probe started on 127.0.0.1:" +
        "$($script:report.webSocket.port) (PID $($script:protocolProcess.Id))."
    )
}

function Complete-TrustedProtocolProbe {
    if ($null -eq $script:protocolProcess) { return }
    $remainingMilliseconds = [math]::Max(
        5000,
        [int][math]::Floor(($script:deadline - (Get-Date)).TotalMilliseconds) + 5000
    )
    if (-not $script:protocolProcess.WaitForExit($remainingMilliseconds)) {
        try { $script:protocolProcess.Kill($true) } catch { }
        [void]$script:protocolProcess.WaitForExit(5000)
        $script:report.exceptions += [ordered]@{
            stage = "trusted-protocol-timeout"
            message = "Trusted protocol probe exceeded the launch-window timeout"
        }
    }
    $script:report.trustedProtocol.stdout = $script:protocolStdoutTask.GetAwaiter().GetResult()
    $script:report.trustedProtocol.stderr = $script:protocolStderrTask.GetAwaiter().GetResult()
    if ($script:report.trustedProtocol.stdout) {
        Write-Host $script:report.trustedProtocol.stdout.TrimEnd()
    }
    if ($script:report.trustedProtocol.stderr) {
        Write-Warning $script:report.trustedProtocol.stderr.TrimEnd()
    }
    if ($script:protocolProcess.HasExited) {
        $script:report.trustedProtocol.exitCode = $script:protocolProcess.ExitCode
    }
    if (Test-Path -LiteralPath $protocolReportPath -PathType Leaf) {
        $script:report.trustedProtocol.report = Get-Content `
            -LiteralPath $protocolReportPath `
            -Raw `
            -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop
    }
}

try {
    while ((Get-Date) -lt $deadline) {
        foreach ($line in @(Read-AppendedLogLines -State $state)) {
            Process-AppendedLogLine -Line $line
            if ($null -eq $protocolProcess -and $null -ne $report.webSocket.port) {
                Start-TrustedProtocolProbe
            }
        }
        if (Test-RequiredLogEvidence) { break }
        Start-Sleep -Milliseconds 500
    }

    Complete-TrustedProtocolProbe

    foreach ($line in @(Read-AppendedLogLines -State $state)) {
        Process-AppendedLogLine -Line $line
    }
    $report.initialDiagnostics = $initial
    if ($null -eq $final -and $telemetry.Count -gt 0) {
        $final = $telemetry[$telemetry.Count - 1]
    }
    $report.diagnostics = $final

    [void](Add-Check -Name "Workshop item is subscribed, installed, and current" -Passed (
        @($report.workshop.state | Where-Object {
            $_ -match "Subscribed=1" -and $_ -match "Installed=1" -and
            $_ -match "NeedsUpdate=0" -and $_ -match "Downloading=0"
        }).Count -gt 0
    ) -Detail ($report.workshop.state -join " | "))
    [void](Add-Check -Name "Workshop manifest matches release" -Passed (
        @($report.workshop.manifest | Where-Object {
            $_ -match [regex]::Escape("name='$ExpectedName'") -and
            (-not $ExpectedVersion -or $_ -match [regex]::Escape("version='$ExpectedVersion'"))
        }).Count -gt 0
    ) -Detail ($report.workshop.manifest -join " | "))
    [void](Add-Check -Name "Workshop HUD path selects the requested item" -Passed (
        $report.workshop.path.Count -gt 0
    ) -Detail ($report.workshop.path -join " | "))
    [void](Add-Check -Name "loopback trusted WebSocket endpoint was discovered" -Passed (
        $null -ne $report.webSocket.port
    ) -Detail $(if ($null -ne $report.webSocket.port) {
        "127.0.0.1:$($report.webSocket.port)"
    } else { $report.webSocket.evidence -join " | " }))
    [void](Add-Check -Name "game entered the requested map" -Passed (
        $report.mapEntered.observedIds -contains $MapId -and
        $null -ne $report.mapEntered.localPlayerId
    ) -Detail ($report.mapEntered.evidence -join " | "))
    [void](Add-Check -Name "late world-ready state has battle and base maps" -Passed (
        @($report.worldReady.observations | Where-Object {
            $_.mapId -eq $MapId -and
            $_.battleMapId -ne "null" -and
            $_.baseCount -gt 0
        }).Count -gt 0
    ) -Detail ($report.worldReady.evidence -join " | "))

    $protocolPassed = (
        $null -ne $report.trustedProtocol.exitCode -and
        [int]$report.trustedProtocol.exitCode -eq 0 -and
        $null -ne $report.trustedProtocol.report -and
        $report.trustedProtocol.report.passed -eq $true -and
        [int]$report.trustedProtocol.report.localPlayerId -eq
            [int]$report.mapEntered.localPlayerId
    )
    [void](Add-Check -Name "trusted game protocol probe passed" -Passed $protocolPassed -Detail (
        "$protocolReportPath (exit=$($report.trustedProtocol.exitCode))"
    ))

    try {
        $report.screenshot = Save-GameWindowScreenshot `
            -ProcessId $GameProcessId `
            -Destination $screenshotPath
        $report.screenshot["expectedVisible"] = @(
            "Workshop badge",
            "match timer",
            "base status bars",
            "health",
            "active ammunition"
        )
        [void](Add-Check -Name "game window screenshot captured" -Passed $true -Detail $screenshotPath)
    } catch {
        $report.exceptions += [ordered]@{ stage = "screenshot"; message = $_.Exception.Message }
        [void](Add-Check -Name "game window screenshot captured" -Passed $false -Detail $_.Exception.Message)
    }

    $report.passed = (
        $report.exceptions.Count -eq 0 -and
        @($report.checks | Where-Object { -not $_.passed }).Count -eq 0
    )
} catch {
    $fatal = $true
    $report.exceptions += [ordered]@{ stage = "log-e2e"; message = $_.Exception.Message }
    $report.checks += [ordered]@{
        name = "fatal error"
        passed = $false
        detail = $_.Exception.Message
    }
    $report.passed = $false
    Write-Host "[workshop-log-e2e] fatal: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    if ($null -ne $protocolProcess -and -not $protocolProcess.HasExited) {
        try { $protocolProcess.Kill($true) } catch { }
    }
    $report.logWindow.endOffset = $state.Offset
    $report.logWindow.endCreationTimeUtcTicks = $state.CreationTimeUtcTicks
    $report.finishedAt = (Get-Date).ToUniversalTime().ToString("o")
    $report | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $reportPath -Encoding utf8NoBOM
    Write-Host "[workshop-log-e2e] Report: $reportPath"
}

if ($fatal) { exit 2 }
if (-not $report.passed) { exit 1 }
exit 0
