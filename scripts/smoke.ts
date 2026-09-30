import { loadConfig } from "../src/core/config";
import { AppDatabase } from "../src/core/database";
import { discoverCommands } from "../src/core/command-loader";

const config = loadConfig({
  KITEFRAME_OWNER_NUMBERS: "15551234567",
  KITEFRAME_AI_PROVIDER: "disabled",
});
const database = await AppDatabase.open(":memory:");
const commands = await discoverCommands();
for (const required of [
  "help",
  "ping",
  "ask",
  "vision",
  "summarize",
  "settings",
  "kick",
  "sticker",
  "prefix",
  "feature",
]) {
  if (!commands.has(required)) throw new Error(`Smoke check: missing command ${required}`);
}
if (database.getGlobalPrefix(config.prefixes[0] ?? "/") !== "/")
  throw new Error("Smoke check: prefix persistence is invalid");
database.updateGroupSetting("group:test", "antilink", true);
if (!database.groupSettings<{ antilink?: boolean }>("group:test").antilink)
  throw new Error("Smoke check: group configuration persistence failed");
await database.close();
console.log(
  `Smoke check passed: ${commands.size} command triggers; configuration and SQLite are ready.`,
);
