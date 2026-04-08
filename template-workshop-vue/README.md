# RMUC2026 Vue Workshop HUD

Advanced Workshop HUD template built with **Vue 3 + TypeScript + Vite** — an open-source reference implementation adapted from the game's competition HUD.

This template complements the pure HTML/CSS/JS Workshop templates by demonstrating how to build a modular, component-based HUD with Vue.

## Quick Start

```bash
cd template-workshop-vue
npm install
npm run dev
```

The dev server opens at `http://localhost:5175` (binds `0.0.0.0`, both IPv4 and IPv6). In development mode a "Waiting for game connection..." screen is shown until the game's iframe sends `hud:init`.

To test with mock data, start `npx serve . -l 8080` from the SDK root and open `http://localhost:8080/devtools/index.html`, then load `http://localhost:5175/index.html` as the HUD URL.

## Build for Workshop

```bash
npm run build
```

This produces a `dist/` folder with `index.html` + bundled assets. Copy the contents along with `manifest.json` into your Workshop HUD folder.

## Project Structure

```
src/
├── main.ts                     # Vue app bootstrap
├── App.vue                     # Root: bridge init → HUD render
├── composables/
│   ├── useBridge.ts            # GestaltHUDBridge wrapper (postMessage)
│   ├── useHUDAttributes.ts     # Attribute aggregator
│   ├── usePlayerAttributes.ts  # Health, level, XP, defeated
│   ├── useWeaponAttributes.ts  # Ammo, heat, firing mode, speed
│   ├── useEnergyAttributes.ts  # Chassis/capacity/buffer energy
│   ├── useTeamAttributes.ts    # Team ID, class type, supply
│   ├── useGlobalAttributes.ts  # Match status, timer, control zones
│   ├── useModeAttributes.ts    # Chassis/shooter/hero mode
│   └── useReviveAttributes.ts  # Revive speed/progress
├── components/
│   ├── CrosshairHUD.vue        # Ring crosshair with ammo arc
│   ├── BaseCoreStatus.vue      # Base/outpost HP bars + timer
│   ├── PlayerBadge.vue         # Hex badge with AP + XP bars
│   ├── EnergyBars.vue          # Chassis + capacity energy bars
│   ├── GameStatusBanner.vue    # Match status overlay banner
│   ├── HitScreenEffect.vue     # Hit flash + CRT death screen
│   └── ScoreboardPanel.vue     # Tab scoreboard
├── views/
│   └── GameHUD.vue             # Main layout composing all above
├── utils/
│   └── attributeAccessors.ts   # Typed attribute getter factories
└── assets/
    └── img/hud/                # 50+ SVG icons from the game
```

## Architecture

```
Game SPA (parent iframe)
    │
    │  postMessage: hud:init, hud:attribute_update
    ▼
useBridge.ts  ──→  reactive refs (battleAttributes, globalAttributes, ...)
    │
    ├─→ useHUDAttributes()  ──→  typed computed properties
    │       ├── player.health, player.isDefeated, ...
    │       ├── weapon.ammoCount, weapon.firingMode, ...
    │       ├── energy.chassisEnergyPercent, ...
    │       ├── team.teamID, team.careerName, ...
    │       ├── global.matchTimeText, global.matchStatus, ...
    │       └── revive.reviveRemainingTime, ...
    │
    └─→ GameHUD.vue  ──→  component props
            ├── CrosshairHUD
            ├── BaseCoreStatus
            ├── PlayerBadge
            ├── EnergyBars
            ├── GameStatusBanner
            └── HitScreenEffect
```

## Customization

### Adding/Removing Components

Edit `src/views/GameHUD.vue` to add or remove components. Each component is self-contained with its own props interface.

### Changing Attribute Mapping

The composables in `src/composables/` map raw attribute IDs to typed properties. To add new attributes:

1. Find the attribute ID in `ERobotBridgeDemoAttributeId` (from the SDK)
2. Add a computed ref using `createNumberGetter()` or `createBooleanGetter()`
3. Return it from the composable

### Styling

All components use scoped CSS. Modify the `<style scoped>` section of each component to change colors, sizes, animations, etc.

### Manifest

Edit `manifest.json` to update the HUD name, version, author, and compatible maps before publishing.

## Differences from HTML Templates

| Feature | HTML Templates | This Vue Template |
|---------|---------------|-------------------|
| Build step | None | `npm run build` (Vite) |
| Language | JavaScript | TypeScript |
| Reactivity | Manual DOM updates | Vue computed refs |
| Components | Single file | Modular .vue files |
| Attribute access | `data.battle[Attr.Health]` | `attrs.player.health.value` |
| SVG icons | Not included | 50+ game SVGs |
| Crosshair | Not included | Full ring crosshair |

## License

This template is part of the Gestalt HUD SDK. The Vue components and SVG assets are adapted from the game's internal UI and released under the same license as the SDK.
