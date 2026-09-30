import { defineCommand } from "../../core/types";
import { createSticker } from "../../services/media";
import { logger } from "../../core/logger";

export default defineCommand({
  name: "sticker",
  aliases: ["st"],
  category: "Media",
  description: "Turn an attached image or short video into a sticker.",
  usage: "/sticker (attach image/video)",
  cooldownSeconds: 5,
  async handler(context) {
    try {
      const sticker = await createSticker(context);
      await context.socket.sendMessage(context.chatId, { sticker });
    } catch (error) {
      logger.warn({ err: error }, "Sticker conversion failed");
      await context.reply(
        "I couldn't make that sticker. Attach an image or short video and check that FFmpeg is installed.",
      );
    }
  },
});
