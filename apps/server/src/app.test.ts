import { describe, expect, it } from "bun:test";
import { buildApp } from "./app";

describe("Fastify server", () => {
  it("GET /api/health returns status ok and maxParticipants: 10", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/health",
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json).toEqual({
      status: "ok",
      maxParticipants: 10,
    });

    await app.close();
  });

  it("WebSocket /ws accepts connection and echoes ack on ping", async () => {
    const app = await buildApp();
    await app.listen({ port: 0 });
    const address = app.server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    const ws = new WebSocket(`ws://localhost:${port}/ws`);

    const ackPromise = new Promise<{ type: string }>((resolve, reject) => {
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data.toString());
          resolve(data);
        } catch (e) {
          reject(e);
        }
      };
      ws.onerror = (e) => reject(e);
    });

    await new Promise<void>((resolve) => {
      ws.onopen = () => resolve();
    });

    ws.send(JSON.stringify({ type: "ping" }));
    const ack = await ackPromise;

    expect(ack.type).toBe("ack");

    ws.close();
    await app.close();
  });
});
