# Workshop HUD Development Guide

This guide walks through the complete process of creating, testing, and publishing a custom Workshop HUD for Gestalt System.

## Overview

Workshop HUDs run inside a sandboxed iframe (`sandbox="allow-scripts allow-same-origin"`) within the game's main UI. They communicate with the game via `postMessage` — the SDK provides `GestaltHUDBridge` to handle all protocol details.

### Architecture

```
Game SPA (parent window)
├── Reads attribute data from game engine
├── Sends hud:init, hud:attribute_update via postMessage
└── Receives hud:ready, hud:action from iframe

Workshop HUD (sandboxed iframe)
├── Loads your index.html
├── Uses GestaltHUDBridge to receive game data
└── Renders custom HUD overlay
```

### Security Model

- The iframe has `sandbox="allow-scripts allow-same-origin"`
- `allow-scripts`: JavaScript execution, including ES modules (`import`/`export`, dynamic `import()`)
- `allow-same-origin`: Required for ES module loading and Vite HMR; also grants access to the iframe's own `localStorage`/cookies (scoped to its origin)
- No access to the parent window's DOM (cross-origin isolation still applies)
- No popups (`window.open`), form submission, or top-level navigation
- All communication with the game is via `postMessage` only

## Step 1: Choose a Template

| Template | Best for | Path |
|----------|----------|------|
| **Minimal** | Learning / starting from scratch | `template-workshop/` |
| **RMUL2026** | Full 3v3 competition HUD | `template-workshop-rmul2026/` |
| **RMUC2026** | RMUC with remote supply | `template-workshop-rmuc2026/` |
| **1v1** | Simplified duel HUD | `template-workshop-1v1/` |
| **Vue (advanced)** | Vue 3 + TypeScript, component architecture | `template-workshop-vue/` |

```bash
# Copy your chosen template
cp -r template-workshop my-custom-hud
cd my-custom-hud
```

## Step 2: Edit manifest.json

Every Workshop HUD must have a `manifest.json` at its root:

```json
{
  "sdk_version": 1,
  "name": "My Custom HUD",
  "version": "1.0.0",
  "author": "your_name",
  "description": "A brief description of your HUD.",
  "compatible_maps": ["L_MapRMUL2026", "L_MapRMUL2026_IF", "L_Map20261V1"],
  "entry": "index.html"
}
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `sdk_version` | Yes | Protocol version (currently `1`) |
| `name` | Yes | Display name shown in the game UI |
| `version` | Yes | Semver version string |
| `author` | Yes | Your name or team name |
| `description` | Yes | Short description |
| `compatible_maps` | Yes | Array of map names this HUD supports |
| `entry` | Yes | Path to the HTML entry point |

### Valid Map Names

| Map Name | Description |
|----------|-------------|
| `L_Traning` | Training mode |
| `L_Map2026` | RMUC2026 |
| `L_MapRMUL2026` | RMUL2026 |
| `L_MapRMUL2026_IF` | RMUL2026 International |
| `L_Map20261V1` | 1v1 Duel |

## Step 3: Set Up the SDK

### Option A: UMD Script Tag (no build tools)

Copy `dist/workshop.umd.js` from the SDK into your HUD folder:

```html
<script src="gestalt-hud-sdk.workshop.umd.js"></script>
<script>
  var bridge = new GestaltHUD.GestaltHUDBridge();
  var Attr = GestaltHUD.ERobotBridgeDemoAttributeId;
  // ...
</script>
```

### Option B: ESM Import (with bundler)

Install the SDK as a dependency:

```bash
npm install @axisray-lab/gestalt-hud-sdk
```

```typescript
import {
  GestaltHUDBridge,
  ERobotBridgeDemoAttributeId as Attr,
} from '@axisray-lab/gestalt-hud-sdk/workshop';

const bridge = new GestaltHUDBridge();
```

## Step 4: Implement the HUD

### Lifecycle

1. **Game loads your iframe** and sends `hud:init` with match info
2. **Your HUD responds** with `hud:ready` (name + version from manifest)
3. **Game streams** `hud:attribute_update` with real-time data
4. **Your HUD** renders the overlay and optionally sends `hud:action` for UI actions

### Basic Implementation

```javascript
var bridge = new GestaltHUD.GestaltHUDBridge();
var Attr = GestaltHUD.ERobotBridgeDemoAttributeId;

// Read manifest for name/version
fetch('./manifest.json')
  .then(function (r) { return r.json(); })
  .then(function (m) {
    bridge.onInit(function (msg) {
      bridge.sendReady(m.name, m.version);
    });
  });

// Handle real-time data
bridge.onAttributeUpdate(function (data) {
  var hp = data.battle[Attr.Health] || 0;
  var hpMax = data.battle[Attr.HealthMax] || 0;
  // Update your UI here
});
```

### Data Structure

The `onAttributeUpdate` callback receives data grouped by scope:

```typescript
{
  global: Record<string, number>,       // Match timer, status
  player: Record<string, number>,       // Player slot info
  battle: Record<string, number>,       // Local player combat data
  base: Record<string, Record<string, number>>,  // Base HP by map ID
  playerBattle: Record<number, Record<string, number>>  // All players
}
```

Attribute keys are stringified FBS enum IDs (e.g. `"10000003"` for Health). See the [Attribute Map Reference](attribute-map.md) for the complete list.

### Value Conventions

- **Time values** (`G_MaxGameTime`, `G_CurGameTime`) are in milliseconds
- **Thousandths** (`AttackMultiplierThou`, etc.): 1000 = 100%, 1250 = 125%
- **Tag attributes** (50000000+ range): 0 = inactive, 1 = active
- **Team IDs**: -1 = spectator, 0 = red, 1 = blue

### Available Actions

Your HUD can send these actions to the game:

```javascript
bridge.sendAction('open_settings');  // Open settings page
bridge.sendAction('exit_game');      // Exit to desktop
bridge.sendAction('resume_game');    // Close ESC menu
bridge.sendAction('exit_menu');      // Return to main menu
```

## Step 5: Style Your HUD

Key CSS guidelines for Workshop HUDs:

```css
body {
  background: transparent;   /* iframe is overlaid on the game */
  overflow: hidden;
  pointer-events: none;       /* don't block game input */
}
```

- Use `position: fixed` for all HUD elements
- Set `pointer-events: none` on everything (the game handles input)
- Use semi-transparent backgrounds (`rgba(0, 0, 0, 0.6)`) with `backdrop-filter: blur()`
- Keep `z-index` reasonable (the iframe itself is already on top)

## Step 6: Local Development

There are multiple ways to develop and test your HUD, depending on your setup.

### Path A: DevTools Offline Preview (no game needed)

The SDK includes a DevTools page that simulates the game SPA, letting you test your HUD with mock data in a browser.

1. Start an HTTP server from the SDK root:

```bash
# With Node.js:
npx serve . -l 8080
# Without Node.js:
python -m http.server 8080
```

2. Open `http://localhost:8080/devtools/` in your browser.
3. Enter your HUD's URL (e.g. `http://localhost:8080/template-workshop/index.html`) and click **Load**.
4. The DevTools page sends `hud:init` to your HUD and starts pushing mock attribute data.
5. Use the control panel on the left to adjust HP, ammo, team, match timer, and toggle tags (defeated, overheated, etc.).
6. Use **Presets** (Match Start, Low HP, Defeated, etc.) for quick scenario testing.
7. The **Message Log** on the right shows all postMessage traffic in both directions.

**Bypass mode**: Check "Bypass hud:ready" to skip waiting for your HUD's ready signal — useful when debugging initialization issues.

### Path B: In-Game with Hot Reload (Node.js users)

The fastest iteration loop — edit code, save, see changes instantly in the game.

1. Start a local dev server for your HUD:

```bash
npx serve my-custom-hud -l 3000
# or, with Vite:
npx vite --port 3000
```

2. Edit the game's `UI/debug.config.json`:

```json
{
  "enableDebug": true,
  "workshopHUDDevUrl": "http://localhost:3000/index.html?gestalt-debug=1"
}
```

> **Important:** The URL must include the full filename (`index.html`). The game loads the URL as-is and does not append `index.html` for directory paths.

> **Dev server binding note:** The `workshopHUDDevUrl` hostname must match the dev server's listen address. `npx serve` typically binds IPv4 (`127.0.0.1`), while Vite defaults to IPv6 only (`::1`). If using Vite, either add `server: { host: '0.0.0.0' }` to `vite.config.ts` (recommended), or use `http://localhost:...` which resolves to whichever protocol the server listens on. The SDK's Vue template (`template-workshop-vue/`) already has this configured.

3. Launch the game. Your HUD loads from the local URL instead of Workshop.
4. Edit code → save → the game reloads the HUD automatically (Vite HMR) or manually refresh.
5. The `?gestalt-debug=1` parameter enables bridge debug mode — diagnostic logs appear in the game's Shift+U debug overlay via the `hud:debug_log` postMessage channel.

### Path C: In-Game without Node.js

For developers who edit HTML files directly without build tools.

1. Copy your HUD folder into the game directory:

```
<GameDir>/Content/WebContent/workshop-hud-dev/
├── manifest.json
├── index.html
├── hud.js
├── style.css
└── gestalt-hud-sdk.workshop.umd.js
```

2. Edit the game's `UI/debug.config.json`:

```json
{
  "enableDebug": true,
  "workshopHUDDevPath": "workshop-hud-dev"
}
```

3. To enable debug output in the game's log overlay, add `{ debug: true }` in your `hud.js`:

```javascript
var bridge = new GestaltHUD.GestaltHUDBridge({ debug: true });
```

4. Launch the game. Edit files, restart match to see changes.

### debug.config.json Reference

| Field | Type | Description |
|-------|------|-------------|
| `enableDebug` | boolean | Must be `true` for dev loading |
| `workshopHUDDevUrl` | string | External URL for the HUD (highest priority) |
| `workshopHUDDevPath` | string | Local folder under `Content/WebContent/` |

Priority: `workshopHUDDevUrl` > `workshopHUDDevPath` > Steam Workshop subscription.

## Step 7: Debug Mode

### Bridge Debug Output

Enable debug mode to see diagnostic logs in the game's overlay or browser console:

```javascript
// Option 1: Constructor (explicit, remove before publishing)
var bridge = new GestaltHUD.GestaltHUDBridge({ debug: true });

// Option 2: URL parameter (no code change needed)
// Set workshopHUDDevUrl to: http://localhost:3000/index.html?gestalt-debug=1
```

Debug mode outputs:
- `Init received (map=L_Map2026, team=0, player=3)` -- init handshake
- `First attribute_update: battle(9 keys), global(10 keys)` -- first data arrival with key counts
- `Key values: HP=600/600 Ammo17=50 Team=0 Level=1` -- quick diagnosis of key attributes
- Slow callback warnings (>16ms)
- Message count and frequency stats

In debug mode, `bridge.lastSnapshot` holds the most recent attribute data -- inspect it in the browser console.

Debug logs are forwarded to the game via `hud:debug_log` postMessage. The game proxies them through `console.warn`, making them visible in the Shift+U debug overlay. This works even though the HUD iframe has no direct access to the game's console.

## Step 8: Publish to Workshop

See [Workshop Upload Guide](workshop-upload.md) for instructions on publishing to Steam Workshop using the upload script and SteamCMD.

## Troubleshooting

### HUD doesn't load

- Check that `manifest.json` is valid JSON with all required fields
- Verify `entry` points to an existing HTML file
- Check the browser/game console for script errors

### HUD loads but no data displays

1. **Check `hud:ready`**: The game only starts sending data after receiving `hud:ready`. Make sure `bridge.sendReady()` is called after `hud:init`.
2. **Check attribute keys**: Keys are stringified numeric IDs (e.g. `"10000003"`), not semantic names. Use `ERobotBridgeDemoAttributeId` enum values.
3. **Check scopes**: HP is in `data.battle`, match time is in `data.global`, base HP is in `data.base[mapId]`.
4. **Enable debug mode**: Add `?gestalt-debug=1` to the URL to see if data is arriving but not rendering. Debug logs appear both in the browser console and the game's Shift+U overlay.

### Data arrives but values are wrong

- **Thousandths attributes** (61xxxxxx): Divide by 1000 (e.g. 1250 = 125%)
- **Time values** (G_MaxGameTime, G_CurGameTime): In milliseconds, divide by 1000 for seconds
- **Tags** (5xxxxxxx): 0 = inactive, 1 = active (not true/false)

### Base HP not showing

Base HP is nested: `data.base[baseMapId]["10000003"]`. Use `data.global["80001000"]` to get the base map ID first, then look up the base attributes.

### Actions don't work

- Only 4 whitelisted actions: `open_settings`, `exit_game`, `resume_game`, `exit_menu`
- Unknown actions throw an error

### DevTools can't load HUD

- Both DevTools and HUD must be served via HTTP (not `file://`)
- Cross-origin iframes require an HTTP server -- use `npx serve .` or `python -m http.server`
- Verify `serve.json` has `"cleanUrls": false` if using `npx serve` (see below)

### Script 404 in iframe / GestaltHUD not found

The `cleanUrls` feature in `npx serve` strips `.html` extensions from URLs, which changes the iframe's base URL. This causes relative `<script src>` paths to resolve from the wrong directory, resulting in 404s for the UMD bundle.

**Solution:** The SDK repo includes a `serve.json` with `"cleanUrls": false`. If you are using your own HTTP server, ensure it does not rewrite `.html` URLs.

### Game shows directory listing instead of HUD

The `workshopHUDDevUrl` in `debug.config.json` must include the full filename:

```json
// Wrong:
"workshopHUDDevUrl": "http://127.0.0.1:8080/my-hud/"

// Correct:
"workshopHUDDevUrl": "http://127.0.0.1:8080/my-hud/index.html"
```

### Game can't connect to local dev server

The `workshopHUDDevUrl` hostname must match the dev server's listen address:
- **`npx serve`** binds IPv4 (`127.0.0.1`) — use `http://127.0.0.1:port/...`
- **Vite** defaults to IPv6 only (`::1`) — use `http://localhost:port/...`, or add `server: { host: '0.0.0.0' }` to `vite.config.ts` so both `localhost` and `127.0.0.1` work

### Debug logs don't appear in game's Shift+U overlay

- Ensure `?gestalt-debug=1` is in the HUD URL (or `{ debug: true }` in the bridge constructor)
- The game must support the `hud:debug_log` message type (available since the latest integration update)
- Open the debug overlay with Shift+U in-game

### SteamCMD upload fails

- **"Invalid Parameter"**: Ensure `ISteamUGC for file transfer` is enabled in Steamworks Partner backend (Workshop > General)
- **"Busy"**: Wait and retry; another upload may be in progress
- **App ID**: Must be `4007690` (Gestalt System)
- See [Workshop Upload Guide](workshop-upload.md) for complete troubleshooting
