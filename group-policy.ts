import type { WAMessage, WASocket } from "baileys";
import type { AppDatabase } from "../core/database";
import { logger } from "../core/logger";
import { messageBody } from "../core/message-text";

const inviteLink = /(?:https?:\/\/)?chat\.whatsapp\.com\/[A-Za-z0-9_-]+/i;

export async function enforceGroupPolicy(
  socket: WASocket,
  message: WAMessage,
  database: AppDatabase,
  senderIsAdmin: boolean,
  botCanModerate: boolean,
): Promise<boolean> {
  const chat = message.key.remoteJid;
  if (!chat?.endsWith("@g.us") || !message.message || !botCanModerate) return false;
  const settings = database.groupSettings<{ antilink?: boolean }>(chat);
  if (!settings.antilink || senderIsAdmin) return false;
  const text = messageBody(message.message as unknown as Record<string, unknown>);
  if (!inviteLink.test(text)) return false;
  try {
    await socket.sendMessage(chat, { delete: message.key });
    await socket.sendMessage(chat, { text: "Invite links are restricted in this group." });
  } catch (error) {
    logger.warn({ err: error }, "Could not enforce group link rule; check bot admin status");
  }
  return true;
}

export async function handleParticipants(
  socket: WASocket,
  data: { id: string; participants: string[]; action: string },
  database: AppDatabase,
  botName: string,
): Promise<void> {
  const settings = database.groupSettings<{ welcome?: boolean }>(data.id);
  if (!settings.welcome || !["add", "remove"].includes(data.action)) return;
  const text = data.action === "add" ? `Welcome to ${botName}'s group.` : "Goodbye, and take care.";
  for (const _participant of data.participants) {
    try {
      await socket.sendMessage(data.id, { text });
    } catch (error) {
      logger.warn({ err: error }, "Could not send group greeting");
    }
  }
}
