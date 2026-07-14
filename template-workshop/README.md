# Minimal Workshop HUD Template

Pure HTML/CSS/JS starter for Gestalt HUD SDK 0.2. It is a HUD-only schema v2 mod and requires no application build step.

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | Workshop schema v2 metadata |
| `manifest.js` | Local name/version generated from the manifest |
| `index.html` | Sandboxed iframe entry with release CSP |
| `style.css` | Local HUD styling |
| `hud.js` | Bridge lifecycle and rendering |
| `gestalt-hud-sdk.workshop.umd.js` | Vendored Workshop SDK |

The CSP includes `connect-src 'none'`. All assets must be local, and the HUD must use only parent-provided `postMessage` data.

## Copy safely

From the SDK repository:

```powershell
npm ci
npm run build
npm run workshop:sync
Copy-Item -Recurse .\template-workshop ..\my-custom-hud
```

`workshop:sync` guarantees that the vendored UMD matches the current build and that `manifest.js` matches `manifest.json`.

After changing the manifest in a repository template, run the sync command again. In an independent project, generate equivalent local metadata or edit both files together; the release validator rejects stale metadata.

## Test

```powershell
npx serve . -l 8080
```

Open `http://localhost:8080/devtools/index.html` and load:

```text
http://127.0.0.1:8080/template-workshop/index.html
```

Keep DevTools and HUD on different origins. Send Init with Bypass disabled to test the real `hud:init` → `hud:ready` handshake.

## Validate

```powershell
pwsh -NoProfile -File .\scripts\validate-workshop-hud.ps1 `
  -ContentFolder .\template-workshop
```

## Data notes

- Treat every attribute update as a complete snapshot.
- Attribute object keys are string forms of numeric FBS IDs.
- `BulletType` maps 0/1/2/3 to 42mm/17mm/dart/laser ammo.
- Use [`../docs/generated/fbs-reference.md`](../docs/generated/fbs-reference.md) for the complete current public protocol.
