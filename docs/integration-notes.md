# Integration Notes

Lessons learned from the SDK-game integration process. This document serves as a reference for both SDK maintainers and game-side developers.

## 1. postMessage Data Format

The game SPA sends attribute data to Workshop HUD iframes via `postMessage`. The data **must** be a plain JavaScript object — it cannot contain `Proxy`, `Map`, `Set`, or other types that are incompatible with the structured clone algorithm used by `postMessage`.

**Game-side fix:** The game applies `JSON.parse(JSON.stringify(data))` before posting to ensure the data is a pure object tree. This strips any Vue reactivity proxies.

**SDK-side impact:** None. The SDK bridge receives plain objects directly and passes them to `onAttributeUpdate` callbacks without transformation.

## 2. hud:debug_log Protocol

The SDK bridge supports a `hud:debug_log` message type for forwarding diagnostic logs from the HUD iframe to the game's debug panel.

**Message format:**

```javascript
window.parent.postMessage({
  type: 'hud:debug_log',
  message: '[Workshop HUD] some diagnostic info'
}, '*');
```

**Game-side behavior:** The game's `useWorkshopHUDBridge` composable listens for `hud:debug_log` messages and proxies them via `console.warn()`. These warnings are captured by the game's `logPersistence` system and displayed in the Shift+U debug overlay.

**SDK-side behavior:** When `GestaltHUDBridge` is constructed with `{ debug: true }` or the URL contains `?gestalt-debug=1`, all internal log/warn calls automatically send `hud:debug_log` messages to the parent. HUD developers see these logs in:
- The browser console (when using DevTools offline preview)
- The game's Shift+U debug panel (when running in-game)

## 3. Local Development Workflow

### DevTools Offline Preview

The SDK includes a DevTools page (`devtools/index.html`) that simulates the game SPA in a browser. It sends `hud:init` and `hud:attribute_update` with configurable mock data.

```bash
npx serve . -l 8080
```

Open `http://localhost:8080/devtools/` and enter the HUD URL to load.

**Caveat:** When using `npx serve`, ensure `serve.json` has `"cleanUrls": false`. The default `cleanUrls` behavior strips `.html` extensions, which changes the iframe's base URL and breaks relative script paths. The SDK repo includes a `serve.json` with this setting preconfigured.

### In-Game Local Development

The game reads `UI/debug.config.json` to load HUDs from local sources:

```json
{
  "enableDebug": true,
  "workshopHUDDevUrl": "http://127.0.0.1:8080/my-hud/index.html?gestalt-debug=1"
}
```

**Critical: Use `127.0.0.1`, not `localhost`.** The game's embedded browser (Unreal Engine CEF) does not resolve `localhost` to the loopback address.

**URL must include `index.html` explicitly.** The game loads the URL as-is; it does not append `index.html` for directory URLs.

**Priority order:** `workshopHUDDevUrl` > `workshopHUDDevPath` > Steam Workshop subscription.

| Field | Type | Description |
|-------|------|-------------|
| `enableDebug` | boolean | Must be `true` for dev loading |
| `workshopHUDDevUrl` | string | Full URL to the HUD entry page (highest priority) |
| `workshopHUDDevPath` | string | Local folder path under `Content/WebContent/` |

### Recommended Development Flow

```
1. Edit HUD code locally
2. Test with DevTools offline preview (fast iteration, mock data)
3. Test in-game with workshopHUDDevUrl + ?gestalt-debug=1 (real data, debug overlay)
4. Publish to Steam Workshop when ready
```

## 4. Attribute Data Format

The attribute data delivered via `hud:attribute_update` follows these conventions:

### Data Structure

```typescript
{
  global: Record<string, number>,       // Match-wide state (timer, status, zones)
  player: Record<string, number>,       // Player slot metadata
  battle: Record<string, number>,       // Local player's combat attributes
  base: Record<string, Record<string, number>>,  // Base/outpost HP by map ID
  playerBattle: Record<number, Record<string, number>>  // All players' battle attributes
}
```

### Key Conventions

| Convention | Description | Example |
|-----------|-------------|---------|
| **Attribute keys** | Stringified FBS enum IDs | `"10000003"` for Health |
| **Thousandths** (`61xxxxxx`) | 1000 = 100%, 1250 = 125% | `AttackMultiplierThou` |
| **Tags** (`5xxxxxxx`) | Boolean: 0 = inactive, 1 = active | `Defeated`, `Overheated` |
| **Time values** | Milliseconds | `G_MaxGameTime`, `G_CurGameTime` |
| **Team IDs** | -1 = spectator, 0 = red, 1 = blue | `TeamID` |

### Confirmed Data Shape (from integration testing)

On first push, typical key counts are:
- `data.battle`: ~9 keys (HP, team, ammo, energy, etc.)
- `data.global`: ~10 keys (match status, timer, zones, etc.)
- `data.base`: keyed by base map ID, each containing `Health` / `HealthMax`
- `data.playerBattle`: keyed by player ID, containing per-player battle attributes

Key counts grow as the game updates more attributes during active gameplay.

## 5. Workshop Upload

### App ID

The Steam App ID for Gestalt System is **4007690**. The upload script (`upload-workshop-hud.ps1`) defaults to this value.

### Steamworks Backend Requirements

Before uploading Workshop items, the following must be configured in the Steamworks Partner backend:

1. **Workshop** must be enabled for App 4007690
2. **ISteamUGC for file transfer** must be enabled under Workshop > General
3. At least one **Item Type** (e.g. "HUD") must be configured
4. The uploading Steam account must be a Steamworks Partner member or own the game

Without these settings, uploads may succeed in creating item IDs but fail to transfer content files (error: "Invalid Parameter" or "no workshop depot found").

### Workshop Tags

The upload script automatically sets the Workshop tag to `"HUD"`. This tag is used by the game to filter and display Workshop items in the HUD management UI.

## 6. SDK Bridge API Summary

### Constructor

```javascript
var bridge = new GestaltHUD.GestaltHUDBridge({
  targetOrigin: '*',     // postMessage target (default: '*')
  debug: true            // enable diagnostic logging (default: auto-detect from URL)
});
```

### Lifecycle

| Method | Direction | Description |
|--------|-----------|-------------|
| `onInit(handler)` | Game -> HUD | Receive match initialization data |
| `sendReady(name, version)` | HUD -> Game | Confirm HUD is loaded and ready |
| `onAttributeUpdate(handler)` | Game -> HUD | Receive real-time attribute data |
| `onGameEvent(handler)` | Game -> HUD | Receive game events (reserved for future) |
| `sendAction(action, payload?)` | HUD -> Game | Send UI action to game |
| `destroy()` | -- | Clean up listeners |

### Allowed Actions

Only four actions are permitted in the current protocol version:

| Action | Description |
|--------|-------------|
| `open_settings` | Open settings page |
| `exit_game` | Exit to desktop |
| `resume_game` | Close ESC menu, resume gameplay |
| `exit_menu` | Return to main menu |

Attempting to send an unknown action throws an `Error`.

## 7. Common Issues and Solutions

### HUD loads but no data displays

1. Verify `bridge.sendReady()` is called after receiving `hud:init`
2. Ensure `manifest.json` is valid and `fetch('./manifest.json')` succeeds
3. Check attribute keys are stringified numeric IDs (e.g. `"10000003"`, not `"Health"`)
4. Enable debug mode (`?gestalt-debug=1`) to confirm data arrival

### DevTools HUD iframe shows blank

- The DevTools iframe background is `#1a3a2a` (dark green). If your HUD renders white/light text on a transparent background, it should be visible.
- Ensure the HTTP server is running and the HUD URL is accessible.
- Check browser console for script loading errors.
- Verify `serve.json` has `"cleanUrls": false` if using `npx serve`.

### Game shows directory listing instead of HUD

The `workshopHUDDevUrl` must point to the full HTML file path (e.g. `http://127.0.0.1:8080/my-hud/index.html`), not a directory.

### Debug logs don't appear in game

- Debug logs use `hud:debug_log` postMessage, which the game proxies via `console.warn`
- The game must have the `useWorkshopHUDBridge` handler for `hud:debug_log` (included since the integration update)
- Check the Shift+U overlay is open

### Script not found in iframe (404 for UMD bundle)

- If using `npx serve`, the `cleanUrls` feature can redirect `index.html` to `index`, changing the base URL and breaking relative script paths
- Solution: set `"cleanUrls": false` in `serve.json` (already configured in the SDK repo)
- Add cache-busting parameters to iframe URLs if browser caching causes stale scripts

### SteamCMD upload fails with "Invalid Parameter"

- Ensure `ISteamUGC for file transfer` is enabled in Steamworks Partner backend
- Verify the App ID is `4007690`
- Check that the content folder contains `manifest.json`
