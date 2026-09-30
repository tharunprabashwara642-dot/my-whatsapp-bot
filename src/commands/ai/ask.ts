import { defineCommand } from "../../core/types";
import { clearAIMemory, readAIMemory, saveAITurn } from "../../core/ai-memory";
import { completeAI } from "../../services/ai";
import { logger } from "../../core/logger";

export default defineCommand({
  name: "ask",
  aliases: ["ai"],
  category: "AI",
  description: "Ask the configured AI provider a question.",
  usage: "/ask <question> | /ask clear",
  cooldownSeconds: 8,
  async handler(context) {
    if (context.text.trim().toLowerCase() === "clear") {
      clearAIMemory(context.database, context.senderJid);
      await context.reply("Your saved private-chat AI memory has been cleared.");
      return;
    }
    const prompt = context.text.trim() || context.quotedText?.trim();
    if (!prompt) {
      await context.reply(
        `Add a question, or reply to a message. Example: ${context.prefix}ask explain this briefly`,
      );
      return;
    }
    if (prompt.length > 8_000) {
      await context.reply("That prompt is too long; please keep it under 8,000 characters.");
      return;
    }
    const history =
      context.config.ai.memoryEnabled && !context.isGroup
        ? readAIMemory(context.database, context.senderJid)
        : [];
    try {
      const answer = await completeAI(context.config, prompt, history);
      if (context.config.ai.memoryEnabled && !context.isGroup)
        saveAITurn(context.database, context.senderJid, prompt, answer);
      await context.reply(answer.slice(0, 6_000));
    } catch (error) {
      logger.warn({ err: error }, "AI request failed");
      await context.reply("The AI service is unavailable or not configured right now.");
    }
  },
});
