# Attribute Map and Scope Guide

This file explains how public FBS attributes arrive in a Workshop HUD. It is not a hand-maintained list of IDs.

For the complete current protocol use:

- [Generated FBS reference](generated/fbs-reference.md)
- [Machine-readable protocol index](../protocol/protocol-reference.json)
- [Raw public FBS schemas](../schemas/fbs/)
- `@axisray-lab/gestalt-hud-sdk/protocol`

Those artifacts are generated together and include every public enum member, source file, numeric value, and schema provenance.

## Snapshot hierarchy

```text
HUDAttributeData
├── global                    match/map-wide attribute map
├── player                    local player metadata map
├── battle                    local player's robot/battle map
├── base
│   └── G_BaseId_0 + teamId  each main-base entity map
└── playerBattle
    └── <player id>           each player's robot/battle map
```

| Scope | Type | Typical content |
| --- | --- | --- |
| `global` | `Record<string, number>` | Match time/status, map state, zones |
| `player` | `Record<string, number>` | Local player slot/account-independent metadata |
| `battle` | `Record<string, number>` | HP, class, ammo, energy, combat tags |
| `base` | Nested record | Two main bases keyed by base entity ID |
| `playerBattle` | Nested record | Scoreboard/team robot state |

## Attribute keys

FBS enums use numeric values, but JavaScript object keys received through JSON are strings:

```ts
import { ERobotBridgeDemoAttributeId as Attr } from '@axisray-lab/gestalt-hud-sdk/workshop';

const health = snapshot.battle[String(Attr.Health)] ?? 0;
```

Bracket access with a numeric enum also works in JavaScript because it is coerced to a string, but explicit `String(...)` makes the wire representation clear.

## Complete snapshot rule

The host sends complete snapshots. Replace every scope on every update:

```ts
battle.value = { ...(snapshot.battle ?? {}) };
global.value = { ...(snapshot.global ?? {}) };
player.value = { ...(snapshot.player ?? {}) };
base.value = Object.fromEntries(
  Object.entries(snapshot.base ?? {}).map(([id, values]) => [id, { ...values }]),
);
playerBattle.value = Object.fromEntries(
  Object.entries(snapshot.playerBattle ?? {}).map(([id, values]) => [id, { ...values }]),
);
```

Merging forever leaves stale values when an entity or attribute disappears.

## Value conventions

Conventions come from the FBS comments and generated reference. Common patterns include:

- `...Thou`: thousandths, where `1000` means 100%.
- time attributes ending in `Ms` or documented as milliseconds: divide by `1000` for seconds.
- tag/status attributes: normally numeric `0` or `1`; treat any protocol-specific semantics according to its FBS comment.
- IDs and enum values: numbers, not display-ready strings.

Do not infer a type solely from the numeric range when a generated enum or FBS comment exists.

## Bullet and ammo mapping

Use `ERobotBridgeDemoBulletType` and the matching ammo family:

| Bullet type | Current ammo | Capacity/real ammo |
| --- | --- | --- |
| `Projectile42mm` (0) | `Ammo42mmCount` | `Real42mmAmmoCount` |
| `Projectile17mm` (1) | `Ammo17mmCount` | `Real17mmAmmoCount` |
| `Dart` (2) | `AmmoDartCount` | `RealDartAmmoCount` |
| `Laser` (3) | `AmmoLaserCount` | `RealLaserAmmoCount` |

```ts
import {
  ERobotBridgeDemoAttributeId as Attr,
  ERobotBridgeDemoBulletType as BulletType,
} from '@axisray-lab/gestalt-hud-sdk/workshop';

function currentAmmo(battle: Record<string, number>): number {
  switch (battle[String(Attr.BulletType)]) {
    case BulletType.Projectile42mm:
      return battle[String(Attr.Ammo42mmCount)] ?? 0;
    case BulletType.Projectile17mm:
      return battle[String(Attr.Ammo17mmCount)] ?? 0;
    case BulletType.Dart:
      return battle[String(Attr.AmmoDartCount)] ?? 0;
    case BulletType.Laser:
      return battle[String(Attr.AmmoLaserCount)] ?? 0;
    default:
      return 0;
  }
}
```

## Main-base map handling

The current host forwards `baseAttributesMap` only. `data.base` is keyed by base entity ID, with the stable formula `G_BaseId_0 + teamId`:

```ts
const redBase = snapshot.base[String(Attr.G_BaseId_0)] ?? {};
const blueBase = snapshot.base[String(Attr.G_BaseId_0 + 1)] ?? {};

const redHp = redBase[String(Attr.Health)] ?? 0;
const blueHp = blueBase[String(Attr.Health)] ?? 0;
```

Do not assign teams from `Object.keys(data.base)` order. The Workshop bridge does not currently append outpost, buff-station, or zone attribute maps to this scope. Use their dedicated global attributes when available.

`playerBattle` keys are player IDs. Use the `PlayerID`, `TeamID`, and `TeamNumber` attributes inside each map when available.

## Regeneration and drift

```powershell
npm run protocol:generate
npm run protocol:verify
```

`protocol:generate` reads only the vendored public files under `schemas/fbs/`. `protocol:verify` fails when generated TypeScript, JSON, documentation, provenance, or hashes no longer match those sources.
