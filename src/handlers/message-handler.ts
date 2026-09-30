import {
  downloadMediaMessage,
  isJidBroadcast,
  isJidNewsletter,
  type WASocket,
  type WAMessage,
} from "baileys";
import type { AppConfig } from "../core/config";
import type { AppDatabase } from "../core/database";
import { dispatchCommand } from "../core/dispatcher";
import { logger } from "../core/logger";
import { messageBody, parseCommand, quotedBody } from "../core/message-text";
import type { CommandContext, RegisteredCommand } from "../core/types";
import { getGroupMetadata } from "../services/group-cache";
import { enforceGroupPolicy } from "../services/group-policy";
import { WorkLimiter } from "../services/limiter";
import { collectLimitedStream } from "../services/media-download";

const mediaTypes = [
  "imageMessage",
  "videoMessage",
  "audioMessage",
  "documentMessage",
  "stickerMessage",
] as const;
type MediaKind = "image" | "video" | "audio" | "document" | "sticker";
const mediaDownloadLimiter = new WorkLimiter(4, 8);
const kindByField: Record<(typeof mediaTypes)[number], MediaKind> = {
  imageMessage: "image",
  videoMessage: "video",
  audioMessage: "audio",
  documentMessage: "document",
  stickerMessage: "sticker",
};

function normalizeNumber(jid: string): string {
  return jid.split("@")[0]?.split(":")[0]?.replace(/\D/g, "") ?? "";
}

function participantFor(
  metadata: Awaited<ReturnType<WASocket["groupMetadata"]>>,
  primaryJid: string,
  alternateJid: string,
) {
  const alternateNumbers = new Set(
    [normalizeNumber(primaryJid), normalizeNumber(alternateJid)].filter(Boolean),
  );
  return metadata.participants.find(
    (participant) =>
      participant.id === primaryJid ||
      participant.id === alternateJid ||
      (participant.phoneNumber
        ? alternateNumbers.has(normalizeNumber(participant.phoneNumber))
        : false),
  );
}

function unwrappedMessage(message: Record<string, unknown>): Record<string, unknown> {
  const ephemeral = message.ephemeralMessage as { message?: Record<string, unknown> } | undefined;
  return ephemeral?.message ?? message;
}

function containsViewOnce(message: Record<string, unknown>): boolean {
  if (message.viewOnceMessage || message.viewOnceMessageV2 || message.viewOnceMessageV2Extension)
    return true;
  const ephemeral = message.ephemeralMessage as { message?: Record<string, unknown> } | undefined;
  return ephemeral?.message ? containsViewOnce(ephemeral.message) : false;
}

export async function handleMessage(
  socket: WASocket,
  message: WAMessage,
  config: AppConfig,
  database: AppDatabase,
  commands: Map<string, RegisteredCommand>,
): Promise<void> {
  const chatId = message.key.remoteJid;
  if (
    !chatId ||
    !message.message ||
    message.key.fromMe ||
    isJidBroadcast(chatId) ||
    isJidNewsletter(chatId)
  )
    return;
  if (chatId === "status@broadcast") return;

  const isGroup = chatId.endsWith("@g.us");
  const rawSenderJid = isGroup
    ? (message.key.participant ?? message.key.participantAlt ?? "")
    : chatId;
  const alternateSenderJid = isGroup
    ? (message.key.participantAlt ?? rawSenderJid)
    : (message.key.remoteJidAlt ?? rawSenderJid);
  if (!rawSenderJid) return;
  let senderJid = alternateSenderJid;
  let senderNumber = normalizeNumber(alternateSenderJid);
  let isGroupAdmin = false;
  let isBotAdmin = false;
  let metadataAvailable = false;

  if (isGroup) {
    try {
      const metadata = await getGroupMetadata(socket, chatId);
      metadataAvailable = true;
      const actor = participantFor(metadata, rawSenderJid, alternateSenderJid);
      if (actor) {
        senderJid = actor.id;
        if (actor.phoneNumber) senderNumber = normalizeNumber(actor.phoneNumber);
        isGroupAdmin = actor.admin === "admin" || actor.admin === "superadmin";
      }
      const bot = socket.user?.id
        ? participantFor(metadata, socket.user.id, socket.user.id)
        : undefined;
      isBotAdmin = bot?.admin === "admin" || bot?.admin === "superadmin";
    } catch (error) {
      logger.debug({ err: error }, "Group metadata unavailable");
    }
  }

  const isOwner = config.owners.includes(senderNumber);
  const isSudo = config.sudoUsers.includes(senderNumber);
  if (
    await enforceGroupPolicy(
      socket,
      message,
      database,
      isGroupAdmin || isOwner || isSudo,
      metadataAvailable && isBotAdmin,
    )
  )
    return;

  const raw = message.message as unknown as Record<string, unknown>;
  const text = messageBody(raw);
  const prefix = database.getGlobalPrefix(config.prefixes[0] ?? "/");
  const parsed = parseCommand(text, [prefix, ...config.prefixes]);
  if (!parsed) return;
  const command = commands.get(parsed.name);
  if (!command) return;
  if (config.accessMode === "private" && !isOwner && isGroup) return;

  const quoted = quotedBody(raw);
  const context: CommandContext = {
    socket,
    config,
    database,
    chatId,
    senderJid,
    senderNumber,
    text: parsed.args,
    args: parsed.args ? parsed.args.split(/\s+/) : [],
    prefix: parsed.prefix,
    isGroup,
    isOwner,
    isSudo,
    isGroupAdmin,
    isBotAdmin,
    rawMessage: message,
    ...(quoted ? { quotedText: quoted } : {}),
    reply: async (body, mentions) => {
      await socket.sendMessage(chatId, { text: body, ...(mentions?.length ? { mentions } : {}) });
    },
    downloadMedia: async () => {
      if (containsViewOnce(raw)) throw new Error("View-once media is not processed.");
      const payload = unwrappedMessage(raw);
      const field = mediaTypes.find((name) => payload[name]);
      if (!field) throw new Error("Attach an image or supported media file to the command.");
      const item = payload[field] as { mimetype?: string } | undefined;
      return mediaDownloadLimiter.run(async () => {
        const stream = await downloadMediaMessage(message, "stream", {});
        const buffer = await collectLimitedStream(stream, config.media.maxBytes);
        return {
          buffer,
          mimeType: item?.mimetype || "application/octet-stream",
          kind: kindByField[field],
        };
      });
    },
  };
  await dispatchCommand(context, command, database);
}
