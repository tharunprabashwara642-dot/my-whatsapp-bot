import { describe, expect, test } from "bun:test";
import type { WASocket, WAMessage } from "baileys";
import { loadConfig } from "../src/core/config";
import { AppDatabase } from "../src/core/database";
import { handleMessage } from "../src/handlers/message-handler";
import type { RegisteredCommand } from "../src/core/types";

describe("WhatsApp LID identity", () => {
  test("recognizes a configured owner through a private remoteJidAlt", async () => {
    const config = loadConfig({ KITEFRAME_OWNER_NUMBERS: "15551234567" });
    const database = await AppDatabase.open(":memory:");
    const replies: string[] = [];
    let ran = false;
    const socket = {
      sendMessage: async (_jid: string, payload: { text?: string }) => {
        replies.push(payload.text ?? "");
        return {} as WAMessage;
      },
    } as unknown as WASocket;
    const command: RegisteredCommand = {
      name: "prefix",
      trigger: "prefix",
      category: "Owner",
      description: "test",
      permission: "owner",
      privateOnly: true,
      handler: async (context) => {
        ran = context.isOwner;
      },
    };
    const message = {
      key: {
        remoteJid: "123456789@lid",
        remoteJidAlt: "15551234567@s.whatsapp.net",
        id: "m1",
        fromMe: false,
      },
      message: { conversation: "/prefix !" },
    } as unknown as WAMessage;
    await handleMessage(socket, message, config, database, new Map([["prefix", command]]));
    expect(ran).toBe(true);
    expect(replies).toHaveLength(0);
    await database.close();
  });
});
