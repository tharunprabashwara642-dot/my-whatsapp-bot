import { defineCommand } from "../../core/types";

export default defineCommand({
  name: "about",
  category: "General",
  description: "Show the platform's operating details.",
  async handler(context) {
    await context.reply(
      `✦ *${context.config.name}*\nModular WhatsApp automation, built for deliberate use.\nPrefix: ${context.prefix}\nAI: ${context.config.ai.provider}\nPrivacy: message content is not retained by default.`,
    );
  },
});
