import { DEFAULT_WS_URL, type SocketMessage } from "@meet/shared";

type GenericHandler = (message: SocketMessage) => void;

export class WebSocketClient {
  private socket: WebSocket | null = null;
  private url: string;
  private messageListeners: Set<GenericHandler> = new Set();
  private openListeners: Set<() => void> = new Set();
  private closeListeners: Set<() => void> = new Set();

  constructor(url?: string) {
    this.url = url || process.env.NEXT_PUBLIC_WS_URL || DEFAULT_WS_URL;
  }

  /**
   * Establishes a WebSocket connection to the server.
   */
  public connect(url?: string): void {
    if (url) {
      this.url = url;
    }

    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.socket = new WebSocket(this.url);

    this.socket.onopen = () => {
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

    this.socket.onclose = () => {
      this.closeListeners.forEach((listener) => listener());
    };

    this.socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }

  /**
   * Disconnects the active socket connection and cleans up socket handlers.
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.close();
      this.socket = null;
    }
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
   * If a messageType filter is provided, only messages matching that type trigger the callback.
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
   * Checks if socket is currently open and connected.
   */
  public get isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  /**
   * Returns current readyState of the WebSocket.
   */
  public get readyState(): number {
    return this.socket ? this.socket.readyState : WebSocket.CLOSED;
  }
}

/**
 * Singleton WebSocket client instance for cross-component usage.
 */
export const wsClient = new WebSocketClient();
