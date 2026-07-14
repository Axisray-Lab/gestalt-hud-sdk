/**
 * Attribute tracking for the experimental trusted WebSocket bridge.
 *
 * @experimental Workshop HUDs receive already-scoped snapshots over
 * `postMessage` and must not use this privileged API.
 */

import {
  TrustedWebSocketEvent,
  TrustedWebSocketMethod,
  type HUDBridge,
} from './hud-bridge';
import {
  SyncType,
  type AttributeMapUpdate,
  type WatchAttributeMapsResult,
  type GameGlobalVars,
  type GameContext,
} from '../protocol/types';
import { ERobotBridgeDemoAttributeId } from '../protocol/attribute-id';

const WATCH_ONCE = 1;
const WATCH_CONTINUOUS = 2;
const STOP_WATCH = 3;

export type AttributeChangeListener = (
  mapId: number,
  attributes: Record<string, number>,
) => void;

export type GameContextChangeListener = (context: GameContext) => void;

export interface AttributeStoreOptions {
  /**
   * Local player's match ID. The WebSocket bootstrap event does not include
   * this value, so trusted clients must provide it or call `setLocalPlayerId`.
   */
  localPlayerId?: number | null;
}

/** @experimental Trusted local-tool API; not available to Workshop iframes. */
export class AttributeStore {
  private readonly bridge: HUDBridge;
  private cleanups: Array<() => void> = [];
  private started = false;

  /** Current local player's battle attributes. */
  readonly battleAttributes: Record<string, number> = {};
  /** Global game attributes. */
  readonly globalAttributes: Record<string, number> = {};
  /** Player-level attributes indexed by player ID. */
  readonly playerAttributes: Record<number, Record<string, number>> = {};
  /** Battle attributes indexed by player ID. */
  readonly playerBattleAttributes: Record<
    number,
    Record<string, number>
  > = {};
  /** Player ID -> player attribute-map ID. */
  readonly playerAttributeMapIds: Record<number, number> = {};
  /** Player ID -> battle attribute-map ID. */
  readonly playerBattleAttributeMapIds: Record<number, number> = {};

  readonly context: GameContext = {
    localPlayerId: null,
    mapId: null,
    teamId: -1,
    careerId: 0,
  };

  private globalMapId: number | null = null;
  private playerMapId: number | null = null;
  private battleMapId: number | null = null;
  private readonly playerMapOwners = new Map<number, number>();
  private readonly battleMapOwners = new Map<number, number>();
  private readonly watchedMapIds = new Set<number>();

  private readonly changeListeners = new Set<AttributeChangeListener>();
  private readonly contextListeners = new Set<GameContextChangeListener>();

  constructor(bridge: HUDBridge, options: AttributeStoreOptions = {}) {
    this.bridge = bridge;
    this.context.localPlayerId = options.localPlayerId ?? null;
  }

  /** Register handlers. Call after (or immediately before) `bridge.connect()`. */
  start(): void {
    if (this.started) return;
    this.started = true;

    this.cleanups.push(
      this.bridge.onRequest(
        TrustedWebSocketEvent.watchAttributeMapsResult,
        (params) => this.handleWatchResult(params),
      ),
      this.bridge.onRequest(
        TrustedWebSocketEvent.gameGlobalVarsFinishSetup,
        (params) => this.handleGameGlobalVars(params),
      ),
      this.bridge.onConnectionChange((connected) => {
        if (!connected || !this.started) return;
        // Subscriptions are per socket. Re-register every known map after an
        // automatic reconnect; the next push reconciles any changed links.
        const mapIds = this.collectKnownMapIds();
        this.watchedMapIds.clear();
        if (mapIds.length > 0) void this.watchMaps(mapIds);
        void this.requestGlobalVarsSetup();
      }),
    );
    if (this.bridge.connected) void this.requestGlobalVarsSetup();
  }

  /** Unregister handlers, stop server watches, and clear all state. */
  stop(): void {
    if (!this.started) return;
    this.started = false;
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups.length = 0;
    const watched = [...this.watchedMapIds];
    this.watchedMapIds.clear();
    if (watched.length > 0 && this.bridge.connected) {
      void this.bridge
        .send(TrustedWebSocketMethod.watchAttributeMaps, {
          attribute_map_ids: watched,
          watch_type: STOP_WATCH,
        })
        .catch(() => undefined);
    }
    this.clearState();
  }

  /**
   * Select the local player whose player/battle chain backs convenience state.
   * The ID normally comes from the result of the trusted `game.startGame` call.
   */
  setLocalPlayerId(playerId: number | null): void {
    if (playerId !== null && (!Number.isFinite(playerId) || playerId < 0)) {
      throw new TypeError('local player ID must be a non-negative number or null');
    }
    if (this.context.localPlayerId === playerId) return;
    this.context.localPlayerId = playerId;
    this.playerMapId = null;
    this.battleMapId = null;
    this.replaceObject(this.battleAttributes, {});
    this.activateLocalPlayerChain();
    this.extractContext(true);
  }

  onChange(listener: AttributeChangeListener): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  onContextChange(listener: GameContextChangeListener): () => void {
    this.contextListeners.add(listener);
    return () => this.contextListeners.delete(listener);
  }

  getBattleAttribute(
    id: ERobotBridgeDemoAttributeId,
    defaultValue = 0,
  ): number {
    const value = this.battleAttributes[String(id)];
    return Number.isFinite(value) ? value : defaultValue;
  }

  getGlobalAttribute(
    id: ERobotBridgeDemoAttributeId,
    defaultValue = 0,
  ): number {
    const value = this.globalAttributes[String(id)];
    return Number.isFinite(value) ? value : defaultValue;
  }

  isTagActive(id: ERobotBridgeDemoAttributeId): boolean {
    return Number(this.battleAttributes[String(id)]) === 1;
  }

  private handleWatchResult(params: unknown): void {
    if (!isWatchAttributeMapsResult(params)) return;
    for (const update of params.watch_attribute_maps_results) {
      this.mergeUpdate(update);
    }
  }

  private mergeUpdate(update: AttributeMapUpdate): void {
    const { attribute_map_id: mapId, attributes, sync_type: syncType } = update;
    const incremental = syncType === SyncType.IncrementalSync;

    if (mapId === this.globalMapId) {
      this.applyUpdate(this.globalAttributes, attributes, incremental);
      this.reconcilePlayerMaps();
      this.extractContext();
      this.notifyChange(mapId, this.globalAttributes);
      return;
    }

    const playerId = this.playerMapOwners.get(mapId);
    if (playerId !== undefined) {
      const player = (this.playerAttributes[playerId] ??= {});
      this.applyUpdate(player, attributes, incremental);
      this.reconcileBattleMap(playerId, player);
      if (playerId === this.context.localPlayerId) this.extractContext();
      this.notifyChange(mapId, player);
      return;
    }

    const battleOwner = this.battleMapOwners.get(mapId);
    if (battleOwner !== undefined) {
      const battle = (this.playerBattleAttributes[battleOwner] ??= {});
      this.applyUpdate(battle, attributes, incremental);
      if (battleOwner === this.context.localPlayerId) {
        this.applyUpdate(this.battleAttributes, attributes, incremental);
        this.extractContext();
      }
      this.notifyChange(mapId, battle);
      return;
    }

    this.notifyChange(mapId, attributes);
  }

  private handleGameGlobalVars(params: unknown): void {
    if (!isGameGlobalVars(params)) return;
    const nextGlobalMapId = params.global_var_att_map_id;
    if (nextGlobalMapId === this.globalMapId) return;
    this.globalMapId = nextGlobalMapId;
    void this.watchMaps([nextGlobalMapId]);
  }

  private async requestGlobalVarsSetup(): Promise<void> {
    try {
      await this.bridge.send(TrustedWebSocketMethod.requestGlobalVarsSetup, {});
    } catch {
      // Older trusted hosts may not expose the best-effort resync method. The
      // normal gameGlobalVars.finishSetup push remains supported.
    }
  }

  private reconcilePlayerMaps(): void {
    const discovered = new Map<number, number>();
    for (const [key, rawMapId] of Object.entries(this.globalAttributes)) {
      const playerId = Number(key);
      const mapId = Number(rawMapId);
      if (
        Number.isInteger(playerId) &&
        playerId >= ERobotBridgeDemoAttributeId.PlayerID_0 &&
        playerId < ERobotBridgeDemoAttributeId.PlayerID_MAX &&
        Number.isFinite(mapId) &&
        mapId > 0
      ) {
        discovered.set(playerId, mapId);
      }
    }

    for (const [playerId, oldMapId] of Object.entries(
      this.playerAttributeMapIds,
    ).map(([id, mapId]) => [Number(id), mapId] as const)) {
      const nextMapId = discovered.get(playerId);
      if (nextMapId === oldMapId) continue;
      delete this.playerAttributeMapIds[playerId];
      this.playerMapOwners.delete(oldMapId);
      if (playerId === this.context.localPlayerId) this.playerMapId = null;
    }

    const mapsToWatch: number[] = [];
    for (const [playerId, mapId] of discovered) {
      const previousMapId = this.playerAttributeMapIds[playerId];
      if (previousMapId === mapId) continue;
      if (previousMapId) this.playerMapOwners.delete(previousMapId);
      this.playerAttributeMapIds[playerId] = mapId;
      this.playerMapOwners.set(mapId, playerId);
      mapsToWatch.push(mapId);
    }
    if (mapsToWatch.length > 0) void this.watchMaps(mapsToWatch);
    this.activateLocalPlayerChain();
  }

  private reconcileBattleMap(
    playerId: number,
    playerAttributes: Record<string, number>,
  ): void {
    const key = String(ERobotBridgeDemoAttributeId.PlayerBattleAttributeMapID);
    const nextMapId = Number(playerAttributes[key] ?? 0);
    const previousMapId = this.playerBattleAttributeMapIds[playerId];
    if (!Number.isFinite(nextMapId) || nextMapId <= 0) {
      if (previousMapId) {
        delete this.playerBattleAttributeMapIds[playerId];
        this.battleMapOwners.delete(previousMapId);
      }
      if (playerId === this.context.localPlayerId) {
        this.battleMapId = null;
        this.replaceObject(this.battleAttributes, {});
      }
      return;
    }
    if (nextMapId === previousMapId) return;

    if (previousMapId) this.battleMapOwners.delete(previousMapId);
    this.playerBattleAttributeMapIds[playerId] = nextMapId;
    this.battleMapOwners.set(nextMapId, playerId);
    if (playerId === this.context.localPlayerId) {
      this.battleMapId = nextMapId;
      const existing = this.playerBattleAttributes[playerId];
      this.replaceObject(this.battleAttributes, existing ?? {});
    }
    void this.watchMaps([nextMapId]);
  }

  private activateLocalPlayerChain(): void {
    const localPlayerId = this.context.localPlayerId;
    if (localPlayerId === null) return;
    const playerMapId = this.playerAttributeMapIds[localPlayerId];
    if (playerMapId) {
      this.playerMapId = playerMapId;
      void this.watchMaps([playerMapId]);
    }
    const battleMapId = this.playerBattleAttributeMapIds[localPlayerId];
    if (battleMapId) {
      this.battleMapId = battleMapId;
      this.replaceObject(
        this.battleAttributes,
        this.playerBattleAttributes[localPlayerId] ?? {},
      );
      void this.watchMaps([battleMapId]);
    }
  }

  private async watchMaps(mapIds: number[]): Promise<void> {
    const fresh = [...new Set(mapIds)].filter(
      (mapId) => Number.isFinite(mapId) && mapId > 0 && !this.watchedMapIds.has(mapId),
    );
    if (fresh.length === 0 || !this.bridge.connected) return;
    fresh.forEach((mapId) => this.watchedMapIds.add(mapId));
    try {
      await this.bridge.send(TrustedWebSocketMethod.watchAttributeMaps, {
        attribute_map_ids: fresh,
        watch_type: WATCH_CONTINUOUS,
      });
    } catch {
      fresh.forEach((mapId) => this.watchedMapIds.delete(mapId));
      return;
    }
    try {
      // Request an immediate full snapshot to close the bootstrap race where
      // attributes were populated before WatchContinuous was registered.
      await this.bridge.send(TrustedWebSocketMethod.watchAttributeMaps, {
        attribute_map_ids: fresh,
        watch_type: WATCH_ONCE,
      });
    } catch {
      // Continuous watching is already active; a later update will reconcile.
    }
  }

  private collectKnownMapIds(): number[] {
    return [
      this.globalMapId,
      ...Object.values(this.playerAttributeMapIds),
      ...Object.values(this.playerBattleAttributeMapIds),
    ].filter((mapId): mapId is number => mapId !== null && mapId > 0);
  }

  private extractContext(force = false): void {
    const mapId = this.readFinite(
      this.globalAttributes,
      ERobotBridgeDemoAttributeId.G_CurMapId,
      null,
    );
    const teamId = this.readFinite(
      this.battleAttributes,
      ERobotBridgeDemoAttributeId.TeamID,
      -1,
    );
    const careerId = this.readFinite(
      this.battleAttributes,
      ERobotBridgeDemoAttributeId.Class,
      0,
    );

    const changed =
      force ||
      this.context.mapId !== mapId ||
      this.context.teamId !== teamId ||
      this.context.careerId !== careerId;
    this.context.mapId = mapId;
    this.context.teamId = teamId;
    this.context.careerId = careerId;
    if (!changed) return;

    for (const listener of this.contextListeners) {
      try {
        listener({ ...this.context });
      } catch {
        // Listener failures do not interrupt attribute processing.
      }
    }
  }

  private readFinite<T extends number | null>(
    source: Record<string, number>,
    id: ERobotBridgeDemoAttributeId,
    fallback: T,
  ): number | T {
    const value = source[String(id)];
    return Number.isFinite(value) ? value : fallback;
  }

  private notifyChange(
    mapId: number,
    attributes: Record<string, number>,
  ): void {
    for (const listener of this.changeListeners) {
      try {
        listener(mapId, attributes);
      } catch {
        // Listener failures do not interrupt attribute processing.
      }
    }
  }

  private applyUpdate(
    target: Record<string, number>,
    source: Record<string, number>,
    incremental: boolean,
  ): void {
    if (!incremental) this.replaceObject(target, source);
    else Object.assign(target, source);
  }

  private replaceObject(
    target: Record<string, number>,
    source: Record<string, number>,
  ): void {
    for (const key of Object.keys(target)) delete target[key];
    Object.assign(target, source);
  }

  private clearState(): void {
    this.replaceObject(this.battleAttributes, {});
    this.replaceObject(this.globalAttributes, {});
    clearNumericRecord(this.playerAttributes);
    clearNumericRecord(this.playerBattleAttributes);
    clearNumericRecord(this.playerAttributeMapIds);
    clearNumericRecord(this.playerBattleAttributeMapIds);
    this.playerMapOwners.clear();
    this.battleMapOwners.clear();
    this.globalMapId = null;
    this.playerMapId = null;
    this.battleMapId = null;
    this.context.localPlayerId = null;
    this.context.mapId = null;
    this.context.teamId = -1;
    this.context.careerId = 0;
  }
}

function isGameGlobalVars(value: unknown): value is Required<GameGlobalVars> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const mapId = (value as Record<string, unknown>).global_var_att_map_id;
  return typeof mapId === 'number' && Number.isFinite(mapId) && mapId > 0;
}

function isWatchAttributeMapsResult(
  value: unknown,
): value is WatchAttributeMapsResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const updates = (value as Record<string, unknown>)
    .watch_attribute_maps_results;
  return (
    Array.isArray(updates) &&
    updates.every((update) => {
      if (typeof update !== 'object' || update === null || Array.isArray(update)) {
        return false;
      }
      const item = update as Record<string, unknown>;
      return (
        typeof item.attribute_map_id === 'number' &&
        (item.sync_type === SyncType.FullSync ||
          item.sync_type === SyncType.IncrementalSync) &&
        isNumberRecord(item.attributes)
      );
    })
  );
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (entry) => typeof entry === 'number' && Number.isFinite(entry),
    )
  );
}

function clearNumericRecord(record: Record<number, unknown>): void {
  for (const key of Object.keys(record)) delete record[Number(key)];
}
