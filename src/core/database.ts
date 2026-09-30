import { chmod, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { Database } from "bun:sqlite";

export class AppDatabase {
  readonly db: Database;

  constructor(path: string) {
    this.db = new Database(path, { create: true, strict: true });
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run("PRAGMA foreign_keys = ON");
    this.db.run("PRAGMA busy_timeout = 5000");
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    );
    const applied = this.db.query("SELECT version FROM schema_migrations WHERE version = 1").get();
    if (!applied) {
      const migrate = this.db.transaction(() => {
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS group_settings (
            jid TEXT PRIMARY KEY,
            settings_json TEXT NOT NULL DEFAULT '{}',
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS command_settings (
            name TEXT PRIMARY KEY,
            enabled INTEGER NOT NULL CHECK(enabled IN (0, 1)),
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS command_usage (
            id INTEGER PRIMARY KEY,
            command TEXT NOT NULL,
            user_jid TEXT NOT NULL,
            chat_jid TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS command_usage_created_idx ON command_usage(created_at);
          CREATE TABLE IF NOT EXISTS ai_memory (
            id INTEGER PRIMARY KEY,
            user_jid TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
            content TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS ai_memory_user_id_idx ON ai_memory(user_jid, id DESC);
          CREATE TABLE IF NOT EXISTS warnings (
            id INTEGER PRIMARY KEY,
            group_jid TEXT NOT NULL,
            user_jid TEXT NOT NULL,
            reason TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS warnings_created_idx ON warnings(created_at);
        `);
        this.db.query("INSERT INTO schema_migrations(version) VALUES (1)").run();
      });
      migrate();
    }
  }

  static async open(path: string): Promise<AppDatabase> {
    if (path === ":memory:") return new AppDatabase(path);
    process.umask(0o077);
    const directory = dirname(path);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await chmod(directory, 0o700).catch(() => undefined);
    const database = new AppDatabase(path);
    await chmod(path, 0o600).catch(() => undefined);
    return database;
  }

  groupSettings<T extends Record<string, unknown>>(jid: string): T {
    const row = this.db
      .query("SELECT settings_json FROM group_settings WHERE jid = ?")
      .get(jid) as { settings_json: string } | null;
    return (row ? JSON.parse(row.settings_json) : {}) as T;
  }

  updateGroupSetting(jid: string, key: string, value: unknown): void {
    const update = this.db.transaction(() => {
      const current = this.groupSettings<Record<string, unknown>>(jid);
      current[key] = value;
      this.db
        .query(
          `INSERT INTO group_settings(jid, settings_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(jid) DO UPDATE SET settings_json = excluded.settings_json, updated_at = CURRENT_TIMESTAMP`,
        )
        .run(jid, JSON.stringify(current));
    });
    update();
  }

  getGlobalPrefix(fallback: string): string {
    const row = this.db
      .query("SELECT settings_json FROM group_settings WHERE jid = '__global__'")
      .get() as { settings_json: string } | null;
    if (!row) return fallback;
    try {
      return (JSON.parse(row.settings_json) as { prefix?: string }).prefix || fallback;
    } catch {
      return fallback;
    }
  }

  setGlobalPrefix(prefix: string): void {
    this.updateGroupSetting("__global__", "prefix", prefix);
  }

  isCommandEnabled(name: string, fallback = true): boolean {
    const row = this.db.query("SELECT enabled FROM command_settings WHERE name = ?").get(name) as {
      enabled: number;
    } | null;
    return row ? row.enabled === 1 : fallback;
  }

  setCommandEnabled(name: string, enabled: boolean): void {
    this.db
      .query(
        `INSERT INTO command_settings(name, enabled, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(name) DO UPDATE SET enabled = excluded.enabled, updated_at = CURRENT_TIMESTAMP`,
      )
      .run(name, enabled ? 1 : 0);
  }

  recordCommand(name: string, user: string, chat: string): void {
    this.db
      .query("INSERT INTO command_usage(command, user_jid, chat_jid) VALUES (?, ?, ?)")
      .run(name, user, chat);
  }

  addWarning(group: string, user: string, reason: string): number {
    this.db
      .query("INSERT INTO warnings(group_jid, user_jid, reason) VALUES (?, ?, ?)")
      .run(group, user, reason.slice(0, 300));
    return Number(
      (
        this.db
          .query("SELECT COUNT(*) AS total FROM warnings WHERE group_jid = ? AND user_jid = ?")
          .get(group, user) as { total: number }
      ).total,
    );
  }

  pruneOldData(): void {
    this.db.run("DELETE FROM command_usage WHERE created_at < datetime('now', '-90 days')");
    this.db.run("DELETE FROM warnings WHERE created_at < datetime('now', '-180 days')");
    this.db.run("DELETE FROM ai_memory WHERE created_at < datetime('now', '-90 days')");
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
