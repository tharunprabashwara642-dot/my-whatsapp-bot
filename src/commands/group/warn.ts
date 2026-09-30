import { defineCommand } from "../../core/types";

export default defineCommand({
  name: "warn",
  category: "Group",
  description: "Record a moderation warning for a mentioned member.",
  usage: "/warn @member [reason]",
  permission: "group-admin",
  groupOnly: true,
  async handler(context) {
    const mentioned =
      context.rawMessage.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentioned) {
      await context.reply(`Mention a member: ${context.prefix}warn @member [reason]`);
      return;
    }
    const reason = context.text.replace(/@\S+/g, "").trim() || "No reason provided";
    const count = context.database.addWarning(context.chatId, mentioned, reason);
    await context.reply(`Warning recorded (${count}) for @${mentioned.split("@")[0]}.`, [
      mentioned,
    ]);
  },
});
