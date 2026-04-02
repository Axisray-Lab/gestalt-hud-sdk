/**
 * HUD Bridge — WebSocket JSON-RPC client for Gestalt System.
 *
 * This is the primary entry-point for custom HUD authors.  It handles:
 *   1. Connecting to the game's WebSocket server
 *   2. JSON-RPC request/response framing
 *   3. Heartbeat keep-alive
 *   4. Auto-reconnect with back-off
 *
 * The bridge intentionally has ZERO framework dependencies so it can be
 * used with Vue, React, Svelte, vanilla JS, or anything else.
 */

import {
  JSONRPCType,
  type JSONRPCRequest,
  type JSONRPCResponse,
} from '../protocol/types';

// ── Public types ──

export interface HUDBridgeOptions {
  /** WebSocket host (default: current page hostname, or `127.0.0.1`) */
  host?: string;
  /** WebSocket port (required in standalone dev mode) */
  port: number | string;
  /** `ws:` or `wss:` (default: `ws:`) */
  protocol?: 'ws:' | 'wss:';
  /** Maximum reconnect attempts (default: 10) */
  maxReconnectAttempts?: number;
  /** Delay between reconnect attempts in ms (default: 3000) */
  reconnectDelay?: number;
  /** Heartbeat interval in ms (default: 1000). Set 0 to disable. */
  heartbeatInterval?: number;
}

export type RequestHandler = (params?: unknown) => Promise<unknown> | unknown;
export type ConnectionListener = (connected: boolean) => void;

// ── Implementation ──

export class HUDBridge {
  private ws: WebSocket | null = null;
  private _connected = false;
  private requestIdCounter = 0;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private manualDisconnect = false;
  private options: Required<HUDBridgeOptions>;
  private wsUrl = '';

  private readonly pendingRequests = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: unknown) => void }
  >();
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
    };
  }

  /** Whether the WebSocket is currently open. */
  get connected(): boolean {
    return this._connected;
  }

  // ── Connection lifecycle ──

  /** Open a WebSocket connection to the game server. */
  async connect(): Promise<void> {
    this.manualDisconnect = false;
    const { protocol, host, port } = this.options;
    this.wsUrl = `${protocol}//${host}:${port}`;

    if (this.ws?.readyState === WebSocket.OPEN) return;

    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);

      ws.onopen = () => {
        this.ws = ws;
        this.setConnected(true);
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        resolve();
      };

      ws.onerror = () => {
        reject(new Error(`WebSocket connection error: ${this.wsUrl}`));
      };

      ws.onclose = () => {
        this.ws = null;
        this.setConnected(false);
        this.stopHeartbeat();

        if (
          !this.manualDisconnect &&
          this.reconnectAttempts < this.options.maxReconnectAttempts
        ) {
          this.scheduleReconnect();
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch {
          // ignore malformed messages
        }
      };
    });
  }

  /** Gracefully close the connection. */
  disconnect(): void {
    this.manualDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setConnected(false);
    this.pendingRequests.clear();
    this.reconnectAttempts = 0;
  }

  // ── Sending requests ──

  /**
   * Send a JSON-RPC request and wait for the server's response.
   * @returns the `result` field of the response
   */
  send<T = unknown>(method: string, params?: unknown): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket is not connected'));
        return;
      }
      const id = ++this.requestIdCounter;
      const msg: JSONRPCRequest = {
        type: JSONRPCType.Request,
        id,
        method,
        params,
      };
      this.pendingRequests.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
      });
      try {
        this.ws.send(JSON.stringify(msg));
      } catch (err) {
        this.pendingRequests.delete(id);
        reject(err);
      }
    });
  }

  // ── Registering server-push handlers ──

  /**
   * Register a handler for requests that the *server* sends to the HUD.
   * Returns an unsubscribe function.
   */
  onRequest(method: string, handler: RequestHandler): () => void {
    this.serverRequestHandlers.set(method, handler);
    return () => {
      this.serverRequestHandlers.delete(method);
    };
  }

  /**
   * Listen for connection state changes.
   * Returns an unsubscribe function.
   */
  onConnectionChange(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener);
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  // ── Internals ──

  private setConnected(value: boolean): void {
    if (this._connected === value) return;
    this._connected = value;
    for (const listener of this.connectionListeners) {
      try {
        listener(value);
      } catch {
        // listener errors must not break the bridge
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {});
    }, this.options.reconnectDelay);
  }

  private async handleMessage(
    msg: JSONRPCRequest | JSONRPCResponse,
  ): Promise<void> {
    if (msg.type === JSONRPCType.Request && 'method' in msg && msg.id != null) {
      const handler = this.serverRequestHandlers.get(msg.method);
      if (handler) {
        try {
          const result = await handler((msg as JSONRPCRequest).params);
          this.sendResponse(msg.id, result);
        } catch (err) {
          this.sendErrorResponse(
            msg.id,
            -32603,
            err instanceof Error ? err.message : String(err),
          );
        }
      } else {
        this.sendErrorResponse(
          msg.id,
          -32601,
          `Method not found: ${msg.method}`,
        );
      }
      return;
    }

    if (msg.type === JSONRPCType.Response && msg.id != null) {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        this.pendingRequests.delete(msg.id);
        const resp = msg as JSONRPCResponse;
        if (resp.error) {
          pending.reject(new Error(resp.error.message));
        } else {
          pending.resolve(resp.result);
        }
      }
    }
  }

  private sendResponse(id: number, result: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const response: JSONRPCResponse = {
      type: JSONRPCType.Response,
      id,
      result,
    };
    this.ws.send(JSON.stringify(response));
  }

  private sendErrorResponse(
    id: number,
    code: number,
    message: string,
  ): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const response: JSONRPCResponse = {
      type: JSONRPCType.Response,
      id,
      error: { code, message },
    };
    this.ws.send(JSON.stringify(response));
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    if (this.options.heartbeatInterval <= 0) return;
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        const msg: JSONRPCRequest = {
          type: JSONRPCType.Request,
          id: ++this.requestIdCounter,
          method: 'echo.heartbeat',
          params: { timestamp: Date.now() },
        };
        try {
          this.ws.send(JSON.stringify(msg));
        } catch {
          // non-critical
        }
      }
    }, this.options.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer != null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
