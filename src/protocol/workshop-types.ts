/**
 * Workshop HUD postMessage protocol (protocol version 1).
 *
 * This is the public contract between the game SPA (parent window) and a
 * Workshop HUD running in its sandboxed iframe. Existing fields and message
 * names are frozen; future protocol versions may only add fields/messages.
 */

// Main SPA -> Workshop HUD iframe

export type HUDGameMode = '3v3' | '1v1' | 'training';

export interface HUDInitMessage {
  type: 'hud:init';
  /** Workshop HUD postMessage protocol version. */
  version: number;
  /** ERobotBridgeDemoMapType numeric value. */
  mapId: number;
  /** Human-readable map enum name, e.g. "L_MapRMUL2026". */
  mapName: string;
  /** Local player's unique ID within this match. */
  playerId: number;
  /** Team ID: -1 = spectator, 0 = red, 1 = blue. */
  teamId: number;
  /** Game mode descriptor. */
  gameMode: HUDGameMode;
}

export interface HUDAttributeUpdateMessage {
  type: 'hud:attribute_update';
  /** ERobotBridgeDemoMapType numeric value. */
  mapId: number;
  data: HUDAttributeData;
}

export interface HUDAttributeData {
  /** Global match attributes (timers, match status, map-wide state). */
  global: Record<string, number>;
  /** Local player's player-level attributes. */
  player: Record<string, number>;
  /** Local player's battle (robot) attributes. */
  battle: Record<string, number>;
  /**
   * Base snapshots keyed by base entity ID (`G_BaseId_0 + teamId`).
   * This scope does not include the host's separate outpost/buff/zone maps.
   */
  base: Record<string, Record<string, number>>;
  /** Per-player battle attributes keyed by player ID. */
  playerBattle: Record<number, Record<string, number>>;
}

export interface HUDGameEventMessage {
  type: 'hud:game_event';
  /** Event identifier. Reserved for future use in protocol v1. */
  event: string;
  payload: unknown;
}

/** @deprecated Use {@link HUDGameEventMessage}. */
export type HUDEventMessage = HUDGameEventMessage;

// Workshop HUD iframe -> Main SPA

export interface HUDReadyMessage {
  type: 'hud:ready';
  /** HUD name from manifest.json. */
  name: string;
  /** HUD version from manifest.json. */
  version: string;
}

export type HUDAction =
  | 'open_settings'
  | 'exit_game'
  | 'resume_game'
  | 'exit_menu';

/** Actions currently accepted by the game SPA from Workshop HUD iframes. */
export const WORKSHOP_HUD_ACTION_WHITELIST: ReadonlySet<HUDAction> = new Set([
  'open_settings',
  'exit_game',
  'resume_game',
  'exit_menu',
]);

export interface HUDActionMessage {
  type: 'hud:action';
  /** Only host-whitelisted actions are processed. */
  action: HUDAction;
  payload?: unknown;
}

export interface HUDDebugLogMessage {
  type: 'hud:debug_log';
  message: string;
}

/** Union of messages the game SPA sends to a Workshop HUD. */
export type SPAToHUDMessage =
  | HUDInitMessage
  | HUDAttributeUpdateMessage
  | HUDGameEventMessage;

/** @deprecated Use {@link SPAToHUDMessage}. */
export type ParentToHUDMessage = SPAToHUDMessage;

/** Union of messages a Workshop HUD sends to the game SPA. */
export type HUDToSPAMessage =
  | HUDReadyMessage
  | HUDActionMessage
  | HUDDebugLogMessage;

/** @deprecated Use {@link HUDToSPAMessage}. */
export type HUDToParentMessage = HUDToSPAMessage;

export type WorkshopHUDMessage = SPAToHUDMessage | HUDToSPAMessage;

/** Current Workshop HUD postMessage protocol version. */
export const WORKSHOP_HUD_PROTOCOL_VERSION = 1;

const GAME_MODES: ReadonlySet<string> = new Set<HUDGameMode>([
  '3v3',
  '1v1',
  'training',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNumericRecord(value: unknown): value is Record<string, number> {
  return (
    isRecord(value) &&
    Object.values(value).every((entry) => isFiniteNumber(entry))
  );
}

function isNestedNumericRecord(
  value: unknown,
): value is Record<string, Record<string, number>> {
  return (
    isRecord(value) &&
    Object.values(value).every((entry) => isNumericRecord(entry))
  );
}

/** Runtime guard for a complete Workshop attribute snapshot. */
export function isHUDAttributeData(value: unknown): value is HUDAttributeData {
  if (!isRecord(value)) return false;
  return (
    isNumericRecord(value.global) &&
    isNumericRecord(value.player) &&
    isNumericRecord(value.battle) &&
    isNestedNumericRecord(value.base) &&
    isNestedNumericRecord(value.playerBattle)
  );
}

/** Runtime guard for `hud:init`. Unknown additional fields are ignored. */
export function isHUDInitMessage(value: unknown): value is HUDInitMessage {
  if (!isRecord(value) || value.type !== 'hud:init') return false;
  return (
    Number.isInteger(value.version) &&
    isFiniteNumber(value.mapId) &&
    typeof value.mapName === 'string' &&
    isFiniteNumber(value.playerId) &&
    isFiniteNumber(value.teamId) &&
    typeof value.gameMode === 'string' &&
    GAME_MODES.has(value.gameMode)
  );
}

/** Runtime guard for `hud:attribute_update`. */
export function isHUDAttributeUpdateMessage(
  value: unknown,
): value is HUDAttributeUpdateMessage {
  if (!isRecord(value) || value.type !== 'hud:attribute_update') return false;
  return isFiniteNumber(value.mapId) && isHUDAttributeData(value.data);
}

/** Runtime guard for the reserved `hud:game_event` message. */
export function isHUDGameEventMessage(
  value: unknown,
): value is HUDGameEventMessage {
  return (
    isRecord(value) &&
    value.type === 'hud:game_event' &&
    typeof value.event === 'string' &&
    'payload' in value
  );
}

/** Runtime guard for any message currently accepted from the game SPA. */
export function isSPAToHUDMessage(value: unknown): value is SPAToHUDMessage {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  switch (value.type) {
    case 'hud:init':
      return isHUDInitMessage(value);
    case 'hud:attribute_update':
      return isHUDAttributeUpdateMessage(value);
    case 'hud:game_event':
      return isHUDGameEventMessage(value);
    default:
      return false;
  }
}
