import { afterEach, describe, expect, test } from "bun:test";
import { AppDatabase } from "../src/core/database";

const openDatabases: AppDatabase[] = [];
afterEach(async () => {
  for (const database of openDatabases.splice(0)) await database.close();
});

describe("SQLite services", () => {
  test("persists per-group settings and command switches", async () => {
    const database = await AppDatabase.open(":memory:");
    openDatabases.push(database);
    expect(database.groupSettings("g1")).toEqual({});
    database.updateGroupSetting("g1", "antilink", true);
    expect(database.groupSettings<{ antilink: boolean }>("g1").antilink).toBe(true);
    database.setCommandEnabled("ask", false);
    expect(database.isCommandEnabled("ask")).toBe(false);
    database.recordCommand("ping", "u1", "g1");
    expect(database.db.query("SELECT COUNT(*) AS count FROM command_usage").get()).toEqual({
      count: 1,
    });
  });
  test("prunes identifier, warning, and AI records by documented retention", async () => {
    const database = await AppDatabase.open(":memory:");
    openDatabases.push(database);
    database.recordCommand("ping", "u1", "g1");
    database.addWarning("g1", "u1", "old reason");
    database.db.run("UPDATE command_usage SET created_at = datetime('now', '-100 days')");
    database.db.run("UPDATE warnings SET created_at = datetime('now', '-181 days')");
    database.db.run(
      "INSERT INTO ai_memory(user_jid, role, content, created_at) VALUES ('u1', 'user', 'old prompt', datetime('now', '-91 days'))",
    );
    database.pruneOldData();
    expect(database.db.query("SELECT COUNT(*) AS count FROM command_usage").get()).toEqual({
      count: 0,
    });
    expect(database.db.query("SELECT COUNT(*) AS count FROM warnings").get()).toEqual({ count: 0 });
    expect(database.db.query("SELECT COUNT(*) AS count FROM ai_memory").get()).toEqual({
      count: 0,
    });
  });
  test("records scoped warnings", async () => {
    const database = await AppDatabase.open(":memory:");
    openDatabases.push(database);
    expect(database.addWarning("g1", "u1", "reason")).toBe(1);
    expect(database.addWarning("g1", "u1", "reason")).toBe(2);
    expect(database.addWarning("g2", "u1", "reason")).toBe(1);
  });
});
