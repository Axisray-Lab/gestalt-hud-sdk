# Getting Started

This guide creates a HUD-only Workshop mod against Gestalt HUD SDK 0.2.

## Prerequisites

- Node.js 22 or later
- npm 11 or later
- PowerShell 7 for the release scripts
- SteamCMD only when uploading to Workshop

The public Workshop API is `postMessage` through `GestaltHUDBridge`. Do not use the root WebSocket client in a Workshop HUD.

## 1. Choose a starter

For a no-build HUD:

```powershell
npm ci
npm run build
npm run workshop:sync
Copy-Item -Recurse .\template-workshop ..\my-hud
```

`workshop:sync` vendors the current UMD build and generates local manifest metadata, so the copied directory is self-contained.

For Vue 3:

```powershell
$hud = New-Item -ItemType Directory ..\my-vue-hud -Force
Get-ChildItem .\template-workshop-vue -Force |
  Where-Object Name -NotIn @('node_modules', 'dist') |
  Copy-Item -Destination $hud.FullName -Recurse
New-Item -ItemType Directory ..\my-vue-hud\vendor -Force
npm pack --pack-destination ..\my-vue-hud\vendor
Set-Location ..\my-vue-hud
npm install .\vendor\axisray-lab-gestalt-hud-sdk-0.2.1.tgz --save-exact
npm install
```

The repository template intentionally uses `file:..` for clone-based local development. SDK `0.2.1` is not currently published to npm, so an external copy must install the generated tarball before a plain `npm install`. The tarball command rewrites the copied dependency to its local `vendor/` file instead of resolving the copied folder's parent by mistake.

## 2. Edit the manifest

Start from this HUD-only schema v2 manifest:

```json
{
  "sdk_version": 2,
  "name": "My HUD",
  "version": "1.0.0",
  "author": "your_name",
  "description": "A custom Gestalt HUD",
  "provides": ["hud"],
  "compatible_maps": [],
  "entry": "index.html"
}
```

Use an empty `compatible_maps` array for all maps. List enum names only when a HUD is intentionally map-specific. The complete current map enum is generated from [`../schemas/fbs/RobotBridgeDemoMapDefine.fbs`](../schemas/fbs/RobotBridgeDemoMapDefine.fbs).

## 3. Connect the bridge

Bundled TypeScript:

```ts
import {
  GestaltHUDBridge,
  ERobotBridgeDemoAttributeId as Attr,
} from '@axisray-lab/gestalt-hud-sdk/workshop';

const bridge = new GestaltHUDBridge();

bridge.onInit((context) => {
  console.info(`Loaded on ${context.mapName}`);
  bridge.sendReady('My HUD', '1.0.0');
});

bridge.onAttributeUpdate((snapshot) => {
  const hp = snapshot.battle[String(Attr.Health)] ?? 0;
  const max = snapshot.battle[String(Attr.HealthMax)] ?? 0;
  document.querySelector('#health')!.textContent = `${hp} / ${max}`;
});
```

No-build HTML loads the local UMD first:

```html
<script src="manifest.js"></script>
<script src="gestalt-hud-sdk.workshop.umd.js"></script>
<script src="hud.js"></script>
```

Then use `GestaltHUD.GestaltHUDBridge` and `GestaltHUD.ERobotBridgeDemoAttributeId` from `hud.js`.

## 4. Handle complete snapshots

Each update contains five scopes:

| Scope | Meaning |
| --- | --- |
| `global` | Match-wide state and timers |
| `player` | Local player metadata |
| `battle` | Local robot/combat state |
| `base` | Main-base maps keyed by base entity ID (`G_BaseId_0 + teamId`) |
| `playerBattle` | Per-player battle maps keyed by player ID |

Keys are strings after JSON serialization. Replace scope state on every update:

```ts
battle.value = { ...(snapshot.battle ?? {}) };
player.value = { ...(snapshot.player ?? {}) };
base.value = { ...(snapshot.base ?? {}) };
```

Do not only merge present keys; the host sends full snapshots, and removed keys must disappear from your UI state.

The current host forwards only the two main bases in `data.base`. Read red/blue explicitly rather than relying on object enumeration order:

```ts
const redBase = snapshot.base[String(Attr.G_BaseId_0)] ?? {};
const blueBase = snapshot.base[String(Attr.G_BaseId_0 + 1)] ?? {};
```

Outpost, buff-station, and zone maps are not appended to this scope. Consume their explicit global attributes when the protocol defines them.

## 5. Test in DevTools

From the SDK repository:

```powershell
npx serve . -l 8080
```

Open [http://localhost:8080/devtools/index.html](http://localhost:8080/devtools/index.html). Load the static HUD through the alternate loopback hostname:

```text
http://127.0.0.1:8080/template-workshop/index.html
```

The different origins preserve the game's iframe isolation. The DevTools iframe uses the same `sandbox="allow-scripts allow-same-origin"` policy and rejects a same-origin HUD URL.

For the Vue template, start `npm run dev` and load `http://127.0.0.1:5175/index.html`.

## 6. Build and validate

Static templates need no app build, but must carry the latest UMD:

```powershell
npm run build
npm run workshop:sync
npm run workshop:check
pwsh -NoProfile -File .\scripts\validate-workshop-hud.ps1 `
  -ContentFolder .\template-workshop
```

Vue:

```powershell
npm run typecheck
npm run build:workshop
pwsh -NoProfile -File ..\gestalt-hud-sdk\scripts\validate-workshop-hud.ps1 `
  -ContentFolder .\dist
```

The production HTML keeps `connect-src 'none'`; the Vue Vite dev server removes that meta tag only while serving locally so HMR can function.

## 7. Protocol reference

- Raw FBS: [`../schemas/fbs/`](../schemas/fbs/)
- Provenance: [`../schemas/source.json`](../schemas/source.json)
- Complete human reference: [`generated/fbs-reference.md`](generated/fbs-reference.md)
- Machine index: [`../protocol/protocol-reference.json`](../protocol/protocol-reference.json)
- TypeScript entry: `@axisray-lab/gestalt-hud-sdk/protocol`

## 8. Publish a HUD mod

Steam Workshop receives the validated HUD directory, not the SDK tarball. Run an explicit dry run first:

```powershell
.\upload-workshop-hud.ps1 -ContentFolder .\my-hud `
  -ItemId <existing-item-id> -Visibility Private -DryRun
```

See [Workshop Upload](workshop-upload.md) before removing `-DryRun`.
