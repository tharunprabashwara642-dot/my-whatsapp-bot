import { defineCommand } from "../../core/types";

export default defineCommand({
  name: "settings",
  category: "Group",
  description: "View or change this group's moderation and greeting options.",
  usage: "/settings [antilink|welcome] [on|off]",
  permission: "group-admin",
  groupOnly: true,
  async handler(context) {
    const settings = context.database.groupSettings<{ antilink?: boolean; welcome?: boolean }>(
      context.chatId,
    );
    const [key, value] = context.text.trim().toLowerCase().split(/\s+/);
    if (!key) {
      await context.reply(
        `Group settings\n• antilink: ${settings.antilink ? "on" : "off"}\n• welcome: ${settings.welcome ? "on" : "off"}\nUse ${context.prefix}settings <name> on|off`,
      );
      return;
    }
    if (!["antilink", "welcome"].includes(key) || !["on", "off"].includes(value ?? "")) {
      await context.reply(`Choose an option and value: ${context.prefix}settings antilink on`);
      return;
    }
    context.database.updateGroupSetting(context.chatId, key, value === "on");
    await context.reply(`${key} is now ${value} for this group.`);
  },
});
