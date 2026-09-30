import { defineCommand } from "../../core/types";
import { completeAI } from "../../services/ai";
import { logger } from "../../core/logger";

export default defineCommand({
  name: "summarize",
  aliases: ["summary"],
  category: "AI",
  description: "Summarize supplied or replied-to text.",
  usage: "/summarize <text>",
  cooldownSeconds: 10,
  async handler(context) {
    const text = (context.text.trim() || context.quotedText?.trim() || "").slice(0, 8_000);
    if (!text) {
      await context.reply("Add text or reply to a message you want summarized.");
      return;
    }
    try {
      await context.reply(
        (
          await completeAI(
            context.config,
            `Summarize the following faithfully and concisely:\n\n${text}`,
          )
        ).slice(0, 6_000),
      );
    } catch (error) {
      logger.warn({ err: error }, "Summary request failed");
      await context.reply("Summarization is unavailable right now. Check AI configuration.");
    }
  },
});
