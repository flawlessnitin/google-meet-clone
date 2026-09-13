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

  // WebSocket signaling / ping-pong route
  app.get("/ws", { websocket: true }, (socket) => {
    app.log.info("Client connected");

    socket.on("message", (rawMessage) => {
      try {
        const text =
          typeof rawMessage === "string"
            ? rawMessage
            : rawMessage.toString("utf8");
        const parsed = JSON.parse(text);

        if (parsed && typeof parsed === "object" && "type" in parsed) {
          if (parsed.type === "ping") {
            socket.send(
              JSON.stringify({
                type: "ack",
                timestamp: Date.now(),
              })
            );
          } else {
            socket.send(
              JSON.stringify({
                type: "ack",
                echo: parsed,
                timestamp: Date.now(),
              })
            );
          }
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
