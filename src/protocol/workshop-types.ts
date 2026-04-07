/**
 * Workshop HUD postMessage protocol types.
 *
 * These interfaces define the messages exchanged between the game's main SPA
 * (parent window) and a Workshop HUD running inside a sandboxed iframe.
 *
 * Protocol contract:
 *   - The 5 message type strings are frozen and will never change.
 *   - Existing fields will never be removed or renamed.
 *   - New fields may be added in future versions (forward-compatible).
 *   - The bridge implementation should ignore unknown fields.
 */

// ── Main SPA -> Workshop HUD iframe ──

export interface HUDInitMessage {
  type: 'hud:init';
  /** Protocol version number (starts at 1). */
  version: number;
  /** Map ID from ERobotBridgeDemoMapType. */
  mapId: number;
  /** Human-readable map name. */
  mapName: string;
  /** Local player's numeric ID within the match. */
  playerId: number;
  /** Player's team ID. */
  teamId: number;
  /** Game mode identifier, e.g. "3v3", "1v1", "training". */
  gameMode: string;
  /** WebSocket port (reserved; not exposed to iframe in sandbox mode). */
  wsPort: number;
}

export interface HUDAttributeUpdateMessage {
  type: 'hud:attribute_update';
  /** Map ID the update originates from. */
  mapId: number;
  /**
   * Attribute data grouped by scope.
   *
   * Keys within each record are stringified FBS attribute enum IDs
   * (e.g. "10000003" for Health). Values are raw numbers matching the
   * FBS definitions — "thousandths" attributes use 1000 = 100%,
   * tag attributes use 0/1.
   */
  data: HUDAttributeData;
}

export interface HUDAttributeData {
  global: Record<string, number>;
  player: Record<string, number>;
  battle: Record<string, number>;
  base: Record<string, Record<string, number>>;
  playerBattle: Record<number, Record<string, number>>;
}

/**
 * @reserved This message type is defined for forward compatibility.
 * Sprint 1 does not send this message. Future versions may introduce
 * discrete game events (e.g. kill notifications, supply arrival).
 */
export interface HUDEventMessage {
  type: 'hud:game_event';
  /** Event identifier (TBD in future protocol versions). */
  event: string;
  /** Event-specific payload (TBD in future protocol versions). */
  payload: unknown;
}

// ── Workshop HUD iframe -> Main SPA ──

export interface HUDReadyMessage {
  type: 'hud:ready';
  /** HUD display name (from manifest.json). */
  name: string;
  /** HUD version string (from manifest.json). */
  version: string;
}

export interface HUDActionMessage {
  type: 'hud:action';
  /** Action identifier — must be one of the allowed {@link HUDAction} values. */
  action: HUDAction;
  /** Optional action payload (currently unused; reserved for future actions). */
  payload?: unknown;
}

/**
 * Allowed action identifiers for Sprint 1.
 * New actions will be added through protocol version extensions.
 */
export type HUDAction =
  | 'open_settings'
  | 'exit_game'
  | 'resume_game'
  | 'exit_menu';

/** Union of all messages the main SPA sends to a Workshop HUD iframe. */
export type ParentToHUDMessage =
  | HUDInitMessage
  | HUDAttributeUpdateMessage
  | HUDEventMessage;

/** Union of all messages a Workshop HUD iframe sends to the main SPA. */
export type HUDToParentMessage =
  | HUDReadyMessage
  | HUDActionMessage;

/** Union of all Workshop HUD postMessage protocol messages. */
export type WorkshopHUDMessage =
  | ParentToHUDMessage
  | HUDToParentMessage;

/** Current protocol version. */
export const WORKSHOP_HUD_PROTOCOL_VERSION = 1;
