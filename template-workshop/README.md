# Minimal Workshop HUD Template

A starter template for creating custom Workshop HUDs for Gestalt System. Uses **pure HTML/CSS/JS** — no build tools or frameworks required.

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | HUD metadata — name, version, compatible maps |
| `index.html` | Entry point loaded by the game's iframe |
| `style.css` | HUD styling (transparent overlay, positioned elements) |
| `hud.js` | Game data handling via `GestaltHUDBridge` |
| `gestalt-hud-sdk.workshop.umd.js` | SDK library (copy from `dist/workshop.umd.js` after building the SDK) |

## Getting Started

1. **Copy this template** to a new folder:

   ```bash
   cp -r template-workshop my-custom-hud
   ```

2. **Copy the SDK UMD bundle** into your HUD folder:

   ```bash
   # From the SDK root, after running `npm run build`:
   cp dist/workshop.umd.js my-custom-hud/gestalt-hud-sdk.workshop.umd.js
   ```

3. **Edit `manifest.json`** with your HUD's name, author, and compatible maps.

4. **Customize the HUD** — edit `style.css` for layout and `hud.js` for data handling.

5. **Test locally** — place your HUD folder in the game's `WebContent/workshop-hud-dev/` directory and enable `workshopHUDDevPath` in `debug.config.json`.

## How It Works

The HUD runs inside a sandboxed iframe. Communication with the game happens through `postMessage`:

1. Game sends `hud:init` with match info (map, team, player ID)
2. HUD responds with `hud:ready` (name + version)
3. Game streams `hud:attribute_update` with real-time data (HP, ammo, timer, etc.)
4. HUD can send `hud:action` for UI actions (open settings, exit game, etc.)

### Available Actions

| Action | Effect |
| --- | --- |
| `open_settings` | Open the settings page |
| `exit_game` | Exit to desktop |
| `resume_game` | Close ESC menu, resume game |
| `exit_menu` | Return to main menu |

## Attribute Reference

Attribute values are raw numbers keyed by their FBS enum ID (as strings). Common attributes:

| Attribute | Enum ID | Notes |
| --- | --- | --- |
| Health | `10000003` | Current HP |
| HealthMax | `60000004` | Max HP |
| Level | `60000003` | Player level |
| Ammo17mmCount | `10000033` | 17mm ammo count |
| Ammo42mmCount | `10000034` | 42mm ammo count |
| G_MaxGameTime | `80000001` | Match duration (ms) |
| G_CurGameTime | `80000002` | Elapsed time (ms) |
| G_CurMatchStatus | `80000005` | 0=not started, 1=in progress, 2=finished |

"Thousandths" attributes (like `AttackMultiplierThou`) use 1000 = 100%.
Tag attributes (50000000+ range) are boolean: 0 = inactive, 1 = active.

See the full reference in [`docs/attribute-map.md`](../docs/attribute-map.md).
