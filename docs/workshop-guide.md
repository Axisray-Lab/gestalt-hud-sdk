# Workshop HUD Development Guide

## Supported boundary

A public HUD mod is a static web application loaded by Gestalt System in a sandboxed iframe. Its supported data channel is the Workshop `postMessage` protocol through `GestaltHUDBridge`.

```text
Game UI (parent)
  ├─ hud:init
  ├─ hud:attribute_update
  └─ hud:game_event
           │ postMessage
           ▼
Workshop HUD (sandboxed iframe)
  ├─ hud:ready
  ├─ hud:action
  └─ hud:debug_log
```

The SDK's root WebSocket client is for trusted local tools. It is not part of the public Workshop capability set. Official HUD HTML uses `connect-src 'none'` so packaged code cannot open HTTP or WebSocket connections.

The iframe sandbox and CSP are complementary controls, not a promise that arbitrary same-origin development hosting is safe. Keep the parent and HUD on distinct origins while testing.

## Choose a template

| Directory | Use case |
| --- | --- |
| `template-workshop/` | Minimal pure HTML/CSS/JS |
| `template-workshop-1v1/` | Duel layout example |
| `template-workshop-rmuc2026/` | RMUC layout example |
| `template-workshop-rmul2026/` | RMUL layout example |
| `template-workshop-vue/` | Vue 3 + TypeScript reference |

Before copying a static template, build and synchronize its vendored SDK:

```powershell
npm ci
npm run build
npm run workshop:sync
Copy-Item -Recurse .\template-workshop ..\my-hud
```

This also generates `manifest.js` from `manifest.json`. Runtime `fetch(manifest.json)` is intentionally not used because release CSP blocks all connections.

## Manifest schema v2

```json
{
  "sdk_version": 2,
  "name": "My HUD",
  "version": "1.0.0",
  "author": "your_name",
  "description": "A custom HUD",
  "provides": ["hud"],
  "compatible_maps": [],
  "entry": "index.html"
}
```

| Field | Required | Meaning |
| --- | --- | --- |
| `sdk_version` | Yes | Manifest schema target; use `2` |
| `name` | Yes | Display name |
| `version` | Yes | Semantic content version |
| `author` | Yes | Creator |
| `description` | Yes | Short description |
| `provides` | Yes for SDK releases | Exactly `["hud"]` for this publisher |
| `compatible_maps` | No | Empty/omitted means all maps |
| `entry` | No | Relative HTML entry; defaults to `index.html` |

Manifest schema version 2 is independent of `WORKSHOP_HUD_PROTOCOL_VERSION`, which remains 1.

## Lifecycle

1. Register handlers immediately when the script loads.
2. The parent sends `hud:init` with map, local player, team, and mode.
3. Initialize UI state, then send one `hud:ready` containing the manifest name/version.
4. The parent streams complete `hud:attribute_update` snapshots.
5. Dispose listeners when a framework component unmounts.

```ts
const bridge = new GestaltHUDBridge();

const unsubscribeInit = bridge.onInit((init) => {
  applyContext(init);
  bridge.sendReady('My HUD', '1.0.0');
});

const unsubscribeData = bridge.onAttributeUpdate((snapshot) => {
  replaceScopes(snapshot);
});

// Framework teardown:
unsubscribeInit();
unsubscribeData();
bridge.destroy();
```

The parent may fall back to the built-in HUD if a mod never sends `hud:ready`; send it only after essential local initialization succeeds.

## Attribute data

```ts
interface HUDAttributeData {
  global: Record<string, number>;
  player: Record<string, number>;
  battle: Record<string, number>;
  base: Record<string, Record<string, number>>;
  playerBattle: Record<number, Record<string, number>>;
}
```

Every update is a full snapshot. Replace all five scopes, even when a scope is empty. Numeric FBS IDs become string object keys in JSON.

```ts
const hp = snapshot.battle[String(Attr.Health)] ?? 0;
const maxHp = snapshot.battle[String(Attr.HealthMax)] ?? 0;
```

The `base` scope currently carries the two main-base maps only. Keys are base entity IDs: red is `String(Attr.G_BaseId_0)` and blue is `String(Attr.G_BaseId_0 + 1)`. Do not infer teams from object order or expect outpost/buff/zone maps in this scope.

Bullet types use the public `ERobotBridgeDemoBulletType` enum:

| Type | Ammo attribute |
| --- | --- |
| `Projectile42mm` (0) | `Ammo42mmCount` |
| `Projectile17mm` (1) | `Ammo17mmCount` |
| `Dart` (2) | `AmmoDartCount` |
| `Laser` (3) | `AmmoLaserCount` |

Use the generated reference rather than copying numeric IDs by hand:

- [`generated/fbs-reference.md`](generated/fbs-reference.md)
- [`../protocol/protocol-reference.json`](../protocol/protocol-reference.json)
- `@axisray-lab/gestalt-hud-sdk/protocol`

## HUD messages

Messages accepted from the parent:

- `hud:init`
- `hud:attribute_update`
- `hud:game_event`

Messages emitted by a HUD:

- `hud:ready`
- `hud:action`
- `hud:debug_log`

The SDK validates runtime message shape and source. Do not add private JSON-RPC methods to a Workshop HUD. See [HUD Communication API](hud-api.md).

## Production HTML policy

The official templates use:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'" />
```

Consequences:

- Package scripts, styles, fonts, and images locally.
- Do not use CDN scripts or web fonts.
- Do not fetch manifest or remote configuration at runtime.
- Do not use inline scripts or HTML event handlers.
- A Vue production build may use local hashed assets; Vite development strips the meta tag only in serve mode for HMR.

## Offline testing

```powershell
npx serve . -l 8080
```

Open `http://localhost:8080/devtools/index.html`, and use `http://127.0.0.1:8080/template-workshop/index.html` as the HUD URL.

DevTools now mirrors the iframe sandbox, validates the child window/origin, includes `L_Map2026_IF`, and sends the current `hud:init` shape without the retired `wsPort` field.

Test at least:

- real `hud:ready` handshake with Bypass disabled;
- empty and repopulated scopes;
- low health, defeated, overheated, and team switch presets;
- 42mm, 17mm, dart, and laser ammo mapping;
- map ID 8 (`L_Map2026_IF`);
- refresh/reinitialize behavior.

## Build and release validation

```powershell
npm test
pwsh -NoProfile -File .\scripts\validate-workshop-hud.ps1 `
  -ContentFolder .\my-hud
```

For Vue, validate the built `dist/`, not the source project directory:

```powershell
npm run typecheck
npm run build:workshop
pwsh -NoProfile -File ..\gestalt-hud-sdk\scripts\validate-workshop-hud.ps1 `
  -ContentFolder .\dist
```

The validator checks manifest semantics, CSP, missing HTML/CSS resources, remote URLs, inline scripts, and static manifest metadata.

## Publish

Steam Workshop receives the final HUD directory. It does not receive the SDK source or npm tarball.

```powershell
.\upload-workshop-hud.ps1 -ContentFolder .\my-hud `
  -ItemId <existing-item-id> -Visibility Private -DryRun
```

See [Workshop Upload](workshop-upload.md) for creation, update, visibility, Steam Guard, and staging details.

## Troubleshooting

### `GestaltHUD` is undefined

Run `npm run build` and `npm run workshop:sync`, then confirm `gestalt-hud-sdk.workshop.umd.js` is beside the HTML entry.

### HUD loads but receives no data

Disable DevTools Bypass and confirm the log contains `hud:init` followed by `hud:ready`. Register `onInit` before other asynchronous work.

### Manifest name/version is wrong

Run `npm run workshop:sync`. The validator rejects a stale `manifest.js`.

### A local asset is blocked or missing

Run the validator. Release HTML allows only local resources and data images/fonts; network resources are intentionally rejected.

### DevTools rejects the HUD URL

Do not put parent and child on the exact same origin. Open DevTools on `localhost` and load the HUD using `127.0.0.1`, or use a separate Vite port.
