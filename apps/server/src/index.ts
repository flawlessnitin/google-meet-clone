import "dotenv/config";
import { buildApp } from "./app";

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || "0.0.0.0";

async function main() {
  const app = await buildApp();

  try {
    const address = await app.listen({ port: PORT, host: HOST });
    app.log.info(`Fastify server listening on ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
