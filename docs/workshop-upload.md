# Steam Workshop Upload Guide

This workflow uploads a built HUD mod. It does not upload or distribute the npm SDK package.

## Prerequisites

- A Steam account that owns or has publishing access to App ID `4007690`
- SteamCMD installed, by default at `C:\steamcmd\steamcmd.exe`
- PowerShell 7
- A HUD-only schema v2 `manifest.json`
- A PNG/JPEG preview image

Steam Guard may require interactive confirmation. The publisher deliberately has no `-SteamPass` option and never places a password on the command line.

## Release directory

Pure HTML example:

```text
my-hud/
├── manifest.json
├── manifest.js
├── index.html
├── hud.js
├── style.css
├── gestalt-hud-sdk.workshop.umd.js
└── assets/
```

Vue example: use `template-workshop-vue/dist/` after `npm run build:workshop`.

The publisher creates a separate staging directory and copies only runtime extensions. Source files, `node_modules`, `.git`, source maps, PowerShell scripts, and editor settings are not uploaded.

## 1. Build and synchronize

For a repository static template:

```powershell
npm run build
npm run workshop:sync
npm run workshop:check
```

For Vue:

```powershell
Set-Location .\template-workshop-vue
npm run typecheck
npm run build:workshop
Set-Location ..
```

## 2. Validate

```powershell
pwsh -NoProfile -File .\scripts\validate-workshop-hud.ps1 `
  -ContentFolder .\publish-test
```

Validation includes:

- required manifest strings and semantic version;
- `sdk_version: 2` and `provides: ["hud"]`;
- safe local HTML entry;
- production CSP with `connect-src 'none'`;
- no inline scripts/handlers or remote HTML/CSS assets;
- all referenced local HTML/CSS files exist;
- `manifest.js` name/version matches `manifest.json`.

## 3. Inspect a dry run

Updating the official example candidate requires naming its ID explicitly:

```powershell
.\upload-workshop-hud.ps1 `
  -ContentFolder .\publish-test `
  -ItemId 3698375578 `
  -Visibility Private `
  -ChangeNote 'SDK v0.2 protocol update' `
  -DryRun
```

The script prints and retains:

- the allowlisted staging content;
- the resolved manifest metadata;
- target App ID and Item ID;
- visibility and preview path;
- UTF-8 `workshop-item.vdf`.

Inspect those files before a real upload. `3698375578` is not built into the script and cannot be updated accidentally by omitting `-ItemId`.

## 4. Upload an existing item

```powershell
.\upload-workshop-hud.ps1 `
  -ContentFolder .\publish-test `
  -ItemId 3698375578 `
  -Visibility Private `
  -ChangeNote 'SDK v0.2 protocol update' `
  -SteamUser <account-name>
```

The command has high-impact confirmation. SteamCMD then prompts interactively for the password and Steam Guard code when its cached session is insufficient.

For automation, `STEAM_BUILDER_USER` may provide only the account name. Keep authentication in SteamCMD's own credential/session mechanism; do not add passwords to scripts, environment variables, or CI logs.

## 5. Create a new private item

Creation must also be explicit:

```powershell
.\upload-workshop-hud.ps1 `
  -ContentFolder .\my-hud `
  -CreateNew `
  -Visibility Private `
  -SteamUser <account-name>
```

Record the `publishedfileid` from SteamCMD output and use `-ItemId` on all future updates.

## Visibility

| Value | Steam value | Notes |
| --- | ---: | --- |
| `Private` | 2 | Default and recommended for QA |
| `FriendsOnly` | 1 | Limited audience |
| `Unlisted` | 3 | Link-accessible where Steam supports it |
| `Public` | 0 | Requires the extra `-ConfirmPublic` switch |

Example public promotion after private validation:

```powershell
.\upload-workshop-hud.ps1 -ContentFolder .\publish-test `
  -ItemId 3698375578 -Visibility Public -ConfirmPublic `
  -ChangeNote 'Public SDK v0.2 HUD release' -SteamUser <account-name>
```

## Publisher parameters

| Parameter | Meaning |
| --- | --- |
| `-ContentFolder` | Built/static HUD directory |
| `-ItemId` | Existing target; required unless `-CreateNew` |
| `-CreateNew` | Explicit new-item mode |
| `-AppId` | Defaults to `4007690` |
| `-Visibility` | Defaults to `Private` |
| `-ConfirmPublic` | Required for public upload |
| `-Title` / `-Description` | Override manifest metadata |
| `-ChangeNote` | Workshop change note |
| `-PreviewImage` | PNG/JPEG; defaults to `preview.png` in content |
| `-SteamCmdPath` | Defaults to `C:\steamcmd\steamcmd.exe`, then PATH |
| `-SteamUser` | Account name only; may use `STEAM_BUILDER_USER` |
| `-StagingRoot` | Parent for unique safe staging directories |
| `-DryRun` | Validate/stage only; never invokes SteamCMD |
| `-KeepStaging` | Retain files after a successful upload |

## What the script guarantees

- It refuses ambiguous create/update mode.
- It refuses public visibility without explicit confirmation.
- It validates both source and staged content.
- It writes VDF as UTF-8 without BOM, preserving Chinese metadata.
- It never accepts a command-line password.
- It uses a uniquely named working directory and safety-checks cleanup.
- Failed and dry-run staging is retained for investigation.

## After upload

1. Open the Workshop item in the signed-in Steam client.
2. Confirm the intended account is subscribed.
3. Allow Steam to download/update the content.
4. Compare installed content hashes with staging.
5. Launch the game through Steam and run the Workshop HUD E2E.
6. Promote visibility only after the private item passes.

SteamCMD uploading or downloading does not substitute for the Steam client's account subscription state.

## Troubleshooting

### Target mode error

Pass either `-CreateNew` or `-ItemId`, never neither/both.

### Validation reports stale `manifest.js`

For repository templates, run `npm run workshop:sync`. For a custom static HUD, update local metadata from its manifest before staging.

### Missing UMD bundle

Run `npm run build` followed by `npm run workshop:sync`, or copy the resulting `dist/workshop.umd.js` into the custom HUD under the filename referenced by its HTML.

### SteamCMD authentication fails

Run SteamCMD interactively, complete Steam Guard, and retry. Do not work around this by passing the password in a command invocation.

### Upload succeeds but the HUD is absent in game

Check the signed-in client's subscription state, download completion, manifest validity, and map compatibility. Empty `compatible_maps` supports every built-in map.
