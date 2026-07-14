#!/usr/bin/env node

/**
 * Trusted local-tool protocol probe for Shipping E2E.
 *
 * This connects to the game's privileged loopback WebSocket endpoint. It must
 * never be bundled into or invoked by Steam Workshop HUD content.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  AttributeStore,
  ERobotBridgeDemoAttributeId as Attr,
  ERobotBridgeDemoBulletType as BulletType,
  HUDBridge,
  TrustedWebSocketMethod,
} from '../dist/index.js';

const args = parseArgs(process.argv.slice(2));
const port = readIntegerArg(args, 'port', { min: 1, max: 65535 });
const expectedMapId = readIntegerArg(args, 'map-id', { min: 0 });
const localPlayerId = readIntegerArg(args, 'local-player-id', {
  defaultValue: 0,
  min: 0,
});
const expectedCareerId = readIntegerArg(args, 'expected-career-id', {
  defaultValue: 0,
  min: 0,
});
const timeoutMs = readIntegerArg(args, 'timeout-ms', {
  defaultValue: 180_000,
  min: 1,
});
const stabilityMs = readIntegerArg(args, 'stability-ms', {
  defaultValue: 60_000,
  min: 1,
});
const outPath = resolve(readStringArg(args, 'out'));

const report = {
  startedAt: new Date().toISOString(),
  mode: 'TrustedWebSocket',
  notice: 'Trusted local-tool only; never available to Workshop iframe code.',
  endpoint: `ws://127.0.0.1:${port}`,
  expectedMapId,
  expectedCareerId,
  localPlayerId,
  timeoutMs,
  stabilityMs,
  connectionTransitions: [],
  connectedAtValidation: false,
  gameTimeTransitions: [],
  initial: null,
  final: null,
  rpcErrors: [],
  exceptions: [],
  checks: [],
  passed: false,
};

let bridge;
let store;
let changeCount = 0;
let contextChangeCount = 0;
let lastGameTime = null;
let captureRpcErrors = true;
let fatal = false;
const baseState = {
  attributes: {},
  mapOwners: new Map(),
  watchedMapIds: new Set(),
};

try {
  if (typeof globalThis.WebSocket !== 'function') {
    throw new Error('This probe requires a Node.js runtime with global WebSocket support.');
  }

  bridge = new HUDBridge({
    host: '127.0.0.1',
    port,
    maxReconnectAttempts: 0,
    heartbeatInterval: 1_000,
    requestTimeout: Math.min(10_000, timeoutMs),
  });

  const originalSend = bridge.send.bind(bridge);
  bridge.send = async (method, params) => {
    try {
      return await originalSend(method, params);
    } catch (error) {
      if (captureRpcErrors) {
        report.rpcErrors.push({
          observedAt: new Date().toISOString(),
          method,
          message: errorMessage(error),
        });
      }
      throw error;
    }
  };

  bridge.onConnectionChange((connected) => {
    report.connectionTransitions.push({
      observedAt: new Date().toISOString(),
      connected,
    });
  });

  store = new AttributeStore(bridge, { localPlayerId });
  store.onChange((mapId, attributes) => {
    changeCount++;
    const currentGameTime = readAttribute(
      store.globalAttributes,
      Attr.G_CurGameTime,
    );
    if (currentGameTime !== null && currentGameTime !== lastGameTime) {
      lastGameTime = currentGameTime;
      report.gameTimeTransitions.push({
        observedAt: new Date().toISOString(),
        observedAtMs: Date.now(),
        value: currentGameTime,
      });
    }
    const baseEntityId = baseState.mapOwners.get(mapId);
    if (baseEntityId !== undefined) {
      Object.assign((baseState.attributes[baseEntityId] ??= {}), attributes);
    }
    void discoverAndWatchBaseMaps(store, bridge, baseState).catch(() => undefined);
  });
  store.onContextChange(() => {
    contextChangeCount++;
  });
  store.start();
  await bridge.connect();

  const deadline = Date.now() + timeoutMs;
  let initialObservedAt = 0;

  while (Date.now() < deadline) {
    const current = createSnapshot(
      store,
      localPlayerId,
      changeCount,
      contextChangeCount,
      baseState.attributes,
    );
    if (
      report.initial === null &&
      snapshotHasRequiredData(current, expectedMapId, expectedCareerId)
    ) {
      report.initial = current;
      initialObservedAt = Date.now();
      process.stdout.write(
        `[trusted-protocol-e2e] Initial protocol snapshot at change ${current.changeCount}.\n`,
      );
    }

    if (
      report.initial !== null &&
      Date.now() - initialObservedAt >= stabilityMs &&
      current.changeCount > report.initial.changeCount &&
      current.signals.gameTime !== report.initial.signals.gameTime &&
      hasRecentGameTimeChange(report.gameTimeTransitions, initialObservedAt, stabilityMs) &&
      bridge.connected
    ) {
      report.final = current;
      break;
    }
    await delay(100);
  }

  report.final ??= createSnapshot(
    store,
    localPlayerId,
    changeCount,
    contextChangeCount,
    baseState.attributes,
  );
  report.connectedAtValidation = bridge.connected;

  addCheck(
    'trusted WebSocket connected',
    report.connectionTransitions.some((entry) => entry.connected === true) &&
      report.connectedAtValidation,
    report.endpoint,
  );
  addCheck(
    'context map id matches the requested map',
    report.final.context.mapId === expectedMapId,
    `${String(report.final.context.mapId)} (expected ${expectedMapId})`,
  );
  if (expectedCareerId > 0) {
    addCheck(
      'context career id matches the requested combatant',
      report.final.context.careerId === expectedCareerId &&
        report.final.combat.mode === 'combatant',
      `${String(report.final.context.careerId)} / ${report.final.combat.mode} ` +
        `(expected career ${expectedCareerId} / combatant)`,
    );
  }
  addCheck(
    'global, local-player, player-battle, battle, and base scopes are non-empty',
    report.final.scopeCounts.global > 0 &&
      report.final.scopeCounts.player > 0 &&
      report.final.scopeCounts.playerBattle > 0 &&
      report.final.scopeCounts.battle > 0 &&
      report.final.scopeCounts.baseMaps > 0 &&
      report.final.scopeCounts.baseAttributes > 0,
    JSON.stringify(report.final.scopeCounts),
  );
  addCheck(
    'game-time and match-status attributes are finite',
    isFiniteNumber(report.final.signals.gameTime) &&
      isFiniteNumber(report.final.signals.matchStatus),
    JSON.stringify({
      gameTime: report.final.signals.gameTime,
      matchStatus: report.final.signals.matchStatus,
    }),
  );
  addCheck(
    'combat attributes match spectator/combatant presence rules',
    combatPayloadIsValid(report.final),
    JSON.stringify({
      combat: report.final.combat,
      signals: {
        health: report.final.signals.health,
        healthMax: report.final.signals.healthMax,
        bulletType: report.final.signals.bulletType,
        activeAmmoKey: report.final.signals.activeAmmoKey,
        activeAmmo: report.final.signals.activeAmmo,
      },
    }),
  );
  addCheck(
    'attribute updates advance throughout the stability period',
    report.initial !== null &&
      report.final.changeCount > report.initial.changeCount &&
      report.final.signals.gameTime !== report.initial.signals.gameTime &&
      hasRecentGameTimeChange(
        report.gameTimeTransitions,
        report.initial.observedAtMs,
        stabilityMs,
      ) &&
      report.final.observedAtMs - report.initial.observedAtMs >= stabilityMs,
    report.initial === null
      ? 'no complete initial snapshot'
      : `changes ${report.initial.changeCount} -> ${report.final.changeCount}, ` +
        `gameTime ${report.initial.signals.gameTime} -> ${report.final.signals.gameTime} over ${
          report.final.observedAtMs - report.initial.observedAtMs
        }ms; last gameTime change ${
          report.gameTimeTransitions.at(-1)?.observedAt ?? 'not observed'
        }`,
  );
  addCheck(
    'no trusted JSON-RPC request failed',
    report.rpcErrors.length === 0,
    report.rpcErrors.map((error) => `${error.method}: ${error.message}`).join(' | '),
  );

  report.passed = report.checks.every((check) => check.passed);
} catch (error) {
  fatal = true;
  report.exceptions.push({ stage: 'trusted-protocol-e2e', message: errorMessage(error) });
  addCheck('trusted protocol probe completed', false, errorMessage(error));
} finally {
  captureRpcErrors = false;
  try {
    store?.stop();
  } catch (error) {
    report.exceptions.push({ stage: 'store-stop', message: errorMessage(error) });
  }
  try {
    bridge?.disconnect();
  } catch (error) {
    report.exceptions.push({ stage: 'bridge-disconnect', message: errorMessage(error) });
  }

  report.passed =
    !fatal &&
    report.exceptions.length === 0 &&
    report.checks.length > 0 &&
    report.checks.every((check) => check.passed);
  report.finishedAt = new Date().toISOString();
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`[trusted-protocol-e2e] Report: ${outPath}\n`);
}

process.exitCode = report.passed ? 0 : fatal ? 2 : 1;

function createSnapshot(
  attributeStore,
  selectedPlayerId,
  observedChangeCount,
  observedContextChangeCount,
  baseAttributes,
) {
  const global = attributeStore.globalAttributes;
  const player = attributeStore.playerAttributes[selectedPlayerId] ?? {};
  const playerBattle =
    attributeStore.playerBattleAttributes[selectedPlayerId] ?? {};
  const battle = attributeStore.battleAttributes;
  const bulletType = readAttribute(battle, Attr.BulletType);
  const ammoId = ammoIdForBulletType(bulletType);
  const combat = describeCombatPayload(attributeStore.context, battle, ammoId);

  return {
    observedAt: new Date().toISOString(),
    observedAtMs: Date.now(),
    changeCount: observedChangeCount,
    contextChangeCount: observedContextChangeCount,
    context: { ...attributeStore.context },
    mapIds: {
      player: attributeStore.playerAttributeMapIds[selectedPlayerId] ?? null,
      battle: attributeStore.playerBattleAttributeMapIds[selectedPlayerId] ?? null,
    },
    scopeCounts: {
      global: Object.keys(global).length,
      player: Object.keys(player).length,
      playerBattle: Object.keys(playerBattle).length,
      battle: Object.keys(battle).length,
      baseMaps: Object.values(baseAttributes).filter(
        (attributes) => Object.keys(attributes).length > 0,
      ).length,
      baseAttributes: Object.values(baseAttributes).reduce(
        (count, attributes) => count + Object.keys(attributes).length,
        0,
      ),
    },
    combat,
    signals: {
      gameTime: readAttribute(global, Attr.G_CurGameTime),
      matchStatus: readAttribute(global, Attr.G_CurMatchStatus),
      health: readAttribute(battle, Attr.Health),
      healthMax: readAttribute(battle, Attr.HealthMax),
      bulletType,
      activeAmmoKey: ammoId === null ? null : String(ammoId),
      activeAmmo: ammoId === null ? null : readAttribute(battle, ammoId),
    },
  };
}

function snapshotHasRequiredData(snapshot, expectedMap, expectedCareer) {
  return (
    snapshot.context.mapId === expectedMap &&
    (expectedCareer === 0 ||
      (snapshot.context.careerId === expectedCareer &&
        snapshot.combat.mode === 'combatant')) &&
    snapshot.scopeCounts.global > 0 &&
    snapshot.scopeCounts.player > 0 &&
    snapshot.scopeCounts.playerBattle > 0 &&
    snapshot.scopeCounts.battle > 0 &&
    snapshot.scopeCounts.baseMaps > 0 &&
    snapshot.scopeCounts.baseAttributes > 0 &&
    isFiniteNumber(snapshot.signals.gameTime) &&
    isFiniteNumber(snapshot.signals.matchStatus) &&
    combatPayloadIsValid(snapshot)
  );
}

function readAttribute(source, id) {
  const value = source[String(id)];
  return isFiniteNumber(value) ? value : null;
}

function ammoIdForBulletType(bulletType) {
  switch (bulletType) {
    case BulletType.Projectile42mm:
      return Attr.Ammo42mmCount;
    case BulletType.Projectile17mm:
      return Attr.Ammo17mmCount;
    case BulletType.Dart:
      return Attr.AmmoDartCount;
    case BulletType.Laser:
      return Attr.AmmoLaserCount;
    default:
      return null;
  }
}

function isSupportedBulletType(value) {
  return (
    value === BulletType.Projectile42mm ||
    value === BulletType.Projectile17mm ||
    value === BulletType.Dart ||
    value === BulletType.Laser
  );
}

function describeCombatPayload(context, battle, activeAmmoId) {
  const healthPresent = hasFiniteAttribute(battle, Attr.Health);
  const healthMaxPresent = hasFiniteAttribute(battle, Attr.HealthMax);
  const bulletTypePresent = hasFiniteAttribute(battle, Attr.BulletType);
  const ammoIds = [
    Attr.Ammo42mmCount,
    Attr.Ammo17mmCount,
    Attr.AmmoDartCount,
    Attr.AmmoLaserCount,
  ];
  const ammoKeysPresent = ammoIds
    .filter((id) => hasFiniteAttribute(battle, id))
    .map(String);
  const ammoPresent = ammoKeysPresent.length > 0;
  const allAbsent =
    !healthPresent && !healthMaxPresent && !bulletTypePresent && !ammoPresent;
  const complete =
    healthPresent &&
    healthMaxPresent &&
    bulletTypePresent &&
    isSupportedBulletType(readAttribute(battle, Attr.BulletType)) &&
    activeAmmoId !== null &&
    hasFiniteAttribute(battle, activeAmmoId);

  return {
    mode:
      context.teamId === -1 && context.careerId === 0
        ? 'spectator'
        : 'combatant',
    payloadState: allAbsent ? 'absent' : complete ? 'complete' : 'partial',
    battleKeys: Object.keys(battle).sort((left, right) => Number(left) - Number(right)),
    keyPresence: {
      health: healthPresent,
      healthMax: healthMaxPresent,
      bulletType: bulletTypePresent,
      ammo: ammoPresent,
      ammoKeys: ammoKeysPresent,
      expectedAmmoKey: activeAmmoId === null ? null : String(activeAmmoId),
    },
  };
}

function combatPayloadIsValid(snapshot) {
  if (snapshot.combat.mode === 'spectator') {
    return (
      snapshot.combat.payloadState === 'absent' ||
      snapshot.combat.payloadState === 'complete'
    );
  }
  return snapshot.combat.payloadState === 'complete';
}

function hasFiniteAttribute(source, id) {
  return Object.hasOwn(source, String(id)) && isFiniteNumber(source[String(id)]);
}

async function discoverAndWatchBaseMaps(attributeStore, trustedBridge, state) {
  const freshMapIds = [];
  for (const [rawEntityId, rawMapId] of Object.entries(
    attributeStore.globalAttributes,
  )) {
    const entityId = Number(rawEntityId);
    const mapId = Number(rawMapId);
    if (
      !Number.isInteger(entityId) ||
      entityId < Attr.G_BaseId_0 ||
      entityId >= Attr.G_BaseId_MAX ||
      !Number.isFinite(mapId) ||
      mapId <= 0
    ) {
      continue;
    }
    state.mapOwners.set(mapId, entityId);
    if (state.watchedMapIds.has(mapId)) continue;
    state.watchedMapIds.add(mapId);
    freshMapIds.push(mapId);
  }
  if (freshMapIds.length === 0) return;

  try {
    await trustedBridge.send(TrustedWebSocketMethod.watchAttributeMaps, {
      attribute_map_ids: freshMapIds,
      watch_type: 2,
    });
  } catch (error) {
    for (const mapId of freshMapIds) state.watchedMapIds.delete(mapId);
    throw error;
  }
  await trustedBridge.send(TrustedWebSocketMethod.watchAttributeMaps, {
    attribute_map_ids: freshMapIds,
    watch_type: 1,
  });
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasRecentGameTimeChange(transitions, initialAtMs, requiredStabilityMs) {
  const lastTransition = transitions.at(-1);
  return (
    lastTransition !== undefined &&
    lastTransition.observedAtMs >= initialAtMs + Math.floor(requiredStabilityMs / 2)
  );
}

function addCheck(name, passed, detail = '') {
  report.checks.push({ name, passed, detail });
  process.stdout.write(
    `[trusted-protocol-e2e] ${passed ? 'PASS' : 'FAIL'} ${name}${
      detail ? ` - ${detail}` : ''
    }\n`,
  );
}

function parseArgs(tokens) {
  const parsed = new Map();
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (!token.startsWith('--')) throw new TypeError(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = tokens[index + 1];
    if (!value || value.startsWith('--')) {
      throw new TypeError(`Missing value for --${key}`);
    }
    if (parsed.has(key)) throw new TypeError(`Duplicate argument: --${key}`);
    parsed.set(key, value);
    index++;
  }
  return parsed;
}

function readStringArg(parsed, name) {
  const value = parsed.get(name);
  if (!value) throw new TypeError(`Missing required argument: --${name}`);
  return value;
}

function readIntegerArg(
  parsed,
  name,
  { defaultValue, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {},
) {
  const raw = parsed.get(name);
  if (raw === undefined && defaultValue !== undefined) return defaultValue;
  if (raw === undefined || !/^-?\d+$/.test(raw)) {
    throw new TypeError(`--${name} must be an integer`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`--${name} must be in the range ${min}..${max}`);
  }
  return value;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}
