/**
 * Attribute Store — framework-agnostic reactive attribute tracking.
 *
 * Subscribes to `WatchAttributeMapsResult` updates via the HUDBridge
 * and maintains an in-memory snapshot of attribute values.  UI code
 * listens via `onChange` or polls `get()`.
 *
 * This module intentionally avoids Vue/React/Svelte imports so it can
 * be wrapped by any framework's reactivity system.
 */

import type { HUDBridge } from './hud-bridge';
import {
  SyncType,
  type AttributeMapUpdate,
  type WatchAttributeMapsResult,
  type GameGlobalVars,
  type GameContext,
} from '../protocol/types';
import { ERobotBridgeDemoAttributeId } from '../protocol/attribute-id';

// ── Public types ──

export type AttributeChangeListener = (
  mapId: number,
  attributes: Record<string, number>,
) => void;

export type GameContextChangeListener = (context: GameContext) => void;

// ── Implementation ──

export class AttributeStore {
  private bridge: HUDBridge;
  private cleanups: Array<() => void> = [];

  /** Current player battle attributes (local player only). */
  readonly battleAttributes: Record<string, number> = {};

  /** Global game attributes (match time, status, map, etc.). */
  readonly globalAttributes: Record<string, number> = {};

  /** All player attributes indexed by player ID. */
  readonly playerAttributes: Record<number, Record<string, number>> = {};

  /** Current game context. */
  readonly context: GameContext = {
    localPlayerId: null,
    mapId: null,
    teamId: -1,
    careerId: 0,
  };

  private globalMapId: number | null = null;
  private playerMapId: number | null = null;
  private battleMapId: number | null = null;

  private readonly changeListeners = new Set<AttributeChangeListener>();
  private readonly contextListeners = new Set<GameContextChangeListener>();

  constructor(bridge: HUDBridge) {
    this.bridge = bridge;
  }

  /**
   * Start listening for attribute updates from the game.
   * Call this after `bridge.connect()` resolves.
   */
  start(): void {
    const unsub1 = this.bridge.onRequest(
      'cycleobject.WatchAttributeMapsResult',
      (params) => {
        this.handleWatchResult(params as WatchAttributeMapsResult);
      },
    );

    const unsub2 = this.bridge.onRequest(
      'cycleobject.GameGlobalVarsFinishSetup',
      (params) => {
        this.handleGameGlobalVars(params as GameGlobalVars);
      },
    );

    this.cleanups.push(unsub1, unsub2);
  }

  /** Stop listening and clear all state. */
  stop(): void {
    for (const fn of this.cleanups) fn();
    this.cleanups.length = 0;
    this.clearState();
  }

  // ── Subscriptions ──

  /**
   * Subscribe to attribute changes.  The listener fires whenever any
   * attribute map receives an update (after merging).
   * Returns an unsubscribe function.
   */
  onChange(listener: AttributeChangeListener): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  /**
   * Subscribe to game context changes (player ID, team, map, etc.).
   * Returns an unsubscribe function.
   */
  onContextChange(listener: GameContextChangeListener): () => void {
    this.contextListeners.add(listener);
    return () => {
      this.contextListeners.delete(listener);
    };
  }

  // ── Convenience getters ──

  /** Read a single numeric attribute from local player's battle map. */
  getBattleAttribute(
    id: ERobotBridgeDemoAttributeId,
    defaultValue = 0,
  ): number {
    const val = this.battleAttributes[String(id)];
    return Number.isFinite(val) ? val : defaultValue;
  }

  /** Read a single numeric attribute from the global attribute map. */
  getGlobalAttribute(
    id: ERobotBridgeDemoAttributeId,
    defaultValue = 0,
  ): number {
    const val = this.globalAttributes[String(id)];
    return Number.isFinite(val) ? val : defaultValue;
  }

  /** Check whether a tag attribute is currently active (value === 1). */
  isTagActive(id: ERobotBridgeDemoAttributeId): boolean {
    return Number(this.battleAttributes[String(id)]) === 1;
  }

  // ── Internals ──

  private handleWatchResult(result: WatchAttributeMapsResult): void {
    if (!result?.watch_attribute_maps_results) return;

    for (const update of result.watch_attribute_maps_results) {
      this.mergeUpdate(update);
    }
  }

  private mergeUpdate(update: AttributeMapUpdate): void {
    const { attribute_map_id, attributes, sync_type } = update;
    const isIncremental = sync_type === SyncType.IncrementalSync;

    // Global map
    if (attribute_map_id === this.globalMapId) {
      if (isIncremental) {
        Object.assign(this.globalAttributes, attributes);
      } else {
        this.replaceObject(this.globalAttributes, attributes);
      }
      this.notifyChange(attribute_map_id, this.globalAttributes);
      return;
    }

    // Local player battle map
    if (attribute_map_id === this.battleMapId) {
      if (isIncremental) {
        Object.assign(this.battleAttributes, attributes);
      } else {
        this.replaceObject(this.battleAttributes, attributes);
      }
      this.extractContext();
      this.notifyChange(attribute_map_id, this.battleAttributes);
      return;
    }

    // Player map — extract battle map pointer
    if (attribute_map_id === this.playerMapId) {
      const battleKey = String(
        ERobotBridgeDemoAttributeId.PlayerBattleAttributeMapID,
      );
      const newBattleMapId = attributes[battleKey];
      if (
        newBattleMapId &&
        newBattleMapId !== this.battleMapId
      ) {
        this.battleMapId = newBattleMapId;
        this.watchMaps([newBattleMapId]);
      }
    }

    this.notifyChange(attribute_map_id, attributes);
  }

  private async handleGameGlobalVars(vars: GameGlobalVars): Promise<void> {
    const globalMapId = vars?.global_var_att_map_id;
    if (!globalMapId) return;
    if (this.globalMapId === globalMapId) return;

    this.globalMapId = globalMapId;
    await this.watchMaps([globalMapId]);
  }

  private async watchMaps(mapIds: number[]): Promise<void> {
    try {
      await this.bridge.send('cycleobject.watchAttributeMaps', {
        attribute_map_ids: mapIds,
        watch_type: 1, // WatchContinuous
      });
    } catch {
      // connection may be down; updates will resume on reconnect
    }
  }

  private extractContext(): void {
    const teamId = this.getBattleAttribute(
      ERobotBridgeDemoAttributeId.TeamID,
      -1,
    );
    const careerId = this.getBattleAttribute(
      ERobotBridgeDemoAttributeId.Class,
      0,
    );

    let changed = false;
    if (this.context.teamId !== teamId) {
      this.context.teamId = teamId;
      changed = true;
    }
    if (this.context.careerId !== careerId) {
      this.context.careerId = careerId;
      changed = true;
    }

    if (changed) {
      for (const listener of this.contextListeners) {
        try {
          listener({ ...this.context });
        } catch {
          // listener error must not break the store
        }
      }
    }
  }

  private notifyChange(
    mapId: number,
    attributes: Record<string, number>,
  ): void {
    for (const listener of this.changeListeners) {
      try {
        listener(mapId, attributes);
      } catch {
        // listener error must not break the store
      }
    }
  }

  private replaceObject(
    target: Record<string, number>,
    source: Record<string, number>,
  ): void {
    for (const key of Object.keys(target)) {
      delete target[key];
    }
    Object.assign(target, source);
  }

  private clearState(): void {
    this.replaceObject(this.battleAttributes, {});
    this.replaceObject(this.globalAttributes, {});
    for (const key of Object.keys(this.playerAttributes)) {
      delete this.playerAttributes[Number(key)];
    }
    this.globalMapId = null;
    this.playerMapId = null;
    this.battleMapId = null;
    this.context.localPlayerId = null;
    this.context.mapId = null;
    this.context.teamId = -1;
    this.context.careerId = 0;
  }
}
