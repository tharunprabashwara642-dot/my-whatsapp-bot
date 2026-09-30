import { describe, expect, test } from "bun:test";
import { AppDatabase } from "../src/core/database";
import type { WAMessage, WASocket } from "baileys";
import { enforceGroupPolicy } from "../src/services/group-policy";

describe("per-group anti-link policy", () => {
  test("does nothing until enabled, then deletes invite links for non-admins", async () => {
    const database = await AppDatabase.open(":memory:");
    const message = {
      key: { remoteJid: "group@g.us", id: "message-1", participant: "user@s.whatsapp.net" },
      message: { conversation: "join at chat.whatsapp.com/ABCdef123" },
    } as unknown as WAMessage;
    const actions: unknown[] = [];
    const socket = {
      sendMessage: async (...args: unknown[]) => {
        actions.push(args);
        return {} as WAMessage;
      },
    } as unknown as WASocket;
    expect(await enforceGroupPolicy(socket, message, database, false, true)).toBe(false);
    expect(actions).toHaveLength(0);
    database.updateGroupSetting("group@g.us", "antilink", true);
    expect(await enforceGroupPolicy(socket, message, database, false, true)).toBe(true);
    expect(actions).toHaveLength(2);
    expect(await enforceGroupPolicy(socket, message, database, true, true)).toBe(false);

    const wrappedMessages = [
      {
        ephemeralMessage: {
          message: { extendedTextMessage: { text: "join chat.whatsapp.com/Link123" } },
        },
      },
      { documentMessage: { caption: "join chat.whatsapp.com/Doc123" } },
    ];
    for (const payload of wrappedMessages) {
      const wrapped = { ...message, message: payload } as unknown as WAMessage;
      expect(await enforceGroupPolicy(socket, wrapped, database, false, true)).toBe(true);
    }
    expect(actions).toHaveLength(6);
    await database.close();
  });
});
