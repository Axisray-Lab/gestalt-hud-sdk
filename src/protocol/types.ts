/**
 * Shared protocol types for the HUD SDK.
 */

/**
 * Sync type indicating how the attribute update should be merged.
 *   0 = FullSync  — replace the entire attribute map with the new values
 *   1 = IncrementalSync — merge new values into the existing map
 */
export enum SyncType {
  FullSync = 0,
  IncrementalSync = 1,
}

/**
 * A single attribute-map update element received from the game engine.
 */
export interface AttributeMapUpdate {
  /** How to merge: 0 = full replace, 1 = incremental merge */
  sync_type: SyncType;
  /** The numeric ID of the attribute map being updated */
  attribute_map_id: number;
  /** Key-value pairs where key is `String(AttributeId)` and value is a number */
  attributes: Record<string, number>;
}

/**
 * Payload of a `WatchAttributeMapsResult` notification from the server.
 */
export interface WatchAttributeMapsResult {
  watch_attribute_maps_results: AttributeMapUpdate[];
}

/**
 * Game global variables sent during game initialization.
 */
export interface GameGlobalVars {
  /** The attribute map ID for the global variable map */
  global_var_att_map_id?: number;
  [key: string]: number | undefined;
}

/**
 * Context about the current game session provided to the HUD.
 */
export interface GameContext {
  /** Local player's unique ID within the match */
  localPlayerId: number | null;
  /** Current map identifier string */
  mapId: string | null;
  /** Player's team: -1 = spectator, 0 = red, 1 = blue */
  teamId: number;
  /** Player's career/class type */
  careerId: number;
}

/**
 * Match status values from `G_CurMatchStatus`.
 */
export enum MatchStatus {
  NotStarted = 0,
  InProgress = 1,
  Finished = 2,
}

// ── JSON-RPC protocol types ──

export enum JSONRPCType {
  Request = 0,
  Response = 1,
}

export interface JSONRPCRequest {
  type: JSONRPCType.Request;
  id: number;
  method: string;
  params?: unknown;
}

export interface JSONRPCResponse {
  type: JSONRPCType.Response;
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * HUD feature flags — mirrors the game's `HUDFeature` enum.
 * Each value corresponds to an independently toggleable HUD element.
 */
export enum HUDFeature {
  CROSSHAIR = 'crosshair',
  PLAYER_BADGE = 'playerBadge',
  BASE_STATUS = 'baseStatus',
  TEAMMATE_PANEL = 'teammatePanel',
  ENEMY_PANEL = 'enemyPanel',
  AMMO_DISPLAY = 'ammoDisplay',
  AMMO_BUY_BUTTONS = 'ammoBuyButtons',
  ENERGY_BARS = 'energyBars',
  CONTROL_AREA_INDICATOR = 'controlAreaIndicator',
  RMUC2026_ZONE_INDICATORS = 'rmuc2026ZoneIndicators',
  BUFF_BAR = 'buffBar',
  COIN_DISPLAY = 'coinDisplay',
  GAME_STATUS_BANNER = 'gameStatusBanner',
  HIT_SCREEN_EFFECT = 'hitScreenEffect',
}

export enum TeamDisplayMode {
  FULL = 'full',
  SINGLE_HERO = 'single',
  CUSTOM = 'custom',
}

export interface HUDFeatureConfig {
  enabled: boolean;
  position?: string;
  scale?: number;
  customProps?: Record<string, unknown>;
}
