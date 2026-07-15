import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ERobotBridgeDemoAttributeId,
  CAPABILITY_BIT_HUD,
  MAP_ID_TO_NAME,
  WORKSHOP_HUD_ACTION_WHITELIST,
  WORKSHOP_MANIFEST_SCHEMA_VERSION,
  checkRequiredMods,
  isHUDAttributeUpdateMessage,
  isHUDInitMessage,
  isSPAToHUDMessage,
  validateManifest,
} from '../dist/protocol/index.js';
import {
  AttributeStore,
  HUDBridge,
  TrustedWebSocketEvent,
  TrustedWebSocketMethod,
} from '../dist/index.js';
import {
  GestaltHUDBridge,
  HUDCountdownClock,
} from '../dist/workshop/index.js';

test('v1 HUD manifests remain backward compatible', () => {
  const result = validateManifest({
    name: 'Legacy HUD',
    version: '1.0.0',
    author: 'SDK test',
    description: 'No sdk_version or provides',
  });
  assert.equal(result.valid, true);
  assert.deepEqual(result.manifest.provides, ['hud']);
  assert.equal(result.manifest.sdk_version, 1);
  assert.equal(result.manifest.entry, 'index.html');

  const emptyProvides = validateManifest({
    name: 'Legacy HUD',
    version: '1.0.0',
    author: 'SDK test',
    description: 'Native host treats an empty provides list as HUD',
    provides: [],
  });
  assert.equal(emptyProvides.valid, true);
  assert.deepEqual(emptyProvides.manifest.provides, ['hud']);
});

test('manifest validator rejects unsafe upload paths and malformed map lists', () => {
  const base = {
    name: 'Unsafe HUD',
    version: '1.0.0',
    author: 'SDK test',
    description: 'Manifest validation fixture',
  };
  for (const entry of ['../index.html', '/absolute/index.html', 'C:\\hud\\index.html']) {
    const result = validateManifest({ ...base, entry });
    assert.equal(result.valid, false);
    assert.match(result.errors.join(' '), /entry/);
  }
  const badMaps = validateManifest({
    ...base,
    compatible_maps: ['L_Map2026', ''],
  });
  assert.equal(badMaps.valid, false);
  assert.match(badMaps.errors.join(' '), /compatible_maps/);
});

test('manifest schema v2 rejects incomplete map capabilities', () => {
  assert.equal(WORKSHOP_MANIFEST_SCHEMA_VERSION, 2);
  const result = validateManifest({
    sdk_version: 2,
    name: 'Map',
    version: '1.0.0',
    author: 'SDK test',
    description: 'Missing engine and map section',
    provides: ['map'],
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /engine_version/);
  assert.match(result.errors.join(' '), /map section/);
});

test('Workshop fingerprint helpers mirror the host v2 contract', () => {
  assert.equal(CAPABILITY_BIT_HUD, 1);
  assert.equal(MAP_ID_TO_NAME[8], 'L_Map2026_IF');
  assert.equal(WORKSHOP_HUD_ACTION_WHITELIST.has('resume_game'), true);

  const matching = checkRequiredMods(
    2,
    [{
      workshopItemId: '3698375578',
      contentHash: 'AABB',
      displayName: 'Example HUD',
      capabilities: CAPABILITY_BIT_HUD,
    }],
    2,
    [{
      workshopItemId: 3698375578,
      isInstalled: true,
      contentHash: 'aabb',
    }],
  );
  assert.deepEqual(matching, {
    ok: true,
    reason: 'ok',
    missingModNames: [],
  });

  const mismatch = checkRequiredMods(
    2,
    [{
      workshopItemId: 3698375578,
      contentHash: 'expected',
      displayName: 'Example HUD',
      capabilities: CAPABILITY_BIT_HUD,
    }],
    2,
    [{
      workshopItemId: 3698375578,
      isInstalled: true,
      contentHash: 'different',
    }],
  );
  assert.equal(mismatch.reason, 'content_mismatch');
});

test('hud:init guard matches current postMessage v1 (no wsPort)', () => {
  const init = {
    type: 'hud:init',
    version: 1,
    mapId: 8,
    mapName: 'L_Map2026_IF',
    playerId: 42,
    teamId: 0,
    gameMode: '3v3',
  };
  assert.equal(isHUDInitMessage(init), true);
  assert.equal(isSPAToHUDMessage(init), true);
  assert.equal(isHUDInitMessage({ ...init, gameMode: 'unknown' }), false);
});

test('hud:attribute_update guard accepts legacy messages and validates optional metadata', () => {
  const data = {
    global: {},
    player: {},
    battle: {},
    base: {},
    playerBattle: {},
  };
  const legacy = {
    type: 'hud:attribute_update',
    mapId: 8,
    data,
  };

  assert.equal(isHUDAttributeUpdateMessage(legacy), true);
  assert.equal(isHUDAttributeUpdateMessage({
    ...legacy,
    sequence: 1,
    sentAtMs: 1_750_000_000_000.25,
  }), true);

  for (const sequence of [0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(isHUDAttributeUpdateMessage({ ...legacy, sequence }), false);
  }
  for (const sentAtMs of [NaN, Infinity, -Infinity, 'now']) {
    assert.equal(isHUDAttributeUpdateMessage({ ...legacy, sentAtMs }), false);
  }
});

test('Workshop bridge filters non-monotonic sequences and exposes transport metadata', () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalPerformance = Object.getOwnPropertyDescriptor(
    globalThis,
    'performance',
  );
  let listener;
  const parent = { postMessage() {} };
  const fakeWindow = {
    parent,
    addEventListener(type, handler) {
      if (type === 'message') listener = handler;
    },
    removeEventListener() {},
  };
  const data = {
    global: {},
    player: {},
    battle: {},
    base: {},
    playerBattle: {},
  };
  globalThis.window = fakeWindow;
  globalThis.document = { referrer: 'http://localhost:8123/game' };
  Object.defineProperty(globalThis, 'performance', {
    configurable: true,
    value: {
      timeOrigin: 1_000,
      now: () => 250,
    },
  });

  try {
    const bridge = new GestaltHUDBridge({ debug: false });
    const updates = [];
    bridge.onAttributeUpdate((snapshot, metadata) => {
      updates.push({ snapshot, metadata });
    });
    const send = (extra = {}) => listener({
      source: parent,
      origin: 'http://localhost:8123',
      data: {
        type: 'hud:attribute_update',
        mapId: 8,
        data,
        ...extra,
      },
    });

    send();
    send({ sequence: 2, sentAtMs: 1_200 });
    send({ sequence: 2, sentAtMs: 1_210 });
    send({ sequence: 1, sentAtMs: 1_220 });
    send({ sequence: 3, sentAtMs: 1_225 });

    assert.equal(updates.length, 3);
    assert.deepEqual(updates[0].metadata, {
      sequence: undefined,
      sentAtMs: undefined,
      receivedAtMs: 1_250,
      transportLatencyMs: undefined,
    });
    assert.equal(Object.isFrozen(updates[0].metadata), true);
    assert.deepEqual(updates[1].metadata, {
      sequence: 2,
      sentAtMs: 1_200,
      receivedAtMs: 1_250,
      transportLatencyMs: 50,
    });
    assert.deepEqual(updates[2].metadata, {
      sequence: 3,
      sentAtMs: 1_225,
      receivedAtMs: 1_250,
      transportLatencyMs: 25,
    });
    assert.deepEqual(bridge.diagnostics, {
      received: 5,
      accepted: 3,
      dropped: 2,
      lastSequence: 3,
      lastSentAtMs: 1_225,
      lastReceivedAtMs: 1_250,
      lastTransportLatencyMs: 25,
    });
    assert.equal(Object.isFrozen(bridge.diagnostics), true);

    // A legacy host can continue sending unsequenced snapshots even after a
    // sequenced frame; only messages that opt into ordering are filtered.
    send();
    assert.equal(updates.length, 4);
    assert.deepEqual(bridge.diagnostics, {
      received: 6,
      accepted: 4,
      dropped: 2,
      lastSequence: 3,
      lastSentAtMs: null,
      lastReceivedAtMs: 1_250,
      lastTransportLatencyMs: null,
    });
    bridge.destroy();
  } finally {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
    if (originalPerformance) {
      Object.defineProperty(globalThis, 'performance', originalPerformance);
    } else {
      delete globalThis.performance;
    }
  }
});

test('HUDCountdownClock removes transport latency and interpolates locally', () => {
  const clock = new HUDCountdownClock();
  assert.equal(clock.getRemainingMs(5_000), null);
  assert.equal(clock.reanchor(300_000, 10_000, {
    running: true,
    nowMs: 5_000,
    transportLatencyMs: 250,
  }), true);
  assert.equal(clock.getRemainingMs(5_000), 289_750);
  assert.equal(clock.getRemainingMs(6_000), 288_750);
  assert.equal(clock.getRemainingMs(500_000), 0);

  assert.equal(clock.reanchor(300_000, 11_000, {
    running: false,
    nowMs: 7_000,
    transportLatencyMs: 500,
  }), true);
  assert.equal(clock.getRemainingMs(7_000), 289_000);
  assert.equal(clock.getRemainingMs(9_000), 289_000);

  assert.equal(clock.reanchor(0, 0, {
    running: true,
    nowMs: 10_000,
  }), false);
  assert.equal(clock.getRemainingMs(11_000), 289_000);
  clock.reset();
  assert.equal(clock.hasAnchor, false);
  assert.equal(clock.getRemainingMs(11_000), null);
});

test('Workshop bridge accepts only valid messages from its parent window', () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  let listener;
  const posted = [];
  const parent = {
    postMessage(message, targetOrigin) {
      posted.push({ message, targetOrigin });
    },
  };
  const fakeWindow = {
    parent,
    addEventListener(type, handler) {
      if (type === 'message') listener = handler;
    },
    removeEventListener() {},
  };
  globalThis.window = fakeWindow;
  globalThis.document = { referrer: 'http://localhost:8123/game' };
  try {
    const bridge = new GestaltHUDBridge({ debug: false });
    let received = 0;
    bridge.onInit(() => received++);
    const init = {
      type: 'hud:init',
      version: 1,
      mapId: 8,
      mapName: 'L_Map2026_IF',
      playerId: 42,
      teamId: 0,
      gameMode: '3v3',
    };
    listener({ source: {}, origin: 'http://localhost:8123', data: init });
    listener({ source: parent, origin: 'http://attacker.test', data: init });
    listener({ source: parent, origin: 'http://localhost:8123', data: init });
    assert.equal(received, 1);

    bridge.sendReady('Contract HUD', '1.0.0');
    assert.equal(posted.at(-1).targetOrigin, 'http://localhost:8123');
    bridge.sendDebugLog('contract diagnostic');
    assert.deepEqual(posted.at(-1), {
      message: {
        type: 'hud:debug_log',
        message: '[Workshop HUD] contract diagnostic',
      },
      targetOrigin: 'http://localhost:8123',
    });
    bridge.destroy();
  } finally {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  }
});

test('trusted AttributeStore follows global -> player -> battle maps', async () => {
  const handlers = new Map();
  const sent = [];
  const bridge = {
    connected: true,
    onRequest(method, handler) {
      handlers.set(method, handler);
      return () => handlers.delete(method);
    },
    onConnectionChange() {
      return () => {};
    },
    async send(method, params) {
      sent.push({ method, params });
      return {};
    },
  };
  const store = new AttributeStore(bridge, { localPlayerId: 42 });
  store.start();

  handlers.get(TrustedWebSocketEvent.gameGlobalVarsFinishSetup)({
    global_var_att_map_id: 1000,
  });
  await Promise.resolve();
  handlers.get(TrustedWebSocketEvent.watchAttributeMapsResult)({
    watch_attribute_maps_results: [
      {
        sync_type: 0,
        attribute_map_id: 1000,
        attributes: {
          42: 2000,
          [ERobotBridgeDemoAttributeId.G_CurMapId]: 8,
        },
      },
    ],
  });
  await Promise.resolve();
  handlers.get(TrustedWebSocketEvent.watchAttributeMapsResult)({
    watch_attribute_maps_results: [
      {
        sync_type: 0,
        attribute_map_id: 2000,
        attributes: {
          [ERobotBridgeDemoAttributeId.PlayerBattleAttributeMapID]: 3000,
        },
      },
    ],
  });
  await Promise.resolve();
  handlers.get(TrustedWebSocketEvent.watchAttributeMapsResult)({
    watch_attribute_maps_results: [
      {
        sync_type: 0,
        attribute_map_id: 3000,
        attributes: {
          [ERobotBridgeDemoAttributeId.Health]: 600,
          [ERobotBridgeDemoAttributeId.TeamID]: 1,
          [ERobotBridgeDemoAttributeId.Class]: 1002,
        },
      },
    ],
  });

  assert.equal(store.context.localPlayerId, 42);
  assert.equal(store.context.mapId, 8);
  assert.equal(store.context.teamId, 1);
  assert.equal(
    store.battleAttributes[ERobotBridgeDemoAttributeId.Health],
    600,
  );
  assert.equal(store.playerAttributeMapIds[42], 2000);
  assert.equal(store.playerBattleAttributeMapIds[42], 3000);
  assert.ok(
    sent.some(
      ({ method, params }) =>
        method === TrustedWebSocketMethod.watchAttributeMaps &&
        params.watch_type === 2,
    ),
  );
  store.stop();
});

test('trusted HUDBridge times out and rejects pending requests on disconnect', async () => {
  const originalWebSocket = globalThis.WebSocket;
  class FakeWebSocket {
    static OPEN = 1;
    static CLOSED = 3;
    static instances = [];
    readyState = 0;
    onopen = null;
    onerror = null;
    onclose = null;
    onmessage = null;
    constructor() {
      FakeWebSocket.instances.push(this);
    }
    send() {}
    open() {
      this.readyState = FakeWebSocket.OPEN;
      this.onopen?.();
    }
    close() {
      this.readyState = FakeWebSocket.CLOSED;
      this.onclose?.();
    }
  }
  globalThis.WebSocket = FakeWebSocket;
  try {
    const bridge = new HUDBridge({
      port: 18820,
      heartbeatInterval: 0,
      requestTimeout: 10,
    });
    const connecting = bridge.connect();
    FakeWebSocket.instances[0].open();
    await connecting;
    await assert.rejects(bridge.send('test.neverResponds'), /timed out/);
    const pending = bridge.send('test.disconnect');
    bridge.disconnect();
    await assert.rejects(pending, /disconnected by client/);
  } finally {
    globalThis.WebSocket = originalWebSocket;
  }
});
