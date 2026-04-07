/**
 * GestaltHUDBridge — postMessage bridge for Workshop HUDs.
 *
 * This bridge runs inside a sandboxed iframe (`sandbox="allow-scripts"`)
 * and communicates with the game's main SPA via `window.postMessage`.
 *
 * It is the Workshop counterpart of {@link HUDBridge} (WebSocket).
 * The two bridges expose similar callback signatures so that HUD
 * developers can switch between dev mode (WebSocket) and publish mode
 * (postMessage) with minimal code changes.
 */

import {
  WORKSHOP_HUD_PROTOCOL_VERSION,
  type HUDInitMessage,
  type HUDAttributeUpdateMessage,
  type HUDAttributeData,
  type HUDEventMessage,
  type HUDReadyMessage,
  type HUDActionMessage,
  type HUDAction,
} from '../protocol/workshop-types';

const VALID_ACTIONS: ReadonlySet<string> = new Set<HUDAction>([
  'open_settings',
  'exit_game',
  'resume_game',
  'exit_menu',
]);

const TAG = '[Workshop HUD]';

export interface GestaltHUDBridgeOptions {
  /**
   * The `targetOrigin` parameter for `postMessage()`.
   * Defaults to `'*'` because Workshop HUDs run inside a
   * sandboxed iframe without `allow-same-origin`.
   */
  targetOrigin?: string;

  /**
   * Enable debug mode for detailed diagnostic logging.
   *
   * Activation priority:
   *   1. Explicit `debug` option (this field)
   *   2. URL parameter `?gestalt-debug=1` (auto-detected)
   *
   * In debug mode the bridge logs every received message, caches the
   * latest attribute snapshot in {@link GestaltHUDBridge.lastSnapshot},
   * tracks message frequency, and warns when callbacks exceed 16 ms.
   *
   * When using `workshopHUDDevUrl` in debug.config.json, append
   * `?gestalt-debug=1` to the URL to enable debug without code changes.
   */
  debug?: boolean;
}

type InitHandler = (msg: HUDInitMessage) => void;
type AttributeUpdateHandler = (data: HUDAttributeData) => void;
type GameEventHandler = (event: string, payload: unknown) => void;

function detectDebugFromURL(): boolean {
  try {
    return new URLSearchParams(location.search).has('gestalt-debug');
  } catch {
    return false;
  }
}

function scopeSummary(
  scope: string,
  data: Record<string, unknown> | undefined,
): string {
  if (!data) return `${scope}(-)`;
  const keys = Object.keys(data);
  return `${scope}(${keys.length})`;
}

export class GestaltHUDBridge {
  private targetOrigin: string;
  private destroyed = false;
  private readonly debugEnabled: boolean;

  private initHandlers: InitHandler[] = [];
  private attributeUpdateHandlers: AttributeUpdateHandler[] = [];
  private gameEventHandlers: GameEventHandler[] = [];

  private readonly boundListener: (event: MessageEvent) => void;

  // ── Debug state ──

  /**
   * The most recent attribute data snapshot (only populated in debug mode).
   * Inspect via browser console: `bridge.lastSnapshot`.
   */
  lastSnapshot: HUDAttributeData | null = null;

  private msgCount = 0;
  private firstUpdateLogged = false;
  private lastMsgTime = 0;

  constructor(options?: GestaltHUDBridgeOptions) {
    this.targetOrigin = options?.targetOrigin ?? '*';
    this.debugEnabled =
      options?.debug !== undefined ? options.debug : detectDebugFromURL();
    this.boundListener = this.handleMessage.bind(this);
    window.addEventListener('message', this.boundListener);

    if (this.debugEnabled) {
      this.debugLog('Debug mode ON');
    }
  }

  /**
   * Log a message to console AND send it to the parent window via
   * postMessage so the game's Debug Panel can display it.
   */
  private debugLog(message: string): void {
    console.log(`${TAG} ${message}`);
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          { type: 'hud:debug_log', message: `${TAG} ${message}` },
          this.targetOrigin,
        );
      }
    } catch {
      // Silently ignore if postMessage fails
    }
  }

  private debugWarn(message: string): void {
    console.warn(`${TAG} ${message}`);
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          { type: 'hud:debug_log', message: `[WARN] ${TAG} ${message}` },
          this.targetOrigin,
        );
      }
    } catch {
      // Silently ignore
    }
  }

  // ── Lifecycle ──

  /**
   * Register a handler for the `hud:init` message.
   * The game SPA sends this once after the iframe loads.
   * Returns an unsubscribe function.
   */
  onInit(handler: InitHandler): () => void {
    this.initHandlers.push(handler);
    return () => {
      this.initHandlers = this.initHandlers.filter((h) => h !== handler);
    };
  }

  /**
   * Notify the game SPA that this HUD is loaded and ready.
   * Should be called once during initialization, typically after
   * the `hud:init` message is received and the HUD is rendered.
   */
  sendReady(name: string, version: string): void {
    this.postToParent<HUDReadyMessage>({
      type: 'hud:ready',
      name,
      version,
    });
    this.debugLog(`Ready sent: ${name} v${version}`);
  }

  // ── Data reception ──

  /**
   * Register a handler for `hud:attribute_update` messages.
   * Called whenever the game pushes new attribute data.
   * Returns an unsubscribe function.
   */
  onAttributeUpdate(handler: AttributeUpdateHandler): () => void {
    this.attributeUpdateHandlers.push(handler);
    return () => {
      this.attributeUpdateHandlers = this.attributeUpdateHandlers.filter(
        (h) => h !== handler,
      );
    };
  }

  /**
   * Register a handler for `hud:game_event` messages.
   *
   * @reserved Sprint 1 does not send any game events — this interface
   * is defined for forward compatibility. Future protocol versions may
   * introduce discrete events (kill notifications, supply arrivals, etc.).
   *
   * Returns an unsubscribe function.
   */
  onGameEvent(handler: GameEventHandler): () => void {
    this.gameEventHandlers.push(handler);
    return () => {
      this.gameEventHandlers = this.gameEventHandlers.filter(
        (h) => h !== handler,
      );
    };
  }

  // ── Action sending ──

  /**
   * Send a user-initiated action to the game SPA.
   * The action must be one of the allowed values; unknown actions
   * will throw an error.
   *
   * @throws {Error} if `action` is not in the Sprint 1 whitelist.
   */
  sendAction(action: HUDAction, payload?: unknown): void {
    if (!VALID_ACTIONS.has(action)) {
      throw new Error(
        `${TAG} Unknown action "${action}". ` +
          `Allowed actions: ${[...VALID_ACTIONS].join(', ')}`,
      );
    }
    this.postToParent<HUDActionMessage>({
      type: 'hud:action',
      action,
      payload,
    });
  }

  // ── Cleanup ──

  /** Remove the message listener and release all handlers. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    window.removeEventListener('message', this.boundListener);
    this.initHandlers = [];
    this.attributeUpdateHandlers = [];
    this.gameEventHandlers = [];

    if (this.debugEnabled) {
      this.debugLog(`Destroyed (${this.msgCount} messages received)`);
    }
  }

  // ── Internals ──

  private handleMessage(event: MessageEvent): void {
    if (this.destroyed) return;

    const msg = event.data;
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;

    this.msgCount++;
    const now = performance.now();
    if (this.debugEnabled && this.lastMsgTime > 0) {
      const delta = now - this.lastMsgTime;
      if (this.msgCount % 60 === 0) {
        this.debugLog(`Stats: ${this.msgCount} msgs, ~${Math.round(delta)}ms since last`);
      }
    }
    this.lastMsgTime = now;

    switch (msg.type) {
      case 'hud:init':
        this.handleInit(msg as HUDInitMessage);
        break;
      case 'hud:attribute_update':
        this.handleAttributeUpdate(msg as HUDAttributeUpdateMessage);
        break;
      case 'hud:game_event':
        this.handleGameEvent(msg as HUDEventMessage);
        break;
      default:
        if (this.debugEnabled) {
          this.debugLog(`Unknown message type: ${msg.type}`);
        }
    }
  }

  private handleInit(msg: HUDInitMessage): void {
    this.debugLog(
      `Init received (map=${msg.mapName ?? msg.mapId}, ` +
        `team=${msg.teamId}, player=${msg.playerId})`,
    );

    if (msg.version > WORKSHOP_HUD_PROTOCOL_VERSION) {
      this.debugWarn(
        `Game sent protocol version ${msg.version}, ` +
          `but this HUD only supports up to version ${WORKSHOP_HUD_PROTOCOL_VERSION}. ` +
          `Some features may not be available.`,
      );
    }

    if (this.debugEnabled) {
      this.debugLog(`Init payload: ${JSON.stringify(msg).substring(0, 500)}`);
    }

    for (const handler of this.initHandlers) {
      try {
        handler(msg);
      } catch (err) {
        console.error(`${TAG} Error in onInit handler:`, err);
      }
    }
  }

  private handleAttributeUpdate(msg: HUDAttributeUpdateMessage): void {
    const data = msg.data;

    if (this.debugEnabled) {
      this.lastSnapshot = data;

      if (!this.firstUpdateLogged) {
        this.firstUpdateLogged = true;
        const baseMaps = data.base ? Object.keys(data.base).length : 0;
        const pbMaps = data.playerBattle
          ? Object.keys(data.playerBattle).length
          : 0;
        this.debugLog(
          `First attribute_update: ` +
            `${scopeSummary('battle', data.battle)}, ` +
            `${scopeSummary('global', data.global)}, ` +
            `${scopeSummary('player', data.player)}, ` +
            `base(${baseMaps} maps), playerBattle(${pbMaps} players)`,
        );
        // Log some key values for quick diagnosis
        if (data.battle) {
          this.debugLog(
            `Key values: HP=${data.battle['10000003']}/${data.battle['60000004']} ` +
              `Ammo17=${data.battle['10000033']} Team=${data.battle['10000036']} ` +
              `Level=${data.battle['60000003']}`,
          );
        }
      }
    }

    for (const handler of this.attributeUpdateHandlers) {
      try {
        const t0 = this.debugEnabled ? performance.now() : 0;
        handler(data);
        if (this.debugEnabled) {
          const elapsed = performance.now() - t0;
          if (elapsed > 16) {
            this.debugWarn(`Slow onAttributeUpdate callback: ${elapsed.toFixed(1)}ms (>16ms)`);
          }
        }
      } catch (err) {
        console.error(`${TAG} Error in onAttributeUpdate handler:`, err);
      }
    }
  }

  private handleGameEvent(msg: HUDEventMessage): void {
    if (this.debugEnabled) {
      this.debugLog(`Game event: ${msg.event} ${JSON.stringify(msg.payload).substring(0, 200)}`);
    }

    for (const handler of this.gameEventHandlers) {
      try {
        handler(msg.event, msg.payload);
      } catch (err) {
        console.error(`${TAG} Error in onGameEvent handler:`, err);
      }
    }
  }

  private postToParent<T>(message: T): void {
    if (this.destroyed) {
      console.warn(`${TAG} Attempted to send message after destroy()`);
      return;
    }
    if (!window.parent || window.parent === window) {
      console.warn(`${TAG} Not running inside an iframe — postMessage skipped`);
      return;
    }
    window.parent.postMessage(message, this.targetOrigin);
  }
}
