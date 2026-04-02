# Gestalt HUD SDK

Build custom in-game HUD overlays for **Gestalt System** with real-time game data.

The SDK provides a framework-agnostic bridge to the game's WebSocket API, giving you access to player attributes (HP, ammo, heat), match state (timer, score), and team data — everything you need to create a fully custom HUD.

## Quick Start

```bash
# Clone and use the template
git clone https://github.com/Axisray-Lab/gestalt-hud-sdk.git
cp -r gestalt-hud-sdk/template my-custom-hud
cd my-custom-hud
npm install
npm run dev
```

Launch Gestalt System, and your HUD will connect automatically.

## Core Concepts

```typescript
import {
  HUDBridge,
  AttributeStore,
  ERobotBridgeDemoAttributeId,
} from '@axisray-lab/gestalt-hud-sdk';

// 1. Connect to the game
const bridge = new HUDBridge({ port: 18820 });
const store = new AttributeStore(bridge);
await bridge.connect();
store.start();

// 2. React to attribute changes
store.onChange(() => {
  const hp = store.getBattleAttribute(ERobotBridgeDemoAttributeId.Health);
  const hpMax = store.getBattleAttribute(ERobotBridgeDemoAttributeId.HealthMax);
  console.log(`HP: ${hp}/${hpMax}`);
});

// 3. Check tags
const isDefeated = store.isTagActive(ERobotBridgeDemoAttributeId.Defeated);
```

## Project Structure

```
gestalt-hud-sdk/
├── src/
│   ├── bridge/
│   │   ├── hud-bridge.ts       # WebSocket JSON-RPC client
│   │   └── attribute-store.ts  # Reactive attribute tracking
│   └── protocol/
│       ├── attribute-id.ts     # Game attribute ID enum
│       └── types.ts            # Shared type definitions
├── template/                   # Starter HUD project (Vue 3 + Vite)
│   ├── src/
│   │   ├── App.vue
│   │   └── components/
│   │       └── ExampleHUD.vue  # Example HUD with HP bar, ammo, timer
│   └── ...
└── docs/
    ├── attribute-map.md        # Attribute ID reference
    ├── hud-api.md              # WebSocket protocol docs
    └── getting-started.md      # Step-by-step tutorial
```

## Framework Support

The SDK core is **framework-agnostic** — use Vue, React, Svelte, or vanilla JS. The template uses Vue 3 as an example, but `HUDBridge` and `AttributeStore` have zero framework dependencies.

## Documentation

- [Getting Started](docs/getting-started.md) — set up your first custom HUD
- [Attribute Map Reference](docs/attribute-map.md) — all available game attributes
- [HUD Communication API](docs/hud-api.md) — WebSocket protocol details

## Roadmap

- **Phase 1** (current): SDK + documentation + manual file replacement
- **Phase 2**: iframe-based HUD isolation inside the game UI
- **Phase 3**: Steam Workshop integration for one-click install

## License

[MIT](LICENSE)
