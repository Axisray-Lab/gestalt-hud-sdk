# Attribute Map Reference

Gestalt System uses a hierarchical **Attribute Map** system to replicate game state from the server to all connected clients (including the HUD). This document explains the structure, sync semantics, attribute ID layout, and value conventions.

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

1. The **Global Attribute Map** is announced via the `GameGlobalVarsFinishSetup` server request. Its `global_var_att_map_id` field tells the HUD which map to watch.
2. Inside the global map, each **player slot** (key `0` through `99999`) maps to a **Player Attribute Map ID**.
3. Inside each player map, the attribute `PlayerBattleAttributeMapID` (`1000001`) points to a **Battle Attribute Map** that carries per-frame combat values.
4. Bases (`G_BaseId_0`–`G_BaseId_MAX`) and outposts (`G_OutpostId_0`–`G_OutpostId_MAX`) also appear in the global map.

### Workshop HUD Data Flow

In Workshop mode, the game SPA pre-processes the hierarchy and delivers attribute data via `hud:attribute_update` postMessage, grouped into five scopes:

| Scope | postMessage field | Description |
|-------|-------------------|-------------|
| Global | `data.global` | Match timer, map, match status |
| Player | `data.player` | Player slot metadata |
| Battle | `data.battle` | Local player's combat state (HP, ammo, heat, etc.) |
| Base | `data.base` | Base HP, keyed by base map ID |
| PlayerBattle | `data.playerBattle` | All players' battle attributes, keyed by player ID |

## Sync Types

Every attribute map update carries a `sync_type` field:

| Value | Name | Semantics |
|-------|------|-----------|
| `0` | **FullSync** | The entire map is replaced — any attribute NOT in the payload should be treated as reset to 0. |
| `1` | **IncrementalSync** | Only changed attributes are included — merge them into your current snapshot. |

**Implementation guideline**: on `FullSync`, clear the local snapshot and write the new values. On `IncrementalSync`, merge (spread) new values into the existing snapshot.

## Value Conventions

### Attribute Keys

Attribute keys in the data records are **stringified FBS enum IDs** (e.g. `"10000003"` for Health). Use `ERobotBridgeDemoAttributeId` enum members and convert with `String(id)` for lookups.

### Thousandths (Multiplier Attributes)

Attributes with a `Thou` suffix (ID range `61xxxxxx`) represent **thousandths**: a value of `1000` means 100%, `1250` means 125%. Divide by 1000 to get the actual multiplier.

### Tag (Boolean) Attributes

Attributes in the `5xxxxxxx` range are boolean tags: `1` = active, `0` = inactive. Use them to detect states like "defeated", "overheated", or "reviving".

### Time Values

Time-related global attributes (`G_MaxGameTime`, `G_CurGameTime`, `G_GameStartCountDown`) are in **milliseconds**.

## Attribute ID Ranges

All attribute IDs are unsigned 32-bit integers. The first digit(s) denote the category:

| Range Prefix | Category | Description |
|-------------|----------|-------------|
| `0x` | Player slot IDs | Keys in the global map, value = player attribute map ID |
| `01xxxxxx` | Map pointers | `PlayerBattleAttributeMapID`, `PlayerBaseAttributeMapID` |
| `1xxxxxxx` | Value attributes | Numeric quantities: HP, ammo, heat, energy, etc. |
| `5xxxxxxx` | Tag attributes | Boolean flags: defeated, overheated, reviving, etc. (1 = active, 0 = inactive) |
| `51xxxxxx` | Functional tags | Actor visibility, HP bar control, etc. |
| `6xxxxxxx` | State attributes | Class, level, max values, combat multipliers |
| `61xxxxxx` | Combat multipliers | Thousandths: 1000 = 100% |
| `62xxxxxx` | Bullet attributes | Bullet type, speed, radius |
| `63xxxxxx` | Combat statistics | Cumulative damage dealt/taken, bullets fired |
| `74xxxxxx` | Team attributes | Team coins, state, ammo caps |
| `75xxxxxx` | Zone controller | Marker ID, control progress |
| `8xxxxxxx` | Global variables | Match time, map ID, match status |

---

## HUD Core Attributes

The following ~35 attributes are the most commonly used by HUD developers. They are grouped by scope.

### Global Scope

| ID | Enum Name | Description | Unit |
|----|-----------|-------------|------|
| `80000001` | `G_MaxGameTime` | Total match duration | ms |
| `80000002` | `G_CurGameTime` | Elapsed match time | ms |
| `80000003` | `G_CurMapId` | Current map identifier | enum |
| `80000005` | `G_CurMatchStatus` | Match state: 0 = not started, 1 = in progress, 2 = finished | enum |
| `80000006` | `G_GameStartCountDown` | Pre-match countdown remaining | ms |

### Player Battle Scope

#### Vitals

| ID | Enum Name | Description | Unit |
|----|-----------|-------------|------|
| `10000003` | `Health` | Current HP | points |
| `60000004` | `HealthMax` | Maximum HP | points |
| `10000013` | `Shield` | Current shield value | points |
| `10000004` | `BufferEnergy` | Buffer energy | points |
| `60000005` | `BufferEnergyMax` | Buffer energy capacity | points |

#### Identity

| ID | Enum Name | Description | Values |
|----|-----------|-------------|--------|
| `10000036` | `TeamID` | Player's team | -1 = spectator, 0 = red, 1 = blue |
| `10000037` | `TeamNumber` | In-team number | 1-5 ground, 6 aerial, 7 sentry |
| `60000002` | `Class` | Career/robot type | See `ERobotBridgeDemoCareerId` |
| `60000003` | `Level` | Current level | 1+ |
| `10000002` | `Experience` | Current XP | points |
| `60000020` | `NextLevelExpMax` | XP needed for next level | points |

#### Ammo & Firing

| ID | Enum Name | Description | Unit |
|----|-----------|-------------|------|
| `62000000` | `BulletType` | Active projectile type | 0 = 42mm, 1 = 17mm |
| `10000033` | `Ammo17mmCount` | 17mm ammo available | count |
| `10000034` | `Ammo42mmCount` | 42mm ammo available | count |
| `10000011` | `FiringHeat1` | Primary barrel heat | points |
| `60000011` | `FiringHeatMax1` | Primary barrel heat limit | points |
| `10000012` | `FiringHeat2` | Secondary barrel heat | points |
| `60000013` | `FiringHeatMax2` | Secondary barrel heat limit | points |
| `10000017` | `FiringHeatCoolingRate1` | Primary cooling rate | points/s |
| `10000054` | `FiringMode` | Current firing mode | enum |

#### Energy & Chassis

| ID | Enum Name | Description | Unit |
|----|-----------|-------------|------|
| `10000006` | `ChassisEnergy` | Chassis energy | points |
| `60000007` | `ChassisEnergyMax` | Chassis energy capacity | points |
| `10000007` | `ChassisPower` | Chassis power consumption | W |
| `60000008` | `ChassisPowerMax` | Chassis power limit | W |
| `10000005` | `CapacityEnergy` | Supercapacitor energy | points |
| `60000006` | `CapacityEnergyMax` | Supercapacitor capacity | points |

#### Remote Supply (RMUC2026)

| ID | Enum Name | Description | Unit |
|----|-----------|-------------|------|
| `10000055` | `RemoteAmmoPendingCount` | Pending remote ammo deliveries | count |
| `10000056` | `RemoteAmmoCountdownMs` | Time until next remote ammo delivery | ms |
| `10000057` | `RemoteRepairPendingCount` | Pending remote repair deliveries | count |
| `10000058` | `RemoteRepairCountdownMs` | Time until next remote repair delivery | ms |

### Tag Attributes (Boolean)

| ID | Enum Name | Description |
|----|-----------|-------------|
| `50000007` | `Defeated` | Robot is eliminated |
| `50000003` | `Overheated` | Barrel has exceeded heat limit |
| `50000004` | `Blocked` | Video feed is jammed |
| `50000005` | `Reviving` | Robot is being revived |
| `50000006` | `FiringLocked` | Shooting is temporarily locked |
| `50000001` | `OutOfCombat` | Robot is out of combat |
| `50000002` | `Weakened` | Robot is in weakened state |
| `50000009` | `LowPower` | Chassis power is critically low |
| `50000013` | `Invincible` | Robot is invincible (spawn protection) |
| `50000022` | `IsBoost` | Speed boost is active |
| `50000023` | `IsCharging` | Supercapacitor is charging |
| `50000019` | `IsMatchStarted` | Match has started (per-player) |

### Combat Multipliers (Thousandths)

| ID | Enum Name | Description | Example |
|----|-----------|-------------|---------|
| `61000000` | `AttackMultiplierThou` | Attack multiplier | 1000 = 100% |
| `61000001` | `DefenseMultiplierThou` | Defense multiplier | 1250 = 125% |
| `61000002` | `DamageMultiplierThou` | Damage multiplier | 800 = 80% |
| `61000003` | `RecoverMultiplierThou` | HP recovery multiplier | 1000 = 100% |
| `61000004` | `ColdMultiplierThou` | Heat cooling multiplier | 1000 = 100% |

### Team Attributes

| ID | Enum Name | Description | Values |
|----|-----------|-------------|--------|
| `74000001` | `TM_State` | Team result | 0 = lost, 1 = won |
| `74000003` | `TM_Coins` | Team economy coins | count |
| `74000009` | `G_ControlZone_TeamID` | Central zone owner | -1 = neutral, 0 = red, 1 = blue |
| `74000014` | `G_BlueOutpostZone_TeamID` | Blue outpost zone owner | team ID |
| `74000015` | `G_RedOutpostZone_TeamID` | Red outpost zone owner | team ID |
| `74000016` | `G_BlueBaseCountdown` | Blue base vulnerability timer | ms |
| `74000017` | `G_RedBaseCountdown` | Red base vulnerability timer | ms |

### Zone Controller Attributes

| ID | Enum Name | Description | Unit |
|----|-----------|-------------|------|
| `75000001` | `TB_MarkerId` | Zone marker identifier | ID |
| `75000002` | `TB_BelongTeamID` | Zone controlling team | team ID |
| `75000004` | `TB_ControlProgress` | Zone capture progress | points |
| `75000005` | `TB_ControlProgressMax` | Zone capture target | points |

### Combat Statistics

| ID | Enum Name | Description | Unit |
|----|-----------|-------------|------|
| `63000000` | `DamageAppliedTotal` | Total damage dealt | points |
| `63000001` | `DamageTakenTotal` | Total damage received | points |
| `63000002` | `BulletFiredTotal` | Total bullets fired | count |

---

## Career / Robot Types

| Value | Enum Name | Description |
|-------|-----------|-------------|
| `0` | `None` | No career assigned |
| `1001` | `Hero` | Hero robot |
| `1002` | `Engineer` | Engineer robot |
| `1003` | `Infantry` | Standard infantry |
| `1004` | `Sentry` | Automated sentry |
| `1005` | `Aerial` | Aerial robot (drone) |
| `1006` | `Radar` | Radar station |
| `1007` | `Dart` | Dart launcher |
| `1008` | `InfantrySecondary` | Balance infantry |
| `2000` | `Building` | Generic building |
| `2001` | `Base` | Team base |
| `2002` | `Outpost` | Team outpost |

---

## Usage Examples

### WebSocket Mode (Development)

```typescript
import { AttributeStore, ERobotBridgeDemoAttributeId as Attr } from '@axisray-lab/gestalt-hud-sdk';

// After store.start():
const hp = store.getBattleAttribute(Attr.Health);
const hpMax = store.getBattleAttribute(Attr.HealthMax);
const hpPercent = hpMax > 0 ? (hp / hpMax) * 100 : 0;

const isDefeated = store.isTagActive(Attr.Defeated);
```

### Workshop Mode (postMessage)

```typescript
import { GestaltHUDBridge, ERobotBridgeDemoAttributeId as Attr } from '@axisray-lab/gestalt-hud-sdk/workshop';

const bridge = new GestaltHUDBridge();

bridge.onAttributeUpdate((data) => {
  const hp = data.battle[String(Attr.Health)] ?? 0;
  const hpMax = data.battle[String(Attr.HealthMax)] ?? 0;
  const hpPercent = hpMax > 0 ? (hp / hpMax) * 100 : 0;

  const isDefeated = data.battle[String(Attr.Defeated)] === 1;

  // Remaining match time
  const maxTime = data.global[String(Attr.G_MaxGameTime)] ?? 0;
  const curTime = data.global[String(Attr.G_CurGameTime)] ?? 0;
  const remainingSec = Math.max(0, Math.floor((maxTime - curTime) / 1000));
});
```

### Vanilla JS (UMD)

```html
<script src="gestalt-hud-sdk.workshop.umd.js"></script>
<script>
  var bridge = new GestaltHUD.GestaltHUDBridge();
  var Attr = GestaltHUD.ERobotBridgeDemoAttributeId;

  bridge.onAttributeUpdate(function (data) {
    var hp = data.battle[Attr.Health] || 0;
    var hpMax = data.battle[Attr.HealthMax] || 0;
    // ...
  });
</script>
```
