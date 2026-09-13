import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import {
  type AckMessage,
  DEFAULT_WS_URL,
  MAX_PARTICIPANTS,
} from "@meet/shared";
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

  // WebSocket signaling / ping-pong route
  app.get("/ws", { websocket: true }, (socket) => {
    app.log.info("Client connected");

    socket.on("message", (rawMessage) => {
      try {
        const text =
          typeof rawMessage === "string"
            ? rawMessage
            : rawMessage.toString("utf8");
        const parsed: unknown = JSON.parse(text);

        if (
          parsed &&
          typeof parsed === "object" &&
          "type" in parsed &&
          (parsed as { type: unknown }).type === "ping"
        ) {
          const ack: AckMessage = {
            type: "ack",
            timestamp: Date.now(),
          };
          socket.send(JSON.stringify(ack));
        }
      } catch (err) {
        app.log.error(err, "Failed to parse incoming WebSocket message");
      }
    });

    socket.on("close", () => {
      app.log.info("Client disconnected");
    });
  });

  return app;
}
