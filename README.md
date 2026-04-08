# Gestalt HUD SDK

Build custom in-game HUD overlays for **Gestalt System** with real-time game data.

The SDK provides two development modes:

- **WebSocket mode** — direct connection to the game engine for local development
- **Workshop mode** — postMessage-based communication for Steam Workshop HUDs running in sandboxed iframes (`allow-scripts allow-same-origin`)

## Quick Start

### Workshop HUD (recommended for new projects)

```bash
# Copy the minimal workshop template
git clone https://github.com/Axisray-Lab/gestalt-hud-sdk.git
cp -r gestalt-hud-sdk/template-workshop my-custom-hud
cd my-custom-hud
```

Edit `manifest.json` with your HUD info, customize `hud.js` and `style.css`, then test using the DevTools preview or the game's local dev mode. See the [Workshop HUD Guide](docs/workshop-guide.md) for the full workflow.

### WebSocket Development Mode

```bash
cp -r gestalt-hud-sdk/template my-custom-hud
cd my-custom-hud
npm install
npm run dev
```

Launch Gestalt System, and your HUD will connect automatically via WebSocket.

## Core Concepts

### Workshop Mode (postMessage)

```typescript
import { GestaltHUDBridge, ERobotBridgeDemoAttributeId as Attr } from '@axisray-lab/gestalt-hud-sdk/workshop';

const bridge = new GestaltHUDBridge();

bridge.onInit((msg) => {
  console.log(`Map: ${msg.mapName}, Team: ${msg.teamId}`);
  bridge.sendReady('My HUD', '1.0.0');
});

bridge.onAttributeUpdate((data) => {
  const hp = data.battle[String(Attr.Health)] ?? 0;
  const hpMax = data.battle[String(Attr.HealthMax)] ?? 0;
  console.log(`HP: ${hp}/${hpMax}`);
});
```

### WebSocket Mode

```typescript
import { HUDBridge, AttributeStore, ERobotBridgeDemoAttributeId } from '@axisray-lab/gestalt-hud-sdk';

const bridge = new HUDBridge({ port: 18820 });
const store = new AttributeStore(bridge);
await bridge.connect();
store.start();

store.onChange(() => {
  const hp = store.getBattleAttribute(ERobotBridgeDemoAttributeId.Health);
  const hpMax = store.getBattleAttribute(ERobotBridgeDemoAttributeId.HealthMax);
  console.log(`HP: ${hp}/${hpMax}`);
});
```

### Vanilla JS (no bundler)

```html
<script src="gestalt-hud-sdk.workshop.umd.js"></script>
<script>
  var bridge = new GestaltHUD.GestaltHUDBridge();
  var Attr = GestaltHUD.ERobotBridgeDemoAttributeId;

  bridge.onInit(function (msg) {
    bridge.sendReady('My HUD', '1.0.0');
  });

  bridge.onAttributeUpdate(function (data) {
    var hp = data.battle[Attr.Health] || 0;
  });
</script>
```

## Development Tools

### DevTools — Offline HUD Preview

Test your HUD with mock data without launching the game:

```bash
# Start a local server
npx serve . -l 8080
# Or without Node.js:
python -m http.server 8080
```

Open `http://localhost:8080/devtools/` in your browser. Enter your HUD URL, and the DevTools simulates the game SPA — sending `hud:init` and `hud:attribute_update` with adjustable mock data.

Features:
- **Attribute sliders**: HP, ammo, match timer, level, team, base HP
- **Tag toggles**: defeated, overheated, invincible, etc.
- **Presets**: Match Start, Low HP, Defeated, Switch Team
- **Bypass mode**: Skip `hud:ready` for faster iteration
- **Message log**: Full bidirectional postMessage traffic

### In-Game Local Development

The game supports loading HUDs from local sources for rapid iteration:

```json
// UI/debug.config.json
{
  "enableDebug": true,
  "workshopHUDDevUrl": "http://127.0.0.1:3000/index.html?gestalt-debug=1"
}
```

> **Important:** Use `127.0.0.1` instead of `localhost` — the game's embedded browser (UE CEF) does not resolve `localhost`.

Use `workshopHUDDevUrl` for hot-reload development with Vite, or `workshopHUDDevPath` to load from a local folder.

### Debug Mode

```javascript
// Enable diagnostic logging (visible in game's Shift+U log overlay)
var bridge = new GestaltHUD.GestaltHUDBridge({ debug: true });
// Or add ?gestalt-debug=1 to your URL — no code change needed
```

Debug logs are forwarded to the game via `hud:debug_log` postMessage and appear as `console.warn` entries in the game's Shift+U debug panel.

## Project Structure

```
gestalt-hud-sdk/
├── src/
│   ├── bridge/
│   │   ├── hud-bridge.ts          # WebSocket JSON-RPC client
│   │   └── attribute-store.ts     # Reactive attribute tracking
│   ├── workshop/
│   │   ├── workshop-bridge.ts     # postMessage bridge for Workshop HUDs
│   │   └── index.ts               # ./workshop export entry
│   └── protocol/
│       ├── attribute-id.ts        # Game attribute ID enum
│       ├── types.ts               # WebSocket protocol types
│       ├── workshop-types.ts      # postMessage protocol types
│       ├── manifest.ts            # Workshop manifest schema
│       └── map-type.ts            # Map type enum
├── devtools/                      # Offline HUD preview & debug tool
├── template/                      # WebSocket dev template (Vue 3 + Vite)
├── template-workshop/             # Minimal Workshop HUD (pure HTML/JS)
├── template-workshop-rmul2026/    # RMUL2026 3v3 competition HUD
├── template-workshop-rmuc2026/    # RMUC2026 competition HUD (with remote supply)
├── template-workshop-1v1/         # 1v1 duel HUD (simplified)
└── docs/
    ├── attribute-map.md           # Attribute ID reference
    ├── workshop-guide.md          # Workshop HUD development guide
    ├── workshop-upload.md         # Steam Workshop upload guide
    ├── hud-api.md                 # WebSocket protocol docs
    └── getting-started.md         # Step-by-step tutorial
```

## Package Exports

```typescript
// Main entry — WebSocket bridge + attribute store
import { HUDBridge, AttributeStore } from '@axisray-lab/gestalt-hud-sdk';

// Protocol types only
import { ERobotBridgeDemoAttributeId } from '@axisray-lab/gestalt-hud-sdk/protocol';

// Workshop bridge + all Workshop types
import { GestaltHUDBridge } from '@axisray-lab/gestalt-hud-sdk/workshop';
```

## Framework Support

The SDK core is **framework-agnostic** — use Vue, React, Svelte, or vanilla JS. The `template/` uses Vue 3 as an example; the Workshop templates use vanilla JS for maximum accessibility.

## Documentation

- [Workshop HUD Guide](docs/workshop-guide.md) -- build, test, and publish Workshop HUDs
- [Workshop Upload Guide](docs/workshop-upload.md) -- publish to Steam Workshop
- [Attribute Map Reference](docs/attribute-map.md) -- all available game attributes
- [Integration Notes](docs/integration-notes.md) -- lessons learned from SDK-game integration
- [Getting Started](docs/getting-started.md) -- set up your first custom HUD (WebSocket mode)
- [HUD Communication API](docs/hud-api.md) -- WebSocket protocol details

## Templates

| Template | Tech | Scope | Path |
|----------|------|-------|------|
| **Minimal** | Pure HTML/JS | Learning / starting from scratch | `template-workshop/` |
| **RMUL2026** | Pure HTML/JS | Full 3v3 competition HUD | `template-workshop-rmul2026/` |
| **RMUC2026** | Pure HTML/JS | RMUC with remote supply | `template-workshop-rmuc2026/` |
| **1v1** | Pure HTML/JS | Simplified duel HUD | `template-workshop-1v1/` |

These serve as basic examples with zero dependencies and no build tools required. A Vue 3 advanced template replicating the game's full HUD UI is planned for a future release.

## Integration Notes

Lessons learned from the SDK-game integration process. See [docs/integration-notes.md](docs/integration-notes.md) for the full reference.

Key points:
- The game sends pure JS objects via `postMessage` (no Proxy/Map/Set) -- SDK receives them directly
- Debug logs flow through `hud:debug_log` postMessage to the game's Shift+U overlay
- Use `127.0.0.1` (not `localhost`) in `workshopHUDDevUrl` for UE CEF compatibility
- Attribute keys are stringified FBS enum IDs; values follow the "thousandths" convention for multipliers

## Roadmap

- **Phase 1** (stable): SDK + documentation + manual file replacement
- **Phase 2** (stable): iframe-based HUD isolation inside the game UI
- **Phase 3** (stable): Steam Workshop integration + DevTools
- **Phase 4** (planned): Vue 3 advanced HUD template replicating the full game UI

## License

[MIT](LICENSE)
