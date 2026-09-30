import { defineCommand } from "../../core/types";
import { completeAI } from "../../services/ai";
import { logger } from "../../core/logger";

export default defineCommand({
  name: "vision",
  category: "AI",
  description: "Ask the configured AI to describe an attached image.",
  usage: "/vision [question]",
  cooldownSeconds: 15,
  async handler(context) {
    if (context.text.length > 2_000) {
      await context.reply("Please keep the image question under 2,000 characters.");
      return;
    }
    try {
      const media = await context.downloadMedia();
      if (media.kind !== "image") {
        await context.reply("Attach an image directly to this command.");
        return;
      }
      const answer = await completeAI(
        context.config,
        context.text.trim() || "Describe the important details in this image.",
        [],
        {
          mimeType: media.mimeType,
          base64: media.buffer.toString("base64"),
        },
      );
      await context.reply(answer.slice(0, 6_000));
    } catch (error) {
      logger.warn({ err: error }, "Image analysis failed");
      await context.reply(
        "I couldn't analyze that image. Check AI configuration and the file size limit.",
      );
    }
  },
});
