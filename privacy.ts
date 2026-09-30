import { defineCommand } from "../../core/types";

export default defineCommand({
  name: "privacy",
  category: "General",
  description: "Explain how messages and optional AI memory are handled.",
  async handler(context) {
    await context.reply(
      `*Privacy notes*\n• Messages are processed in memory to respond and are not logged with their contents.\n• Command names, chat identifiers, and sender identifiers are recorded locally for up to 90 days.\n• When a group admin uses /warn, its reason is stored for up to 180 days.\n• AI prompts are sent to the provider configured by the operator. Check that provider’s retention terms before enabling AI.\n• AI memory is ${context.config.ai.memoryEnabled ? "enabled for private chats and pruned after 90 days" : "off"}; it can be cleared with ${context.prefix}ask clear.\n• WhatsApp session files are sensitive account credentials. Keep the auth directory private.`,
    );
  },
});
