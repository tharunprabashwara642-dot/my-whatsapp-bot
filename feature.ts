import { defineCommand } from "../../core/types";

export default defineCommand({
  name: "feature",
  category: "Owner",
  description: "Enable or disable a command by its primary name.",
  usage: "/feature <command> on|off",
  permission: "owner",
  privateOnly: true,
  async handler(context) {
    const [name, state] = context.text.trim().toLowerCase().split(/\s+/);
    if (!name || !["on", "off"].includes(state ?? "")) {
      await context.reply(`Use ${context.prefix}feature <command> on|off`);
      return;
    }
    context.database.setCommandEnabled(name, state === "on");
    await context.reply(`Command “${name}” is now ${state}.`);
  },
});
