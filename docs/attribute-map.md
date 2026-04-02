# Attribute Map Reference

Gestalt System uses a hierarchical **Attribute Map** system to replicate game state from the server to all connected clients (including the HUD).  This document explains the structure, sync semantics, and attribute ID layout.

## Hierarchy

```
Global Attribute Map  (one per match)
├── Player 0 Attribute Map
│   └── Battle Attribute Map (robot-specific combat state)
├── Player 1 Attribute Map
│   └── Battle Attribute Map
├── ...
├── Base 0 Attribute Map
├── Base 1 Attribute Map
├── Outpost 0 Attribute Map
└── Outpost 1 Attribute Map
```

1. The **Global Attribute Map** is announced via the `GameGlobalVarsFinishSetup` server request.  Its `global_var_att_map_id` field tells the HUD which map to watch.
2. Inside the global map, each **player slot** (key `0` through `99999`) maps to a **Player Attribute Map ID**.
3. Inside each player map, the attribute `PlayerBattleAttributeMapID` (`1000001`) points to a **Battle Attribute Map** that carries per-frame combat values.
4. Bases (`G_BaseId_0`–`G_BaseId_MAX`) and outposts (`G_OutpostId_0`–`G_OutpostId_MAX`) also appear in the global map.

## Sync Types

Every attribute map update carries a `sync_type` field:

| Value | Name             | Semantics |
|-------|------------------|-----------|
| `0`   | **FullSync**     | The entire map is replaced — any attribute NOT in the payload should be treated as reset to 0. |
| `1`   | **IncrementalSync** | Only changed attributes are included — merge them into your current snapshot. |

**Implementation guideline**: on `FullSync`, clear the local snapshot and write the new values.  On `IncrementalSync`, merge (spread) new values into the existing snapshot.

## Attribute ID Ranges

All attribute IDs are unsigned 32-bit integers.  The first digit(s) denote the category:

| Range Prefix | Category | Description |
|-------------|----------|-------------|
| `0x` | Player slot IDs | Keys in the global map, value = player attribute map ID |
| `01xxxxxx` | Map pointers | `PlayerBattleAttributeMapID`, `PlayerBaseAttributeMapID` |
| `1xxxxxxx` | Value attributes | Numeric quantities: HP, ammo, heat, energy, etc. |
| `5xxxxxxx` | Tag attributes | Boolean flags: defeated, overheated, reviving, etc. (1 = active, 0 = inactive) |
| `51xxxxxx` | Functional tags | Actor visibility, HP bar control, etc. |
| `6xxxxxxx` | State attributes | Class, level, max values, combat multipliers |
| `62xxxxxx` | Bullet attributes | Bullet type, speed, radius |
| `63xxxxxx` | Combat statistics | Cumulative damage dealt/taken, bullets fired |
| `7xxxxxxx` | Scene interaction | Buff stations, outpost rotation, base core |
| `74xxxxxx` | Team attributes | Team coins, state, ammo caps |
| `75xxxxxx` | Zone controller | Marker ID, control progress |
| `8xxxxxxx` | Global variables | Match time, map ID, match status |

## Key Attributes for HUD Development

### Player Combat (Battle Attribute Map)

| ID | Name | Unit / Notes |
|---|---|---|
| `10000003` | `Health` | Current HP |
| `60000004` | `HealthMax` | Max HP |
| `10000002` | `Experience` | Current XP |
| `60000020` | `NextLevelExpMax` | XP needed for next level |
| `60000003` | `Level` | Current level |
| `10000033` | `Ammo17mmCount` | 17mm ammo available |
| `10000034` | `Ammo42mmCount` | 42mm ammo available |
| `62000000` | `BulletType` | 0 = 42mm, 1 = 17mm |
| `10000011` | `FiringHeat1` | Current barrel heat |
| `60000011` | `FiringHeatMax1` | Max barrel heat |
| `10000036` | `TeamID` | -1 spectator, 0 red, 1 blue |
| `10000037` | `TeamNumber` | In-team number (1-5 ground, 6 aerial, 7 sentry, ...) |
| `60000002` | `Class` | Career ID (1001 hero, 1003 infantry, 1004 sentry, ...) |

### Tags (boolean, 1 = active)

| ID | Name |
|---|---|
| `50000007` | `Defeated` |
| `50000003` | `Overheated` |
| `50000004` | `Blocked` (video feed jammed) |
| `50000005` | `Reviving` |

### Global (Global Attribute Map)

| ID | Name | Unit / Notes |
|---|---|---|
| `80000001` | `G_MaxGameTime` | Match total time (ms) |
| `80000002` | `G_CurGameTime` | Elapsed time (ms) |
| `80000005` | `G_CurMatchStatus` | 0 not started, 1 in progress, 2 finished |
| `80000006` | `G_GameStartCountDown` | Countdown to start (ms) |
| `80000003` | `G_CurMapId` | Map identifier |

### Team (Team Attribute Map)

| ID | Name |
|---|---|
| `74000001` | `TM_State` (0 lost, 1 won) |
| `74000003` | `TM_Coins` |
| `74000009` | `G_ControlZone_TeamID` (-1 neutral, 0 red, 1 blue) |

## Accessing Attributes in Your HUD

```typescript
import { AttributeStore, ERobotBridgeDemoAttributeId } from '@axisray-lab/gestalt-hud-sdk';

// After store.start():
const hp = store.getBattleAttribute(ERobotBridgeDemoAttributeId.Health);
const hpMax = store.getBattleAttribute(ERobotBridgeDemoAttributeId.HealthMax);
const hpPercent = hpMax > 0 ? (hp / hpMax) * 100 : 0;

const isDefeated = store.isTagActive(ERobotBridgeDemoAttributeId.Defeated);
```
