import { describe, expect, it } from "bun:test";
import { WebSocketClient, wsClient } from "./websocket";

describe("WebSocketClient", () => {
  it("exports wsClient singleton as an instance of WebSocketClient", () => {
    expect(wsClient).toBeDefined();
    expect(wsClient).toBeInstanceOf(WebSocketClient);
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
});
