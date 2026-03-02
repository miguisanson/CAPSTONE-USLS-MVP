import "dotenv/config";
import { env } from "./config/env";
import { registerAlertJob } from "./jobs/alert-job";
import { prisma } from "./lib/prisma";
import { createApp } from "./app";

const app = createApp();

const server = app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running at http://localhost:${env.PORT}`);
});

registerAlertJob();

const shutdown = async (): Promise<void> => {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

