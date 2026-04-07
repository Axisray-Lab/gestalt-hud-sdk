# Workshop Upload Guide

Upload your custom HUD to Steam Workshop so other players can subscribe and use it in Gestalt System.

## Prerequisites

- **SteamCMD** installed (default path: `C:\steamcmd\steamcmd.exe`)
- **Steam account** with Steamworks publishing permissions for the game
- A completed HUD folder with a valid `manifest.json`
- The game's **Steam App ID** (defaults to `4007690`)

## HUD Package Structure

Your upload folder must contain at minimum:

```
my-custom-hud/
├── manifest.json                        # Required: HUD metadata
├── index.html                           # Required: entry point
├── style.css                            # Your styles
├── hud.js                               # Your logic
├── gestalt-hud-sdk.workshop.umd.js      # SDK bundle (if using UMD)
└── preview.png                          # Recommended: Workshop preview (616x353 PNG)
```

### manifest.json

Every HUD must have a valid manifest:

```json
{
  "sdk_version": 1,
  "name": "My Custom HUD",
  "version": "1.0.0",
  "author": "your_name",
  "description": "A custom HUD overlay.",
  "compatible_maps": ["L_MapRMUL2026", "L_MapRMUL2026_IF"],
  "entry": "index.html"
}
```

### Files to Exclude

Do **not** include in your upload folder:

- `node_modules/`
- `.git/`
- Source maps (`.map` files)
- Build configs (`vite.config.ts`, `tsconfig.json`, etc.)
- Development dependencies

## Upload Script

The upload tool is `upload-workshop-hud.ps1` at the SDK repository root.

### First-Time Upload (Create New Item)

```powershell
.\upload-workshop-hud.ps1 `
    -ContentFolder ".\my-custom-hud" `
    -SteamUser <your_steam_username> `
    -SteamPass <your_steam_password>
```

The App ID defaults to `4007690` (Gestalt System). SteamCMD will output the new Workshop item ID — **save this ID** for future updates.

### Update an Existing Item

```powershell
.\upload-workshop-hud.ps1 `
    -ContentFolder ".\my-custom-hud" `
    -ItemId 123456789 `
    -ChangeNote "Fixed crosshair alignment" `
    -SteamUser <your_steam_username> `
    -SteamPass <your_steam_password>
```

### All Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `-ContentFolder` | Yes | — | Path to the HUD folder containing `manifest.json` |
| `-AppId` | No | `4007690` | Steam App ID. Falls back to `STEAM_APP_ID` env var, then `version.json` |
| `-ItemId` | No | `0` | Workshop item ID. `0` = create new, `>0` = update existing |
| `-Title` | No | from manifest | Workshop item title |
| `-Description` | No | from manifest | Workshop item description |
| `-ChangeNote` | No | `"Update"` | Change log entry for this version |
| `-PreviewImage` | No | auto-detect | Path to preview image. Auto-detects `preview.png` in content folder |
| `-SteamCmdPath` | No | `C:\steamcmd\steamcmd.exe` | Path to SteamCMD executable |
| `-SteamUser` | No* | `STEAM_BUILDER_USER` env var | Steam username |
| `-SteamPass` | No* | `STEAM_BUILDER_PASS` env var | Steam password |

*Required either as parameter or environment variable.

### Using Environment Variables

To avoid passing credentials every time:

```powershell
$env:STEAM_BUILDER_USER = "your_username"
$env:STEAM_BUILDER_PASS = "your_password"

.\upload-workshop-hud.ps1 -ContentFolder ".\my-custom-hud"
```

## What Happens During Upload

1. The script reads `manifest.json` from your content folder
2. Extracts `name` and `description` as the Workshop item title/description
3. Generates a SteamCMD VDF file with the `"HUD"` tag
4. If `preview.png` exists in the content folder (or `-PreviewImage` is specified), it's included as the Workshop preview
5. Calls SteamCMD `workshop_build_item` to upload
6. The HUD appears in the game's Workshop HUD management page (System Settings > Workshop HUD)

## Version Updates

When releasing a new version of your HUD:

1. Update the `version` field in `manifest.json`
2. Run the upload script with the same `-ItemId` and a descriptive `-ChangeNote`
3. Players who have subscribed will receive the update automatically

## Preview Image

Workshop items with a preview image get significantly more visibility. Recommended:

- **Format**: PNG
- **Size**: 616 x 353 pixels
- **Content**: Screenshot of your HUD in action, or a styled logo

Place it as `preview.png` in your content folder — the script detects it automatically.

## Troubleshooting

### "manifest.json not found"

Ensure `-ContentFolder` points to a directory containing `manifest.json`, not the parent directory.

### "Steam AppId required"

Provide the game's App ID via `-AppId`, the `STEAM_APP_ID` environment variable, or ensure `version.json` exists in the expected location.

### "SteamCMD not found"

Install SteamCMD or specify its path with `-SteamCmdPath`.

### "Steam credentials required"

Provide credentials via `-SteamUser`/`-SteamPass` parameters or `STEAM_BUILDER_USER`/`STEAM_BUILDER_PASS` environment variables.

### Upload succeeds but HUD doesn't appear in game

- Verify the Workshop item has the `"HUD"` tag (set automatically by the script)
- Check that `compatible_maps` in your manifest includes the current map
- Ensure `sdk_version` matches the game's expected version (currently `1`)
- Restart the game after subscribing to a new Workshop item
