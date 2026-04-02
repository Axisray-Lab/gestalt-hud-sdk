# Getting Started

Build a custom in-game HUD for **Gestalt System** in under 10 minutes.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ and npm
- A running instance of Gestalt System (for live testing)

## 1. Create Your Project

The fastest way is to copy the included template:

```bash
# Clone the SDK repository
git clone https://github.com/Axisray-Lab/gestalt-hud-sdk.git
cd gestalt-hud-sdk

# Copy the template to your own project
cp -r template ../my-custom-hud
cd ../my-custom-hud

# Install dependencies
npm install
```

Or start from scratch by installing the SDK as a dependency:

```bash
mkdir my-custom-hud && cd my-custom-hud
npm init -y
npm install @axisray-lab/gestalt-hud-sdk vue
npm install -D vite @vitejs/plugin-vue typescript
```

## 2. Start Development

```bash
npm run dev
```

This opens a browser at `http://localhost:5174` showing your HUD overlay.  It will attempt to connect to the game at `ws://127.0.0.1:18820`.

## 3. Connect to the Game

1. Launch Gestalt System.
2. The game starts a WebSocket server on port `18820` by default.
3. Your dev HUD will auto-connect and start receiving real-time attribute data.

If the game uses a different port, update the `WS_PORT` constant in `src/App.vue`.

## 4. Read Game Data

The SDK provides two core classes:

### HUDBridge

Manages the WebSocket connection with JSON-RPC framing:

```typescript
import { HUDBridge } from '@axisray-lab/gestalt-hud-sdk';

const bridge = new HUDBridge({ port: 18820 });
await bridge.connect();

// Send a request to the game
const result = await bridge.send('cycleobject.watchAttributeMaps', {
  attribute_map_ids: [12345],
  watch_type: 1,
});
```

### AttributeStore

Automatically subscribes to attribute maps and maintains an in-memory snapshot:

```typescript
import { HUDBridge, AttributeStore, ERobotBridgeDemoAttributeId } from '@axisray-lab/gestalt-hud-sdk';

const bridge = new HUDBridge({ port: 18820 });
const store = new AttributeStore(bridge);

await bridge.connect();
store.start();

// Read attributes
store.onChange(() => {
  const hp = store.getBattleAttribute(ERobotBridgeDemoAttributeId.Health);
  const hpMax = store.getBattleAttribute(ERobotBridgeDemoAttributeId.HealthMax);
  console.log(`HP: ${hp}/${hpMax}`);
});
```

## 5. Build for Production

```bash
npm run build
```

This creates a `dist/` folder containing:
- `index.html`
- JavaScript bundles
- CSS (if any)

## 6. Install in the Game

Copy the contents of `dist/` into the game's custom HUD directory:

```
<Game Install Directory>/Content/WebContent/hud/custom/
```

> **Note:** In Phase 1, custom HUD loading requires manually replacing files. Steam Workshop integration is planned for a future update.

## Architecture Overview

```
┌──────────────────────────────────────────────┐
│              Game Engine (UE5)                │
│  ┌────────────────────────────────────────┐   │
│  │  ECHO Runtime (Attribute Maps, Events) │   │
│  └──────────────┬─────────────────────────┘   │
│                 │ WebSocket (JSON-RPC)         │
│  ┌──────────────▼─────────────────────────┐   │
│  │      Embedded Web Server               │   │
│  └──────────────┬─────────────────────────┘   │
└─────────────────┼────────────────────────────┘
                  │
    ┌─────────────▼──────────────┐
    │     Your Custom HUD        │
    │  ┌───────────────────────┐ │
    │  │  HUDBridge            │ │
    │  │  (WebSocket client)   │ │
    │  └──────────┬────────────┘ │
    │  ┌──────────▼────────────┐ │
    │  │  AttributeStore       │ │
    │  │  (reactive state)     │ │
    │  └──────────┬────────────┘ │
    │  ┌──────────▼────────────┐ │
    │  │  Vue/React/Svelte UI  │ │
    │  └───────────────────────┘ │
    └────────────────────────────┘
```

## Attribute Reference

See [attribute-map.md](./attribute-map.md) for the full list of attribute IDs and their meanings.

## API Reference

See [hud-api.md](./hud-api.md) for the WebSocket protocol details.

## Framework Choice

The template uses **Vue 3**, but the SDK core (`HUDBridge` + `AttributeStore`) is framework-agnostic.  You can use React, Svelte, vanilla JS, or any other framework — just call `store.onChange()` and update your UI accordingly.
