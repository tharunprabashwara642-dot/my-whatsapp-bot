import { loadConfig } from "./core/config";
import { AppDatabase } from "./core/database";
import { logger } from "./core/logger";
import { startWhatsApp } from "./connection/whatsapp";

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const database = await AppDatabase.open(config.databasePath);
  database.pruneOldData();
  const retentionTimer = setInterval(
    () => {
      try {
        database.pruneOldData();
      } catch (error) {
        logger.warn({ err: error }, "Data-retention cleanup failed");
      }
    },
    24 * 60 * 60 * 1000,
  );
  retentionTimer.unref();
  const stopWhatsApp = await startWhatsApp(config, database);
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Stopping cleanly");
    clearInterval(retentionTimer);
    await stopWhatsApp();
    await database.close();
    process.exit(0);
  };
  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("unhandledRejection", (error) => logger.error({ err: error }, "Unhandled rejection"));
  process.on("uncaughtException", (error) => {
    logger.fatal({ err: error }, "Uncaught exception");
    process.exit(1);
  });
}

main().catch((error) => {
  logger.fatal({ err: error }, "Startup failed");
  process.exit(1);
});
