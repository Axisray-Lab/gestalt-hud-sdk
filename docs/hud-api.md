# Workshop HUD Communication API

The public mod API is a versioned `postMessage` exchange between the game parent and a sandboxed HUD iframe. Workshop protocol version is currently `1`; manifest schema version is `2`.

Import everything needed by a HUD from:

```ts
import {
  GestaltHUDBridge,
  HUDCountdownClock,
  MatchStatus,
  type HUDInitMessage,
  type HUDAttributeData,
} from '@axisray-lab/gestalt-hud-sdk/workshop';
```

## Parent to HUD

### `hud:init`

Sent after the iframe is loaded.

```ts
interface HUDInitMessage {
  type: 'hud:init';
  version: number;
  mapId: number;
  mapName: string;
  playerId: number;
  teamId: number;
  gameMode: '3v3' | '1v1' | 'training';
}
```

`wsPort` is not part of this message and is not exposed to Workshop HUDs.

### `hud:attribute_update`

```ts
interface HUDAttributeUpdateMessage {
  type: 'hud:attribute_update';
  mapId: number;
  sequence?: number;
  sentAtMs?: number;
  data: HUDAttributeData;
}

interface HUDAttributeData {
  global: Record<string, number>;
  player: Record<string, number>;
  battle: Record<string, number>;
  base: Record<string, Record<string, number>>;
  playerBattle: Record<number, Record<string, number>>;
}
```

The data object is a complete snapshot. Consumers should replace every scope on every accepted update. New hosts may include a positive, monotonically increasing `sequence` and an epoch-based `sentAtMs`; both fields remain optional for protocol v1 compatibility. `GestaltHUDBridge` discards duplicate or backward sequenced snapshots automatically.

`data.base` currently contains only main-base entity maps. Address them with `String(Attr.G_BaseId_0 + teamId)`; outpost, buff-station, and zone maps are not forwarded in this scope.

### `hud:game_event`

```ts
interface HUDGameEventMessage {
  type: 'hud:game_event';
  event: string;
  payload?: unknown;
}
```

Event names are forward-compatible strings. Ignore unknown events.

## HUD to parent

### `hud:ready`

Send after receiving `hud:init` and completing essential local setup:

```ts
bridge.sendReady('My HUD', '1.0.0');
```

Wire shape:

```ts
interface HUDReadyMessage {
  type: 'hud:ready';
  name: string;
  version: string;
}
```

### `hud:action`

```ts
type HUDAction =
  | 'open_settings'
  | 'exit_game'
  | 'resume_game'
  | 'exit_menu';

bridge.sendAction('open_settings');
```

An action is a request to the host, not a guarantee of interaction. HUD iframes are normally non-pointer-interactive; design the HUD primarily as a display surface.

### `hud:debug_log`

The bridge may forward diagnostic messages to the host when debug mode is enabled. A HUD can also send an explicit bounded line with `bridge.sendDebugLog(message)`. Do not include secrets, account identifiers, or complete attribute snapshots in debug text.

```ts
interface HUDDebugLogMessage {
  type: 'hud:debug_log';
  message: string;
}
```

## `GestaltHUDBridge`

```ts
const bridge = new GestaltHUDBridge({
  debug: false,
  targetOrigin: '*',
});
```

The game uses different loopback hostnames for parent and HUD content. The bridge additionally validates that inbound messages come from `window.parent` and match the supported runtime shape.

### Handlers

```ts
const offInit = bridge.onInit((message) => {});
const offAttributes = bridge.onAttributeUpdate((snapshot, metadata) => {
  // metadata: sequence?, sentAtMs?, receivedAtMs, transportLatencyMs?
});
const offEvent = bridge.onGameEvent((event, payload) => {});
```

Each registration returns an unsubscribe function.

`bridge.diagnostics` returns a frozen snapshot containing accepted/received/dropped counters, the last accepted sequence, and the latest transport timing values. One-argument attribute callbacks remain supported.

For a smooth match timer, `HUDCountdownClock` interpolates between authoritative updates and can subtract `metadata.transportLatencyMs` when re-anchoring:

```ts
const countdown = new HUDCountdownClock();
countdown.reanchor(maxTimeMs, currentTimeMs, {
  running: matchStatus === MatchStatus.InProgress,
  nowMs: performance.now(),
  transportLatencyMs: metadata.transportLatencyMs,
});
const remainingMs = countdown.getRemainingMs(performance.now());
```

### Outbound methods

```ts
bridge.sendReady(name, version);
bridge.sendAction(action, payload);
bridge.sendDebugLog(message);
```

### Teardown

```ts
offInit();
offAttributes();
offEvent();
bridge.destroy();
```

## Protocol and runtime guards

The protocol package exports runtime guards for parent messages and snapshots:

```ts
import {
  isHUDInitMessage,
  isHUDAttributeUpdateMessage,
  isHUDGameEventMessage,
} from '@axisray-lab/gestalt-hud-sdk/workshop';
```

Use these if implementing a framework-specific adapter outside `GestaltHUDBridge`.

## Attribute enums

The Workshop entry re-exports every public generated FBS enum. Prefer enum names to numeric literals:

```ts
import {
  ERobotBridgeDemoAttributeId as Attr,
  ERobotBridgeDemoBulletType,
} from '@axisray-lab/gestalt-hud-sdk/workshop';

const bulletType = snapshot.battle[String(Attr.BulletType)];
if (bulletType === ERobotBridgeDemoBulletType.Dart) {
  const dartAmmo = snapshot.battle[String(Attr.AmmoDartCount)] ?? 0;
}
```

Complete references:

- [`generated/fbs-reference.md`](generated/fbs-reference.md)
- [`../protocol/protocol-reference.json`](../protocol/protocol-reference.json)
- [`../schemas/fbs/`](../schemas/fbs/)

## Trusted WebSocket tooling

The package root retains `HUDBridge` and `AttributeStore` for controlled local monitor/tool development. Those APIs communicate with a privileged local JSON-RPC server and are deliberately outside the Workshop mod contract. Do not import them into Steam HUD content, and do not document their methods as public Workshop capabilities.
