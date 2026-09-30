import { logger } from "./logger";
import type { AppDatabase } from "./database";
import type { CommandContext, RegisteredCommand } from "./types";

const cooldowns = new Map<string, number>();

export async function dispatchCommand(
  context: CommandContext,
  command: RegisteredCommand,
  database: AppDatabase,
): Promise<void> {
  if (command.enabled === false || !database.isCommandEnabled(command.name)) {
    await context.reply("That command is currently unavailable.");
    return;
  }
  if (command.groupOnly && !context.isGroup) {
    await context.reply("Use this command in a group chat.");
    return;
  }
  if (command.privateOnly && context.isGroup) {
    await context.reply("Use this command in a private chat.");
    return;
  }
  if (command.permission === "owner" && !context.isOwner) {
    await context.reply("This action is reserved for the configured owner.");
    return;
  }
  if (
    command.permission === "group-admin" &&
    !context.isGroupAdmin &&
    !context.isOwner &&
    !context.isSudo
  ) {
    await context.reply("A group admin must make that change.");
    return;
  }
  if (command.botAdmin && !context.isBotAdmin) {
    await context.reply("Please make the bot a group admin first.");
    return;
  }
  if (context.config.accessMode === "self" && !context.isOwner) return;
  if (context.config.accessMode === "private" && !context.isOwner && context.isGroup) return;
  if (command.cooldownSeconds && !context.isOwner && !context.isSudo) {
    const key = `${command.name}:${context.senderJid}`;
    const now = Date.now();
    const expiry = cooldowns.get(key) ?? 0;
    if (expiry > now) {
      await context.reply(`Give it ${Math.ceil((expiry - now) / 1000)}s, then try again.`);
      return;
    }
    cooldowns.set(key, now + command.cooldownSeconds * 1000);
  }
  try {
    database.recordCommand(command.name, context.senderJid, context.chatId);
    await command.handler(context);
  } catch (error) {
    logger.error({ err: error, command: command.name }, "Command failed");
    await context
      .reply("I couldn't complete that request. Please try again later.")
      .catch(() => undefined);
  }
}
