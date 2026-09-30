import { describe, expect, test } from "bun:test";
import { AppDatabase } from "../src/core/database";
import { dispatchCommand } from "../src/core/dispatcher";
import { loadConfig } from "../src/core/config";
import type { CommandContext, RegisteredCommand } from "../src/core/types";

function fakeContext(overrides: Partial<CommandContext> = {}): CommandContext {
  const config = loadConfig({ KITEFRAME_OWNER_NUMBERS: "15551234567" });
  return {
    socket: {} as CommandContext["socket"],
    config,
    database: {} as AppDatabase,
    chatId: "u@s.whatsapp.net",
    senderJid: "u@s.whatsapp.net",
    senderNumber: "15550000000",
    text: "",
    args: [],
    prefix: "/",
    isGroup: false,
    isOwner: false,
    isSudo: false,
    isGroupAdmin: false,
    isBotAdmin: false,
    rawMessage: {} as CommandContext["rawMessage"],
    reply: async () => undefined,
    downloadMedia: async () => {
      throw new Error("unused");
    },
    ...overrides,
  };
}

function fakeCommand(overrides: Partial<RegisteredCommand> = {}): RegisteredCommand {
  return {
    name: "settings",
    trigger: "settings",
    category: "Owner",
    description: "test",
    permission: "owner",
    handler: async () => undefined,
    ...overrides,
  };
}

describe("central command policy", () => {
  test("denies owner-only commands to ordinary users", async () => {
    const database = await AppDatabase.open(":memory:");
    const responses: string[] = [];
    const context = fakeContext({
      database,
      reply: async (text) => {
        responses.push(text);
      },
    });
    await dispatchCommand(context, fakeCommand(), database);
    expect(responses[0]).toContain("configured owner");
    expect(database.db.query("SELECT COUNT(*) AS count FROM command_usage").get()).toEqual({
      count: 0,
    });
    await database.close();
  });
  test("records and runs a command after authorized access", async () => {
    const database = await AppDatabase.open(":memory:");
    let executed = false;
    const context = fakeContext({ database, isOwner: true });
    await dispatchCommand(
      context,
      fakeCommand({
        handler: async () => {
          executed = true;
        },
      }),
      database,
    );
    expect(executed).toBe(true);
    expect(database.db.query("SELECT COUNT(*) AS count FROM command_usage").get()).toEqual({
      count: 1,
    });
    await database.close();
  });
});
