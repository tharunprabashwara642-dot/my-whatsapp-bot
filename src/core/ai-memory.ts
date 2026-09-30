import type { AppDatabase } from "./database";
import type { AIMessage } from "../services/ai";

export function readAIMemory(database: AppDatabase, userJid: string, limit = 8): AIMessage[] {
  const rows = database.db
    .query(
      `SELECT role, content FROM (
      SELECT id, role, content FROM ai_memory WHERE user_jid = ? ORDER BY id DESC LIMIT ?
    ) ORDER BY id ASC`,
    )
    .all(userJid, limit) as Array<{ role: "user" | "assistant"; content: string }>;
  return rows;
}

export function saveAITurn(
  database: AppDatabase,
  userJid: string,
  prompt: string,
  answer: string,
): void {
  const insert = database.db.query(
    "INSERT INTO ai_memory(user_jid, role, content) VALUES (?, ?, ?)",
  );
  const transaction = database.db.transaction(() => {
    insert.run(userJid, "user", prompt.slice(0, 8_000));
    insert.run(userJid, "assistant", answer.slice(0, 8_000));
    database.db
      .query(
        `DELETE FROM ai_memory WHERE user_jid = ? AND id NOT IN (
      SELECT id FROM ai_memory WHERE user_jid = ? ORDER BY id DESC LIMIT 16
    )`,
      )
      .run(userJid, userJid);
  });
  transaction();
}

export function clearAIMemory(database: AppDatabase, userJid: string): void {
  database.db.query("DELETE FROM ai_memory WHERE user_jid = ?").run(userJid);
}
