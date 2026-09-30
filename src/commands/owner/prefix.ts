import { defineCommand } from "../../core/types";

export default defineCommand({
  name: "prefix",
  category: "Owner",
  description: "Change the active global command prefix.",
  usage: "/prefix <one character>",
  permission: "owner",
  privateOnly: true,
  async handler(context) {
    const prefix = context.text.trim();
    if (!/^[!#$%&*+./?~-]$/.test(prefix)) {
      await context.reply("Choose exactly one safe punctuation character for the prefix.");
      return;
    }
    context.database.setGlobalPrefix(prefix);
    await context.reply(`Command prefix updated to ${prefix}`);
  },
});
