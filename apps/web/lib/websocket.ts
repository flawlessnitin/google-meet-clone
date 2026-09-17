import { DEFAULT_WS_URL, type SocketMessage } from "@meet/shared";

export type ConnectionState = "connected" | "disconnected" | "reconnecting";

type GenericHandler = (message: SocketMessage) => void;
type StateHandler = (state: ConnectionState) => void;

export interface WebSocketClientOptions {
  url?: string;
  reconnectDelays?: number[];
  maxReconnectAttempts?: number;
}

export const DEFAULT_RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000];
export const DEFAULT_MAX_RECONNECT_ATTEMPTS = 5;

export class WebSocketClient {
  private socket: WebSocket | null = null;
  private url: string;
  private reconnectDelays: number[];
  private maxReconnectAttempts: number;

  private _state: ConnectionState = "disconnected";
  private _reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isExplicitDisconnect = false;

  private messageListeners: Set<GenericHandler> = new Set();
  private openListeners: Set<() => void> = new Set();
  private closeListeners: Set<() => void> = new Set();
  private stateListeners: Set<StateHandler> = new Set();

  constructor(optionsOrUrl?: string | WebSocketClientOptions) {
    if (typeof optionsOrUrl === "string") {
      this.url = optionsOrUrl;
      this.reconnectDelays = DEFAULT_RECONNECT_DELAYS;
      this.maxReconnectAttempts = DEFAULT_MAX_RECONNECT_ATTEMPTS;
    } else {
      this.url =
        optionsOrUrl?.url || process.env.NEXT_PUBLIC_WS_URL || DEFAULT_WS_URL;
      this.reconnectDelays =
        optionsOrUrl?.reconnectDelays || DEFAULT_RECONNECT_DELAYS;
      this.maxReconnectAttempts =
        optionsOrUrl?.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS;
    }
  }

  /**
   * Current connection state: connected | disconnected | reconnecting.
   */
  public get state(): ConnectionState {
    return this._state;
  }

  /**
   * Number of reconnection attempts made so far in current backoff cycle.
   */
  public get reconnectAttempts(): number {
    return this._reconnectAttempts;
  }

  /**
   * Checks if socket is currently open and connected.
   */
  public get isConnected(): boolean {
    return (
      this._state === "connected" &&
      this.socket !== null &&
      this.socket.readyState === WebSocket.OPEN
    );
  }

  /**
   * Checks if client is currently in reconnecting state.
   */
  public get isReconnecting(): boolean {
    return this._state === "reconnecting";
  }

  /**
   * Returns current readyState of the WebSocket.
   */
  public get readyState(): number {
    return this.socket ? this.socket.readyState : WebSocket.CLOSED;
  }

  private setState(newState: ConnectionState): void {
    if (this._state !== newState) {
      this._state = newState;
      this.stateListeners.forEach((listener) => listener(newState));
    }
  }

  /**
   * Establishes a WebSocket connection to the server.
   */
  public connect(url?: string): void {
    if (url) {
      this.url = url;
    }

    this.isExplicitDisconnect = false;
    this.clearReconnectTimer();

    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    try {
      this.socket = new WebSocket(this.url);
    } catch (err) {
      console.error("Failed to construct WebSocket:", err);
      this.handleConnectionDrop();
      return;
    }

    this.socket.onopen = () => {
      this.clearReconnectTimer();
      this._reconnectAttempts = 0;
      this.setState("connected");
      this.openListeners.forEach((listener) => listener());
    };

    this.socket.onmessage = (event: MessageEvent) => {
      try {
        const text =
          typeof event.data === "string" ? event.data : event.data.toString();
        const parsed: unknown = JSON.parse(text);

        if (
          parsed &&
          typeof parsed === "object" &&
          "type" in parsed &&
          typeof (parsed as { type: unknown }).type === "string"
        ) {
          const message = parsed as SocketMessage;
          this.messageListeners.forEach((listener) => listener(message));
        }
      } catch (err) {
        console.error("Failed to parse incoming WebSocket message:", err);
      }
    };

    this.socket.onclose = (event: CloseEvent) => {
      this.closeListeners.forEach((listener) => listener());
      // Clean, intentional close by server or explicit disconnect does not trigger reconnect
      if (!this.isExplicitDisconnect && event.code !== 1000) {
        this.handleConnectionDrop();
      } else {
        this.setState("disconnected");
      }
    };

    this.socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }

  private handleConnectionDrop(): void {
    if (this._reconnectAttempts < this.maxReconnectAttempts) {
      this.setState("reconnecting");
      const delayIndex = Math.min(
        this._reconnectAttempts,
        this.reconnectDelays.length - 1
      );
      const delay = this.reconnectDelays[delayIndex] ?? 1000;

      this.clearReconnectTimer();
      this._reconnectAttempts++;

      this.reconnectTimer = setTimeout(() => {
        if (!this.isExplicitDisconnect) {
          this.connect();
        }
      }, delay);
    } else {
      // Exceeded max attempts, stop retrying
      this.clearReconnectTimer();
      this._reconnectAttempts = 0;
      this.setState("disconnected");
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Disconnects the active socket connection and cancels any pending reconnect timer.
   */
  public disconnect(): void {
    this.isExplicitDisconnect = true;
    this.clearReconnectTimer();
    this._reconnectAttempts = 0;

    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.close();
      this.socket = null;
    }

    this.setState("disconnected");
  }

  /**
   * Type-safe message serialization and dispatch.
   */
  public send<T extends SocketMessage = SocketMessage>(message: T): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn("Cannot send message, WebSocket is not open.");
      return;
    }

    const payload = JSON.stringify(message);
    this.socket.send(payload);
  }

  /**
   * Registers a typed message handler and returns an unsubscribe cleanup function.
   */
  public onMessage<T extends SocketMessage = SocketMessage>(
    handler: (message: T) => void,
    messageType?: T["type"]
  ): () => void {
    const wrapped: GenericHandler = (message: SocketMessage) => {
      if (!messageType || message.type === messageType) {
        handler(message as T);
      }
    };

    this.messageListeners.add(wrapped);
    return () => {
      this.messageListeners.delete(wrapped);
    };
  }

  /**
   * Registers an onOpen connection listener.
   */
  public onOpen(handler: () => void): () => void {
    this.openListeners.add(handler);
    return () => {
      this.openListeners.delete(handler);
    };
  }

  /**
   * Registers an onClose disconnection listener.
   */
  public onClose(handler: () => void): () => void {
    this.closeListeners.add(handler);
    return () => {
      this.closeListeners.delete(handler);
    };
  }

  /**
   * Registers a connection state listener (connected | disconnected | reconnecting).
   */
  public onStateChange(handler: StateHandler): () => void {
    this.stateListeners.add(handler);
    return () => {
      this.stateListeners.delete(handler);
    };
  }
}

/**
 * Singleton WebSocket client instance for cross-component usage.
 */
export const wsClient = new WebSocketClient();
