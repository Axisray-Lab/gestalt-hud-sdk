/**
 * GestaltHUDBridge — postMessage bridge for Workshop HUDs.
 *
 * This bridge runs inside a sandboxed iframe
 * (`sandbox="allow-scripts allow-same-origin"`) and communicates with
 * the game's main SPA via `window.postMessage`.
 *
 * This is the supported bridge for both Workshop development and published
 * HUDs. The package's direct WebSocket client is a separate privileged,
 * experimental API and must not be bundled into Workshop content.
 */

import {
  WORKSHOP_HUD_PROTOCOL_VERSION,
  type HUDInitMessage,
  type HUDAttributeUpdateMessage,
  type HUDAttributeData,
  type HUDGameEventMessage,
  type HUDReadyMessage,
  type HUDActionMessage,
  type HUDDebugLogMessage,
  type HUDAction,
  WORKSHOP_HUD_ACTION_WHITELIST,
  isSPAToHUDMessage,
} from '../protocol/workshop-types';

const TAG = '[Workshop HUD]';

export interface GestaltHUDBridgeOptions {
  /**
   * The `targetOrigin` parameter for `postMessage()`.
   * By default this is derived from `document.referrer`. If the embedding
   * origin cannot be determined, the bridge falls back to `'*'` while still
   * requiring messages to come from this iframe's `window.parent`.
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

function inferParentOrigin(): string {
  try {
    if (document.referrer) {
      const origin = new URL(document.referrer).origin;
      if (origin && origin !== 'null') return origin;
    }
  } catch {
    // Sandboxed/dev contexts may not expose a usable referrer.
  }
  return '*';
}

function normalizeTargetOrigin(origin: string): string {
  if (origin === '*') return origin;
  try {
    const parsed = new URL(origin);
    if (parsed.origin === 'null') throw new Error('opaque origin');
    return parsed.origin;
  } catch {
    throw new TypeError(
      `${TAG} targetOrigin must be "*" or an absolute http(s) origin`,
    );
  }
}

type InitHandler = (msg: HUDInitMessage) => void;

/** Timing and ordering metadata associated with an accepted HUD snapshot. */
export interface HUDAttributeUpdateMetadata {
  /** Host-provided sequence, when supported by the embedding game build. */
  readonly sequence?: number;
  /** Host send timestamp in Unix-epoch milliseconds, when provided. */
  readonly sentAtMs?: number;
  /** SDK receive timestamp in Unix-epoch milliseconds. */
  readonly receivedAtMs: number;
  /** Non-negative receive-minus-send latency, when `sentAtMs` was provided. */
  readonly transportLatencyMs?: number;
}

/** Read-only snapshot of Workshop attribute transport diagnostics. */
export interface GestaltHUDBridgeDiagnostics {
  /** Valid attribute messages observed, including sequence-filtered frames. */
  readonly received: number;
  /** Attribute messages delivered to registered callbacks. */
  readonly accepted: number;
  /** Duplicate or backward sequenced messages discarded by the bridge. */
  readonly dropped: number;
  /** Most recent accepted host sequence, or `null` for a legacy-only stream. */
  readonly lastSequence: number | null;
  /** Send timestamp of the most recently accepted snapshot, when provided. */
  readonly lastSentAtMs: number | null;
  /** Receive timestamp of the most recently accepted snapshot. */
  readonly lastReceivedAtMs: number | null;
  /** Transport latency of the most recently accepted timestamped snapshot. */
  readonly lastTransportLatencyMs: number | null;
}

export type AttributeUpdateHandler = (
  data: HUDAttributeData,
  metadata: HUDAttributeUpdateMetadata,
) => void;
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

function epochNowMs(): number {
  if (typeof performance !== 'undefined') {
    const now = performance.now();
    const timeOrigin = performance.timeOrigin;
    if (Number.isFinite(now) && Number.isFinite(timeOrigin)) {
      return timeOrigin + now;
    }
  }
  return Date.now();
}

export class GestaltHUDBridge {
  private targetOrigin: string;
  private readonly parentWindow: Window;
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
  private receivedAttributeUpdates = 0;
  private acceptedAttributeUpdates = 0;
  private droppedAttributeUpdates = 0;
  private lastAcceptedSequence: number | null = null;
  private lastAcceptedSentAtMs: number | null = null;
  private lastAcceptedReceivedAtMs: number | null = null;
  private lastAcceptedTransportLatencyMs: number | null = null;

  constructor(options?: GestaltHUDBridgeOptions) {
    this.targetOrigin = normalizeTargetOrigin(
      options?.targetOrigin ?? inferParentOrigin(),
    );
    this.parentWindow = window.parent;
    this.debugEnabled =
      options?.debug !== undefined ? options.debug : detectDebugFromURL();
    this.boundListener = this.handleMessage.bind(this);
    window.addEventListener('message', this.boundListener);

    if (this.debugEnabled) {
      this.debugLog('Debug mode ON');
    }
  }

  /**
   * Current read-only attribute transport counters and timing values.
   * A fresh frozen snapshot is returned on every access.
   */
  get diagnostics(): GestaltHUDBridgeDiagnostics {
    return Object.freeze({
      received: this.receivedAttributeUpdates,
      accepted: this.acceptedAttributeUpdates,
      dropped: this.droppedAttributeUpdates,
      lastSequence: this.lastAcceptedSequence,
      lastSentAtMs: this.lastAcceptedSentAtMs,
      lastReceivedAtMs: this.lastAcceptedReceivedAtMs,
      lastTransportLatencyMs: this.lastAcceptedTransportLatencyMs,
    });
  }

  /**
   * Log a message to console AND send it to the parent window via
   * postMessage so the game's Debug Panel can display it.
   */
  private debugLog(message: string): void {
    console.log(`${TAG} ${message}`);
    try {
      if (window.parent && window.parent !== window) {
        const debugMessage: HUDDebugLogMessage = {
          type: 'hud:debug_log',
          message: `${TAG} ${message}`,
        };
        this.parentWindow.postMessage(
          debugMessage,
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
        const debugMessage: HUDDebugLogMessage = {
          type: 'hud:debug_log',
          message: `[WARN] ${TAG} ${message}`,
        };
        this.parentWindow.postMessage(
          debugMessage,
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
   * Called whenever the game pushes new attribute data. The optional host
   * ordering/timing fields are exposed through the second callback argument.
   * One-argument callbacks remain fully supported.
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
    if (!WORKSHOP_HUD_ACTION_WHITELIST.has(action)) {
      throw new Error(
        `${TAG} Unknown action "${action}". ` +
          `Allowed actions: ${[...WORKSHOP_HUD_ACTION_WHITELIST].join(', ')}`,
      );
    }
    this.postToParent<HUDActionMessage>({
      type: 'hud:action',
      action,
      payload,
    });
  }

  /**
   * Send a bounded diagnostic line to the game host.
   *
   * Do not include secrets, account identifiers, or complete attribute
   * snapshots. The host may persist this text in its local log.
   */
  sendDebugLog(message: string): void {
    this.debugLog(message);
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

    // `event.origin` alone is not enough when the legacy host sends to `*`.
    // The WindowProxy identity is stable across the cross-origin iframe boundary
    // and rejects messages from sibling frames or unrelated windows.
    if (event.source !== this.parentWindow) {
      if (this.debugEnabled) {
        console.warn(`${TAG} Ignored message not sent by window.parent`);
      }
      return;
    }
    if (this.targetOrigin !== '*' && event.origin !== this.targetOrigin) {
      if (this.debugEnabled) {
        console.warn(
          `${TAG} Ignored message from unexpected origin "${event.origin}"`,
        );
      }
      return;
    }

    const msg = event.data;
    if (!isSPAToHUDMessage(msg)) {
      if (
        this.debugEnabled &&
        msg &&
        typeof msg === 'object' &&
        'type' in msg &&
        typeof msg.type === 'string' &&
        msg.type.startsWith('hud:')
      ) {
        console.warn(`${TAG} Ignored malformed message: ${msg.type}`);
      }
      return;
    }

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
        this.handleInit(msg);
        break;
      case 'hud:attribute_update':
        this.handleAttributeUpdate(msg);
        break;
      case 'hud:game_event':
        this.handleGameEvent(msg);
        break;
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
    const receivedAtMs = epochNowMs();
    this.receivedAttributeUpdates++;

    if (
      msg.sequence !== undefined &&
      this.lastAcceptedSequence !== null &&
      msg.sequence <= this.lastAcceptedSequence
    ) {
      this.droppedAttributeUpdates++;
      if (
        this.debugEnabled &&
        (this.droppedAttributeUpdates <= 3 ||
          this.droppedAttributeUpdates % 60 === 0)
      ) {
        this.debugWarn(
          `Dropped stale attribute_update sequence ${msg.sequence} ` +
            `(last=${this.lastAcceptedSequence})`,
        );
      }
      return;
    }

    const transportLatencyMs =
      msg.sentAtMs === undefined
        ? undefined
        : Math.max(0, receivedAtMs - msg.sentAtMs);
    const metadata: HUDAttributeUpdateMetadata = Object.freeze({
      sequence: msg.sequence,
      sentAtMs: msg.sentAtMs,
      receivedAtMs,
      transportLatencyMs,
    });

    this.acceptedAttributeUpdates++;
    if (msg.sequence !== undefined) {
      this.lastAcceptedSequence = msg.sequence;
    }
    this.lastAcceptedSentAtMs = msg.sentAtMs ?? null;
    this.lastAcceptedReceivedAtMs = receivedAtMs;
    this.lastAcceptedTransportLatencyMs = transportLatencyMs ?? null;

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
        handler(data, metadata);
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

  private handleGameEvent(msg: HUDGameEventMessage): void {
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
    if (!this.parentWindow || this.parentWindow === window) {
      console.warn(`${TAG} Not running inside an iframe — postMessage skipped`);
      return;
    }
    this.parentWindow.postMessage(message, this.targetOrigin);
  }
}
