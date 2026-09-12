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
});
