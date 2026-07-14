Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-WorkshopRelativePath {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$Path
    )

    $rootPath = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
    $rootUri = [Uri]$rootPath
    $pathUri = [Uri][IO.Path]::GetFullPath($Path)
    return [Uri]::UnescapeDataString($rootUri.MakeRelativeUri($pathUri).ToString()).Replace('/', [IO.Path]::DirectorySeparatorChar)
}

function Test-WorkshopRelativePath {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$RelativePath
    )

    if ([string]::IsNullOrWhiteSpace($RelativePath) -or [IO.Path]::IsPathRooted($RelativePath)) {
        return $false
    }

    $rootPath = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
    $candidate = [IO.Path]::GetFullPath((Join-Path $rootPath $RelativePath))
    return $candidate.StartsWith($rootPath, [StringComparison]::OrdinalIgnoreCase)
}

function Get-WorkshopRequiredString {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name
    )

    $property = $Object.PSObject.Properties[$Name]
    if (-not $property -or -not ($property.Value -is [string]) -or [string]::IsNullOrWhiteSpace($property.Value)) {
        throw "manifest.json field '$Name' must be a non-empty string."
    }
    return $property.Value.Trim()
}

function Get-WorkshopHtmlLocalReferences {
    param([Parameter(Mandatory = $true)][string]$Html)

    $references = [Collections.Generic.List[string]]::new()
    $patterns = @(
        '(?i)(?:src|href)\s*=\s*"([^"]+)"',
        "(?i)(?:src|href)\s*=\s*'([^']+)'"
    )
    foreach ($pattern in $patterns) {
        foreach ($match in [regex]::Matches($Html, $pattern)) {
            $references.Add($match.Groups[1].Value)
        }
    }
    return $references
}

function Get-WorkshopManifestScriptContent {
    param([Parameter(Mandatory = $true)]$Manifest)

    $metadata = [ordered]@{
        name = [string]$Manifest.name
        version = [string]$Manifest.version
    } | ConvertTo-Json -Compress
    return "window.GESTALT_HUD_MANIFEST = Object.freeze($metadata);`n"
}

function Test-WorkshopCssAssets {
    param([Parameter(Mandatory = $true)][string]$ContentFolder)

    foreach ($cssFile in Get-ChildItem -LiteralPath $ContentFolder -Recurse -File -Filter '*.css') {
        $css = Get-Content -LiteralPath $cssFile.FullName -Raw -Encoding UTF8
        foreach ($match in [regex]::Matches($css, '(?i)url\(\s*([^)]+?)\s*\)')) {
            $reference = $match.Groups[1].Value.Trim().Trim('"', "'")
            if ([string]::IsNullOrWhiteSpace($reference) -or $reference.StartsWith('#') -or $reference.StartsWith('data:')) {
                continue
            }
            if ($reference -match '^(?i)(?:https?:|wss?:|//|javascript:|blob:)') {
                throw "External CSS resource '$reference' is not allowed: $($cssFile.FullName)"
            }

            $localReference = ($reference -split '[?#]', 2)[0]
            $cssDirectory = Split-Path -Parent $cssFile.FullName
            $relativeFromRoot = Join-Path (Get-WorkshopRelativePath -Root $ContentFolder -Path $cssDirectory) $localReference
            if (-not (Test-WorkshopRelativePath -Root $ContentFolder -RelativePath $relativeFromRoot)) {
                throw "CSS resource '$reference' escapes the HUD content directory: $($cssFile.FullName)"
            }
            $assetPath = [IO.Path]::GetFullPath((Join-Path $cssDirectory $localReference))
            if (-not (Test-Path -LiteralPath $assetPath -PathType Leaf)) {
                throw "CSS resource not found: $reference (from $($cssFile.FullName))"
            }
        }
    }
}

function Test-WorkshopHtml {
    param(
        [Parameter(Mandatory = $true)][string]$ContentFolder,
        [Parameter(Mandatory = $true)][string]$EntryPath
    )

    $html = Get-Content -LiteralPath $EntryPath -Raw -Encoding UTF8
    if ($html -notmatch '(?i)Content-Security-Policy') {
        throw 'The HUD entry HTML must include a Content-Security-Policy meta tag.'
    }
    if ($html -notmatch "(?i)connect-src\s+'none'") {
        throw "The HUD Content-Security-Policy must include connect-src 'none'."
    }
    if ($html -match '(?is)<script(?![^>]*\bsrc\s*=)[^>]*>\s*\S') {
        throw 'Inline scripts are not allowed by the release CSP. Move the script to a local .js file.'
    }
    if ($html -match '(?i)\son[a-z]+\s*=') {
        throw 'Inline HTML event handlers are not allowed by the release CSP.'
    }

    $entryDirectory = Split-Path -Parent $EntryPath
    foreach ($reference in Get-WorkshopHtmlLocalReferences -Html $html) {
        if ([string]::IsNullOrWhiteSpace($reference) -or $reference.StartsWith('#') -or $reference.StartsWith('data:')) {
            continue
        }
        if ($reference -match '^(?i)(?:https?:|wss?:|//|javascript:|blob:)') {
            throw "External resource '$reference' is not allowed by the release CSP."
        }

        $localReference = ($reference -split '[?#]', 2)[0]
        if ([string]::IsNullOrWhiteSpace($localReference)) {
            continue
        }
        $localReference = [Uri]::UnescapeDataString($localReference).Replace('/', [IO.Path]::DirectorySeparatorChar)
        if (-not (Test-WorkshopRelativePath -Root $ContentFolder -RelativePath (Join-Path (Get-WorkshopRelativePath -Root $ContentFolder -Path $entryDirectory) $localReference))) {
            throw "HTML resource '$reference' escapes the HUD content directory."
        }
        $assetPath = [IO.Path]::GetFullPath((Join-Path $entryDirectory $localReference))
        if (-not (Test-Path -LiteralPath $assetPath -PathType Leaf)) {
            throw "HTML resource not found: $reference"
        }
    }
}

function Test-WorkshopHud {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string]$ContentFolder)

    $resolvedFolder = (Resolve-Path -LiteralPath $ContentFolder).Path
    $manifestPath = Join-Path $resolvedFolder 'manifest.json'
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        throw "manifest.json not found: $manifestPath"
    }

    try {
        $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    }
    catch {
        throw "manifest.json is not valid UTF-8 JSON: $($_.Exception.Message)"
    }

    $name = Get-WorkshopRequiredString -Object $manifest -Name 'name'
    $version = Get-WorkshopRequiredString -Object $manifest -Name 'version'
    $null = Get-WorkshopRequiredString -Object $manifest -Name 'author'
    $null = Get-WorkshopRequiredString -Object $manifest -Name 'description'

    if ($version -notmatch '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$') {
        throw "manifest.json version '$version' must be a semantic version such as 1.2.3."
    }

    $sdkVersionProperty = $manifest.PSObject.Properties['sdk_version']
    if (-not $sdkVersionProperty -or [int]$sdkVersionProperty.Value -ne 2) {
        throw 'HUD SDK v0.2 release manifests must set sdk_version to 2.'
    }

    $providesProperty = $manifest.PSObject.Properties['provides']
    [object[]]$provides = if ($providesProperty) { @($providesProperty.Value) } else { @() }
    if ($provides.Count -ne 1 -or $provides[0] -ne 'hud') {
        throw 'This publisher accepts HUD-only mods: provides must be exactly ["hud"].'
    }

    $compatibleMapsProperty = $manifest.PSObject.Properties['compatible_maps']
    if ($compatibleMapsProperty -and $null -ne $compatibleMapsProperty.Value) {
        foreach ($mapName in @($compatibleMapsProperty.Value)) {
            if (-not ($mapName -is [string]) -or [string]::IsNullOrWhiteSpace($mapName)) {
                throw 'compatible_maps must be an array of non-empty map enum names, or an empty array for all maps.'
            }
        }
    }

    $entry = 'index.html'
    $entryProperty = $manifest.PSObject.Properties['entry']
    if ($entryProperty) {
        if (-not ($entryProperty.Value -is [string]) -or [string]::IsNullOrWhiteSpace($entryProperty.Value)) {
            throw 'manifest.json entry must be a non-empty relative path.'
        }
        $entry = $entryProperty.Value
    }
    if (-not (Test-WorkshopRelativePath -Root $resolvedFolder -RelativePath $entry)) {
        throw "manifest.json entry '$entry' is not a safe relative path."
    }
    $entryPath = [IO.Path]::GetFullPath((Join-Path $resolvedFolder $entry))
    if (-not (Test-Path -LiteralPath $entryPath -PathType Leaf)) {
        throw "HUD entry file not found: $entry"
    }
    if ([IO.Path]::GetExtension($entryPath) -ne '.html') {
        throw 'HUD entry must be an .html file.'
    }

    Test-WorkshopHtml -ContentFolder $resolvedFolder -EntryPath $entryPath
    Test-WorkshopCssAssets -ContentFolder $resolvedFolder

    $entryHtml = Get-Content -LiteralPath $entryPath -Raw -Encoding UTF8
    if ($entryHtml -match '(?i)src=["'']manifest\.js["'']') {
        $manifestScriptPath = Join-Path (Split-Path -Parent $entryPath) 'manifest.js'
        if (-not (Test-Path -LiteralPath $manifestScriptPath -PathType Leaf)) {
            throw 'The entry references manifest.js, but the file is missing.'
        }
        $actualManifestScript = [IO.File]::ReadAllText($manifestScriptPath).Replace("`r`n", "`n")
        $expectedManifestScript = Get-WorkshopManifestScriptContent -Manifest $manifest
        if ($actualManifestScript -ne $expectedManifestScript) {
            throw 'manifest.js name/version is stale. Run scripts/sync-workshop-assets.ps1.'
        }
    }

    return [pscustomobject]@{
        ContentFolder = $resolvedFolder
        ManifestPath = $manifestPath
        Manifest = $manifest
        Name = $name
        Version = $version
        Entry = $entry
        EntryPath = $entryPath
    }
}

function Write-WorkshopManifestScript {
    param(
        [Parameter(Mandatory = $true)][string]$ContentFolder,
        [Parameter(Mandatory = $true)]$Manifest
    )

    $entryPath = Join-Path $ContentFolder 'manifest.js'
    $content = Get-WorkshopManifestScriptContent -Manifest $Manifest
    [IO.File]::WriteAllText($entryPath, $content, [Text.UTF8Encoding]::new($false))
}

function Copy-WorkshopHudContent {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    $sourcePath = (Resolve-Path -LiteralPath $Source).Path
    $destinationPath = [IO.Path]::GetFullPath($Destination)
    New-Item -ItemType Directory -Path $destinationPath -Force | Out-Null

    $blockedDirectories = @('.git', '.github', '.idea', '.vscode', 'node_modules', 'src')
    $allowedExtensions = @(
        '.html', '.js', '.mjs', '.css', '.json', '.png', '.jpg', '.jpeg', '.webp',
        '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.wasm',
        '.mp3', '.ogg', '.wav'
    )

    foreach ($file in Get-ChildItem -LiteralPath $sourcePath -Recurse -File) {
        $relativePath = Get-WorkshopRelativePath -Root $sourcePath -Path $file.FullName
        $segments = $relativePath -split '[\\/]'
        if (@($segments | Where-Object { $blockedDirectories -contains $_ }).Count -gt 0) {
            continue
        }
        if ($allowedExtensions -notcontains $file.Extension.ToLowerInvariant()) {
            continue
        }

        $targetPath = Join-Path $destinationPath $relativePath
        $targetDirectory = Split-Path -Parent $targetPath
        New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
        Copy-Item -LiteralPath $file.FullName -Destination $targetPath -Force
    }

    $manifestPath = Join-Path $destinationPath 'manifest.json'
    if (Test-Path -LiteralPath $manifestPath -PathType Leaf) {
        $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $entry = if ($manifest.PSObject.Properties['entry']) { [string]$manifest.entry } else { 'index.html' }
        $entryPath = Join-Path $destinationPath $entry
        if ((Test-Path -LiteralPath $entryPath -PathType Leaf) -and (Get-Content -LiteralPath $entryPath -Raw -Encoding UTF8) -match '(?i)src=["'']manifest\.js["'']') {
            Write-WorkshopManifestScript -ContentFolder $destinationPath -Manifest $manifest
        }
    }

    return $destinationPath
}

function Remove-WorkshopWorkingDirectory {
    param(
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string]$StagingRoot
    )

    $workingPath = [IO.Path]::GetFullPath($WorkingDirectory)
    $rootPath = [IO.Path]::GetFullPath($StagingRoot).TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
    $leaf = Split-Path -Leaf $workingPath
    if (-not $workingPath.StartsWith($rootPath, [StringComparison]::OrdinalIgnoreCase) -or -not $leaf.StartsWith('gestalt-workshop-')) {
        throw "Refusing to remove unexpected staging path: $workingPath"
    }
    if (Test-Path -LiteralPath $workingPath) {
        Remove-Item -LiteralPath $workingPath -Recurse -Force
    }
}
