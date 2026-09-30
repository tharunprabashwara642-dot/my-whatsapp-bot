import { defineCommand } from "../../core/types";
import { logger } from "../../core/logger";

export default defineCommand({
  name: "kick",
  category: "Group",
  description: "Remove a mentioned group member.",
  usage: "/kick @member",
  permission: "group-admin",
  groupOnly: true,
  botAdmin: true,
  async handler(context) {
    const mentions =
      context.rawMessage.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
    const quoted = context.rawMessage.message?.extendedTextMessage?.contextInfo?.participant;
    const target =
      mentions[0] ??
      (context.text.trim() ? `${context.text.trim().replace(/\D/g, "")}@s.whatsapp.net` : quoted);
    if (!target || !target.includes("@")) {
      await context.reply(
        `Mention someone, or reply to their message: ${context.prefix}kick @member`,
      );
      return;
    }
    if (target === context.socket.user?.id || target.split("@")[0] === context.senderNumber) {
      await context.reply("That member cannot be removed with this command.");
      return;
    }
    try {
      await context.socket.groupParticipantsUpdate(context.chatId, [target], "remove");
      await context.reply("Group membership updated.");
    } catch (error) {
      logger.warn({ err: error }, "Group removal failed");
      await context.reply(
        "I couldn't update group membership. Check the target and bot permissions.",
      );
    }
  },
});
