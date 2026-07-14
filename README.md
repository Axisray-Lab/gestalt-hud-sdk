# Gestalt HUD SDK

Public SDK for building Steam Workshop HUD mods for Gestalt System.

Version 0.2 publishes the complete public FBS protocol surface and defines one supported mod boundary: a HUD runs in the game's sandboxed iframe and exchanges versioned `postMessage` messages through `GestaltHUDBridge`.

The root `HUDBridge`/`AttributeStore` WebSocket client is retained only for trusted local tooling. It is not a Workshop API and must not be bundled into a Steam HUD.

## What is public

- Raw source schemas: [`schemas/fbs/`](schemas/fbs/)
- Schema provenance and hashes: [`schemas/source.json`](schemas/source.json)
- Generated TypeScript enums/types: [`src/protocol/generated/`](src/protocol/generated/)
- Machine-readable index: [`protocol/protocol-reference.json`](protocol/protocol-reference.json)
- Human-readable FBS reference: [`docs/generated/fbs-reference.md`](docs/generated/fbs-reference.md)
- Workshop bridge and message types: `@axisray-lab/gestalt-hud-sdk/workshop`
- Protocol-only package entry: `@axisray-lab/gestalt-hud-sdk/protocol`

Generated protocol files must not be edited by hand. Regenerate them from the public schemas with `npm run protocol:generate`; CI-style drift checking is available through `npm run protocol:verify`.

## Quick start: pure HTML/JS

```powershell
npm ci
npm run build
npm run workshop:sync
Copy-Item -Recurse .\template-workshop ..\my-gestalt-hud
npx serve . -l 8080
```

Open [http://localhost:8080/devtools/index.html](http://localhost:8080/devtools/index.html), then load:

```text
http://127.0.0.1:8080/template-workshop/index.html
```

Using `localhost` for DevTools and `127.0.0.1` for the HUD deliberately keeps the two frames on different origins, like the game.

Every static template is self-contained after `npm run workshop:sync`; its local UMD bundle is verified against `dist/workshop.umd.js` by `npm run workshop:check`.

## Quick start: Vue 3

Inside this repository, the Vue starter uses `file:..` so clone-based development works without a registry. SDK `0.2.0` is not currently published to npm. Before copying the starter elsewhere, package the SDK into the new project:

```powershell
$hud = New-Item -ItemType Directory ..\my-vue-hud -Force
Get-ChildItem .\template-workshop-vue -Force |
  Where-Object Name -NotIn @('node_modules', 'dist') |
  Copy-Item -Destination $hud.FullName -Recurse
New-Item -ItemType Directory ..\my-vue-hud\vendor -Force
npm pack --pack-destination ..\my-vue-hud\vendor
Set-Location ..\my-vue-hud
npm install .\vendor\axisray-lab-gestalt-hud-sdk-0.2.0.tgz --save-exact
npm install
npm run dev
```

Installing the tarball first rewrites the copied project's dependency away from `file:..`; do not run a plain install in the copied directory first.

Build the actual Workshop directory with:

```powershell
npm run typecheck
npm run build:workshop
```

`build:workshop` places `manifest.json` beside the built `index.html` in `dist/`.

## Workshop lifecycle

```text
Game parent                      Workshop HUD iframe
    | ------- hud:init --------------------> |
    | <------ hud:ready -------------------- |
    | ------- hud:attribute_update --------> |
    | ------- hud:game_event --------------> |
    | <------ hud:action / hud:debug_log --- |
```

```ts
import {
  GestaltHUDBridge,
  ERobotBridgeDemoAttributeId as Attr,
} from '@axisray-lab/gestalt-hud-sdk/workshop';

const bridge = new GestaltHUDBridge();

bridge.onInit(() => {
  bridge.sendReady('My HUD', '1.0.0');
});

bridge.onAttributeUpdate((data) => {
  const health = data.battle[String(Attr.Health)] ?? 0;
  const healthMax = data.battle[String(Attr.HealthMax)] ?? 0;
  renderHealth(health, healthMax);
});
```

Attribute keys are JSON object keys and therefore strings at runtime. Treat each `hud:attribute_update` as a complete snapshot: replace every scope, including scopes that become empty, rather than merging forever.

`data.base` currently contains the two main-base entity maps only, keyed by `String(Attr.G_BaseId_0 + teamId)`. It does not contain additional outpost, buff-station, or zone maps.

## Manifest v2

HUD-only releases use schema version 2 explicitly:

```json
{
  "sdk_version": 2,
  "name": "My HUD",
  "version": "1.0.0",
  "author": "your_name",
  "description": "My custom HUD",
  "provides": ["hud"],
  "compatible_maps": [],
  "entry": "index.html"
}
```

An empty `compatible_maps` array means all current and future built-in maps. Manifest schema version 2 is separate from Workshop `postMessage` protocol version 1.

Official release HTML carries a CSP with `connect-src 'none'`. A Workshop HUD should consume only parent-provided data and local packaged assets; it should not discover or connect to the game's WebSocket server.

## Validate and package

```powershell
npm test
pwsh -NoProfile -File .\scripts\validate-workshop-hud.ps1 `
  -ContentFolder .\publish-test
```

The validator checks the HUD-only manifest, entry file, local HTML/CSS assets, CSP, and generated `manifest.js` metadata. The publisher copies only runtime asset types into a fresh staging directory before SteamCMD sees the content.

## Steam Workshop publishing

Steam receives a built HUD mod directory, not the npm SDK package. The repository's conformance HUD is [`publish-test/`](publish-test/).

Always inspect a dry run first and name the target item explicitly:

```powershell
.\upload-workshop-hud.ps1 `
  -ContentFolder .\publish-test `
  -ItemId 3698375578 `
  -Visibility Private `
  -DryRun
```

Remove `-DryRun` only after inspecting staging. The script defaults to Private, requires `-ConfirmPublic` for a public upload, writes UTF-8 VDF, and lets SteamCMD request credentials interactively. It has no password command-line parameter.

The ID `3698375578` is the current official example candidate; it is intentionally not a script default.

See [`docs/workshop-upload.md`](docs/workshop-upload.md) for the full release procedure.

## Repository layout

```text
schemas/fbs/                     Public source FBS files
protocol/                        Machine-readable protocol index
src/protocol/generated/          Generated TypeScript protocol
src/workshop/                    Supported Workshop bridge
template-workshop/               Minimal self-contained HUD
template-workshop-{1v1,rmuc2026,rmul2026}/
template-workshop-vue/           Vue 3 reference HUD
devtools/                        Offline parent-frame simulator
publish-test/                    Steam conformance HUD
scripts/                         Generation, validation, sync, and E2E tools
docs/                            Guides and generated reference
```

## Documentation

- [Getting started](docs/getting-started.md)
- [Workshop development guide](docs/workshop-guide.md)
- [Workshop message API](docs/hud-api.md)
- [Attribute map and scope guide](docs/attribute-map.md)
- [Generated complete FBS reference](docs/generated/fbs-reference.md)
- [Steam upload guide](docs/workshop-upload.md)
- [Integration and E2E notes](docs/integration-notes.md)

## License

MIT. See [LICENSE](LICENSE).
