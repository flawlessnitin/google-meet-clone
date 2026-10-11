import { describe, expect, it } from "bun:test";
import type { ServerWebSocket } from "bun";
import {
  DEFAULT_MAX_RECONNECT_ATTEMPTS,
  DEFAULT_RECONNECT_DELAYS,
  WebSocketClient,
  wsClient,
  type ConnectionState,
} from "./websocket";

describe("WebSocketClient", () => {
  it("exports wsClient singleton as an instance of WebSocketClient", () => {
    expect(wsClient).toBeDefined();
    expect(wsClient).toBeInstanceOf(WebSocketClient);
  });

  it("configures default backoff delays and max retry attempts", () => {
    expect(DEFAULT_RECONNECT_DELAYS).toEqual([1000, 2000, 4000, 8000, 16000]);
    expect(DEFAULT_MAX_RECONNECT_ATTEMPTS).toBe(5);
  });

  it("registers onMessage handler and unsubscribes cleanly", () => {
    const client = new WebSocketClient("ws://localhost:9999/ws");
    let callCount = 0;

    const unsubscribe = client.onMessage(() => {
      callCount++;
    });

    expect(typeof unsubscribe).toBe("function");
    unsubscribe();
    expect(callCount).toBe(0);
  });

  it("serialises and sends typed messages to server, receiving ack", async () => {
    // Spin up an echo server in test
    const server = Bun.serve({
      port: 0,
      fetch(req, server) {
        if (server.upgrade(req)) {
          return;
        }
        return new Response("Upgrade failed", { status: 500 });
      },
      websocket: {
        message(ws, message) {
          const parsed = JSON.parse(message.toString());
          if (parsed.type === "ping") {
            ws.send(JSON.stringify({ type: "ack", timestamp: Date.now() }));
          }
        },
      },
    });

    const client = new WebSocketClient(`ws://localhost:${server.port}/ws`);
    client.connect();

    const ackReceived = new Promise<{ type: string }>((resolve) => {
      client.onMessage((msg) => {
        resolve(msg);
      });
    });

    // Wait until connected then send
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (client.isConnected) {
          clearInterval(check);
          resolve();
        }
      }, 10);
    });

    client.send({ type: "ping" });
    const response = await ackReceived;

    expect(response.type).toBe("ack");

    client.disconnect();
    expect(client.isConnected).toBe(false);
    server.stop();
  });

  describe("Auto-reconnect with exponential backoff (T-05)", () => {
    it("transitions state: disconnected -> connected on open, connected -> reconnecting on unexpected close", async () => {
      let activeSocket: ServerWebSocket<unknown> | null = null;
      const server = Bun.serve({
        port: 0,
        fetch(req, server) {
          if (server.upgrade(req)) return;
          return new Response("Upgrade failed", { status: 500 });
        },
        websocket: {
          open(ws) {
            activeSocket = ws;
          },
          message() {},
        },
      });

      const states: ConnectionState[] = [];
      const client = new WebSocketClient({
        url: `ws://localhost:${server.port}/ws`,
        reconnectDelays: [50, 100],
        maxReconnectAttempts: 2,
      });

      expect(client.state).toBe("disconnected");

      client.onStateChange((state) => {
        states.push(state);
      });

      client.connect();

      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (client.state === "connected") {
            clearInterval(check);
            resolve();
          }
        }, 10);
      });

      expect(client.state).toBe("connected");

      // Server drops connection abruptly with non-1000 code
      if (activeSocket) {
        (activeSocket as ServerWebSocket<unknown>).close(
          1006,
          "Abnormal closure"
        );
      }

      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (client.state === "reconnecting") {
            clearInterval(check);
            resolve();
          }
        }, 10);
      });

      expect(client.state).toBe("reconnecting");

      client.disconnect();
      expect(client.state).toBe("disconnected");
      server.stop();
    });

    it("calling disconnect() cancels any pending reconnect timer", async () => {
      const client = new WebSocketClient({
        url: "ws://localhost:9999/ws", // Unreachable port
        reconnectDelays: [100, 200],
        maxReconnectAttempts: 2,
      });

      client.connect();

      // Immediately call disconnect
      client.disconnect();

      expect(client.state).toBe("disconnected");
      expect(client.isReconnecting).toBe(false);
    });

    it("stops retrying after maxReconnectAttempts and transitions to disconnected", async () => {
      const states: ConnectionState[] = [];
      const client = new WebSocketClient({
        url: "ws://localhost:65534/ws", // Non-existent port
        reconnectDelays: [10, 20],
        maxReconnectAttempts: 2,
      });

      client.onStateChange((s) => states.push(s));
      client.connect();

      // Wait until it exhausts attempts and ends in disconnected
      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (
            client.state === "disconnected" &&
            states.includes("reconnecting")
          ) {
            clearInterval(check);
            resolve();
          }
        }, 15);
      });

      expect(client.state).toBe("disconnected");
      expect(client.reconnectAttempts).toBe(0); // Reset for future calls
    });

    it("automatically reconnects when server restarts", async () => {
      let serverPort = 0;
      let server: ReturnType<typeof Bun.serve> | null = null;

      const startServer = () => {
        return Bun.serve({
          port: serverPort || 0,
          fetch(req, s) {
            if (s.upgrade(req)) return;
            return new Response("Upgrade failed", { status: 500 });
          },
          websocket: {
            message() {},
          },
        });
      };

      server = startServer();
      serverPort = server.port ?? 0;

      const client = new WebSocketClient({
        url: `ws://localhost:${serverPort}/ws`,
        reconnectDelays: [50, 100, 200],
        maxReconnectAttempts: 3,
      });

      client.connect();

      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (client.state === "connected") {
            clearInterval(check);
            resolve();
          }
        }, 10);
      });

      expect(client.state).toBe("connected");

      // Stop server abruptly closing connections
      server.stop(true);

      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (client.state === "reconnecting") {
            clearInterval(check);
            resolve();
          }
        }, 10);
      });

      expect(client.state).toBe("reconnecting");

      // Restart server on same port
      server = Bun.serve({
        port: serverPort,
        fetch(req, s) {
          if (s.upgrade(req, { data: undefined })) return;
          return new Response("Upgrade failed", { status: 500 });
        },
        websocket: {
          message() {},
        },
      });

      // Client should automatically reconnect
      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (client.state === "connected") {
            clearInterval(check);
            resolve();
          }
        }, 20);
      });

      expect(client.state).toBe("connected");

      client.disconnect();
      server.stop();
    });
  });
});
