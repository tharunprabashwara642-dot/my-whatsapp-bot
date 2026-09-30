import { chmod, mkdir } from "node:fs/promises";
import {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeWASocket,
  useMultiFileAuthState,
  type WASocket,
} from "baileys";
import * as QRCode from "qrcode";
import type { AppConfig } from "../core/config";
import type { AppDatabase } from "../core/database";
import { discoverCommands } from "../core/command-loader";
import { logger } from "../core/logger";
import { handleMessage } from "../handlers/message-handler";
import { invalidateGroupMetadata } from "../services/group-cache";
import { handleParticipants } from "../services/group-policy";
import { WorkLimiter } from "../services/limiter";

export async function startWhatsApp(
  config: AppConfig,
  database: AppDatabase,
): Promise<() => Promise<void>> {
  process.umask(0o077);
  await mkdir(config.authDirectory, { recursive: true, mode: 0o700 });
  await chmod(config.authDirectory, 0o700).catch(() => undefined);
  const { state, saveCreds } = await useMultiFileAuthState(config.authDirectory);
  const { version } = await fetchLatestBaileysVersion();
  const commands = await discoverCommands();
  const messageLimiter = new WorkLimiter(8, 64);
  let socket: WASocket | undefined;
  let stopping = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;

  const connect = () => {
    if (stopping) return;
    const current = makeWASocket({
      version,
      auth: state,
      logger: logger.child({ component: "whatsapp" }) as never,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false,
      connectTimeoutMs: 60_000,
      keepAliveIntervalMs: 30_000,
    });
    socket = current;
    current.ev.on("creds.update", saveCreds);
    current.ev.on("connection.update", (update) => {
      if (socket !== current) return;
      if (update.qr) {
        void QRCode.toString(update.qr, { type: "terminal", small: true })
          .then((qr) =>
            process.stdout.write(`${qr}\nScan this code from WhatsApp > Linked devices.\n`),
          )
          .catch((error) => logger.error({ err: error }, "Could not render pairing QR"));
      }
      if (update.connection === "open") {
        attempt = 0;
        logger.info("WhatsApp link is active");
      }
      if (update.connection === "close") {
        const status = (
          update.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined
        )?.output?.statusCode;
        logger.warn({ status }, "WhatsApp connection closed");
        if (status === DisconnectReason.loggedOut) {
          logger.error("WhatsApp session was logged out; remove the saved session and pair again.");
          return;
        }
        if (stopping || reconnectTimer) return;
        const delay = Math.min(1_000 * 2 ** attempt, 60_000);
        attempt += 1;
        reconnectTimer = setTimeout(() => {
          reconnectTimer = undefined;
          connect();
        }, delay);
      }
    });
    current.ev.on("messages.upsert", ({ messages, type }) => {
      if (socket !== current || stopping || type !== "notify") return;
      for (const message of messages) {
        void messageLimiter
          .run(() => handleMessage(current, message, config, database, commands))
          .catch((error) =>
            logger.warn({ err: error }, "Message processing was skipped or failed"),
          );
      }
    });
    current.ev.on("group-participants.update", (event) => {
      if (socket !== current) return;
      invalidateGroupMetadata(event.id);
      void handleParticipants(
        current,
        {
          id: event.id,
          participants: event.participants.map((participant) =>
            typeof participant === "string" ? participant : participant.id,
          ),
          action: event.action,
        },
        database,
        config.name,
      ).catch((error) => logger.warn({ err: error }, "Group event handling failed"));
    });
  };

  connect();
  return async () => {
    stopping = true;
    messageLimiter.close();
    if (reconnectTimer) clearTimeout(reconnectTimer);
    socket?.end(undefined);
    await messageLimiter.drain();
  };
}
