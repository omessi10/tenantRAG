import Fastify from "fastify";
import { registerRoutes } from "./api/routes.js";
import { config } from "./config.js";
import { migrate } from "./db/migrate.js";
import { errorHandler } from "./middleware/error-handler.js";

async function main(): Promise<void> {
  await migrate();

  const app = Fastify({ logger: true });
  app.setErrorHandler(errorHandler);

  await registerRoutes(app);

  await app.listen({ port: config.port, host: "0.0.0.0" });
  console.log(`Server listening on http://localhost:${config.port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
