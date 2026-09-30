import { defineCommand } from "../../core/types";

export default defineCommand({
  name: "ping",
  category: "General",
  description: "Check whether the service is responsive.",
  cooldownSeconds: 2,
  async handler(context) {
    await context.reply("Here and ready.");
  },
});
