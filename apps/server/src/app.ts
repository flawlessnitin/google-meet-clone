import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { MAX_PARTICIPANTS } from "@meet/shared";
import Fastify, { type FastifyInstance } from "fastify";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: process.env.NODE_ENV === "test" ? false : true,
  });

  // CORS setup
  await app.register(cors, {
    origin: ["http://localhost:3000"],
    credentials: true,
  });

  // WebSocket plugin setup
  await app.register(websocket);

  // Health check endpoint
  app.get("/api/health", async () => {
    return {
      status: "ok",
      maxParticipants: MAX_PARTICIPANTS,
    };
  });

  return app;
}
