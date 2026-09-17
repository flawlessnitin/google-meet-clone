import "dotenv/config";
import { buildApp } from "./app";

interface ServerConfig {
  port: number;
  host: string;
}

const config: ServerConfig = {
  port: Number(process.env.PORT) || 3001,
  host: process.env.HOST || "0.0.0.0",
};

async function main(): Promise<void> {
  const app = await buildApp();

  try {
    const address = await app.listen(config);
    app.log.info(`Fastify server listening on ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
