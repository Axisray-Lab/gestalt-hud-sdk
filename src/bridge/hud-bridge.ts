/**
 * Trusted WebSocket JSON-RPC client for Gestalt System.
 *
 * @experimental
 * This API connects to the game's privileged internal WebSocket interface. It
 * is intended for local tools and trusted development environments, not for
 * Steam Workshop iframe code. Workshop HUDs must use `GestaltHUDBridge`.
 */

import {
  JSONRPCType,
  type JSONRPCRequest,
  type JSONRPCResponse,
} from '../protocol/types';

export const TRUSTED_WEBSOCKET_API_NOTICE =
  'Experimental trusted API: do not use from Steam Workshop HUD content.';

export const TrustedWebSocketMethod = {
  watchAttributeMaps: 'attribute.watchAttributeMaps',
  heartbeat: 'heartbeat.ping',
  /** Best-effort re-emission of the one-shot global-vars bootstrap event. */
  requestGlobalVarsSetup: 'gameGlobalVars.requestSetup',
} as const;

export const TrustedWebSocketEvent = {
  gameGlobalVarsFinishSetup: 'gameGlobalVars.finishSetup',
  watchAttributeMapsResult: 'watchAttributeMaps.result',
} as const;

export interface HUDBridgeOptions {
  /** WebSocket host (default: `127.0.0.1`). */
  host?: string;
  /** Dynamically discovered game WebSocket port. */
  port: number | string;
  /** `ws:` or `wss:` (default: `ws:`). */
  protocol?: 'ws:' | 'wss:';
  /** Maximum reconnect attempts (default: 10). */
  maxReconnectAttempts?: number;
  /** Delay between reconnect attempts in milliseconds (default: 3000). */
  reconnectDelay?: number;
  /** Heartbeat interval in milliseconds (default: 1000; 0 disables it). */
  heartbeatInterval?: number;
  /** JSON-RPC request timeout in milliseconds (default: 10000; 0 disables it). */
  requestTimeout?: number;
}

export type RequestHandler = (params?: unknown) => Promise<unknown> | unknown;
export type ConnectionListener = (connected: boolean) => void;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  timer: ReturnType<typeof setTimeout> | null;
  method: string;
}

/**
 * Privileged WebSocket bridge for trusted tooling.
 *
 * @experimental This is not part of the Workshop sandbox contract.
 */
export class HUDBridge {
  private ws: WebSocket | null = null;
  private connectPromise: Promise<void> | null = null;
  private _connected = false;
  private requestIdCounter = 0;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private manualDisconnect = false;
  private readonly options: Required<HUDBridgeOptions>;
  private wsUrl = '';

  private readonly pendingRequests = new Map<number, PendingRequest>();
  private readonly serverRequestHandlers = new Map<string, RequestHandler>();
  private readonly connectionListeners = new Set<ConnectionListener>();

  constructor(options: HUDBridgeOptions) {
    this.options = {
      host: options.host ?? '127.0.0.1',
      port: options.port,
      protocol: options.protocol ?? 'ws:',
      maxReconnectAttempts: options.maxReconnectAttempts ?? 10,
      reconnectDelay: options.reconnectDelay ?? 3000,
      heartbeatInterval: options.heartbeatInterval ?? 1000,
      requestTimeout: options.requestTimeout ?? 10000,
    };
  }

  get connected(): boolean {
    return this._connected;
  }

  /** Open a WebSocket connection to the trusted game interface. */
  connect(): Promise<void> {
    this.manualDisconnect = false;
    const { protocol, host, port } = this.options;
    this.wsUrl = `${protocol}//${host}:${port}`;

    if (this.ws?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.connectPromise) return this.connectPromise;

    const connection = new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);
      this.ws = ws;
      let settled = false;

      const rejectConnect = (error: Error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      ws.onopen = () => {
        if (this.ws !== ws) {
          ws.close();
          rejectConnect(new Error('WebSocket connection was superseded'));
          return;
        }
        settled = true;
        this.setConnected(true);
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        resolve();
      };

      ws.onerror = () => {
        rejectConnect(new Error(`WebSocket connection error: ${this.wsUrl}`));
      };

      ws.onclose = () => {
        if (this.ws === ws) this.ws = null;
        this.setConnected(false);
        this.stopHeartbeat();
        this.rejectPending(new Error('WebSocket disconnected'));
        rejectConnect(new Error(`WebSocket closed before connecting: ${this.wsUrl}`));

        if (
          !this.manualDisconnect &&
          this.reconnectAttempts < this.options.maxReconnectAttempts
        ) {
          this.scheduleReconnect();
        }
      };

      ws.onmessage = (event) => {
        try {
          const parsed: unknown = JSON.parse(String(event.data));
          if (isJSONRPCMessage(parsed)) void this.handleMessage(parsed);
        } catch {
          // Ignore malformed/unrelated frames from the internal endpoint.
        }
      };
    });

    this.connectPromise = connection;
    void connection.then(
      () => {
        if (this.connectPromise === connection) this.connectPromise = null;
      },
      () => {
        if (this.connectPromise === connection) this.connectPromise = null;
      },
    );
    return connection;
  }

  /** Close the socket and reject all outstanding requests. */
  disconnect(): void {
    this.manualDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();

    const ws = this.ws;
    this.ws = null;
    this.setConnected(false);
    this.rejectPending(new Error('WebSocket disconnected by client'));
    if (ws && ws.readyState !== WebSocket.CLOSED) ws.close();
    this.reconnectAttempts = 0;
  }

  /** Send a JSON-RPC request and resolve with its `result` field. */
  send<T = unknown>(method: string, params?: unknown): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const ws = this.ws;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket is not connected'));
        return;
      }

      const id = ++this.requestIdCounter;
      const message: JSONRPCRequest = {
        type: JSONRPCType.Request,
        id,
        method,
        params,
      };
      const timeout = this.options.requestTimeout;
      const pending: PendingRequest = {
        resolve: (value) => resolve(value as T),
        reject,
        method,
        timer: null,
      };
      if (timeout > 0) {
        pending.timer = setTimeout(() => {
          if (!this.pendingRequests.delete(id)) return;
          reject(
            new Error(`JSON-RPC request timed out after ${timeout}ms: ${method}`),
          );
        }, timeout);
      }
      this.pendingRequests.set(id, pending);

      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        this.pendingRequests.delete(id);
        if (pending.timer) clearTimeout(pending.timer);
        reject(error);
      }
    });
  }

  /** Register a handler for JSON-RPC requests pushed by the game. */
  onRequest(method: string, handler: RequestHandler): () => void {
    this.serverRequestHandlers.set(method, handler);
    return () => {
      if (this.serverRequestHandlers.get(method) === handler) {
        this.serverRequestHandlers.delete(method);
      }
    };
  }

  onConnectionChange(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener);
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  private setConnected(value: boolean): void {
    if (this._connected === value) return;
    this._connected = value;
    for (const listener of this.connectionListeners) {
      try {
        listener(value);
      } catch {
        // Listener failures do not alter transport state.
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect().catch(() => undefined);
    }, this.options.reconnectDelay);
  }

  private async handleMessage(
    message: JSONRPCRequest | JSONRPCResponse,
  ): Promise<void> {
    if (
      message.type === JSONRPCType.Request &&
      'method' in message &&
      message.id != null
    ) {
      const handler = this.serverRequestHandlers.get(message.method);
      if (!handler) {
        this.sendErrorResponse(
          message.id,
          -32601,
          `Method not found: ${message.method}`,
        );
        return;
      }
      try {
        const result = await handler(message.params);
        this.sendResponse(message.id, result);
      } catch (error) {
        this.sendErrorResponse(
          message.id,
          -32603,
          error instanceof Error ? error.message : String(error),
        );
      }
      return;
    }

    if (message.type === JSONRPCType.Response && message.id != null) {
      const pending = this.pendingRequests.get(message.id);
      if (!pending) return;
      this.pendingRequests.delete(message.id);
      if (pending.timer) clearTimeout(pending.timer);
      if (message.error) {
        pending.reject(new Error(message.error.message));
      } else {
        pending.resolve(message.result);
      }
    }
  }

  private sendResponse(id: number, result: unknown): void {
    this.sendFrame({ type: JSONRPCType.Response, id, result });
  }

  private sendErrorResponse(id: number, code: number, message: string): void {
    this.sendFrame({ type: JSONRPCType.Response, id, error: { code, message } });
  }

  private sendFrame(message: JSONRPCRequest | JSONRPCResponse): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify(message));
    } catch {
      // The close handler will transition state and reject pending requests.
    }
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pendingRequests.values()) {
      if (pending.timer) clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    if (this.options.heartbeatInterval <= 0) return;
    this.heartbeatTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.stopHeartbeat();
        return;
      }
      this.sendFrame({
        type: JSONRPCType.Request,
        id: ++this.requestIdCounter,
        method: TrustedWebSocketMethod.heartbeat,
        params: { timestamp: Date.now() },
      });
    }, this.options.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

function isJSONRPCMessage(
  value: unknown,
): value is JSONRPCRequest | JSONRPCResponse {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const message = value as Record<string, unknown>;
  if (
    (message.type !== JSONRPCType.Request &&
      message.type !== JSONRPCType.Response) ||
    typeof message.id !== 'number'
  ) {
    return false;
  }
  if (message.type === JSONRPCType.Request) {
    return typeof message.method === 'string';
  }
  return true;
}
