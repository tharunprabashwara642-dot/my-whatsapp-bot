import type { WASocket } from "baileys";
import type { AppConfig } from "./config";
import type { AppDatabase } from "./database";

export type Permission = "user" | "group-admin" | "owner";

export interface CommandContext {
  socket: WASocket;
  config: AppConfig;
  database: AppDatabase;
  chatId: string;
  senderJid: string;
  senderNumber: string;
  text: string;
  args: string[];
  prefix: string;
  isGroup: boolean;
  isOwner: boolean;
  isSudo: boolean;
  isGroupAdmin: boolean;
  isBotAdmin: boolean;
  rawMessage: import("baileys").WAMessage;
  quotedText?: string;
  reply(text: string, mentions?: string[]): Promise<void>;
  downloadMedia(): Promise<{
    buffer: Buffer;
    mimeType: string;
    kind: "image" | "video" | "audio" | "document" | "sticker";
  }>;
}

export interface CommandDefinition {
  name: string;
  aliases?: string[];
  category: string;
  description: string;
  usage?: string;
  permission?: Permission;
  groupOnly?: boolean;
  privateOnly?: boolean;
  botAdmin?: boolean;
  cooldownSeconds?: number;
  enabled?: boolean;
  handler(context: CommandContext): Promise<void>;
}

export function defineCommand(command: CommandDefinition): CommandDefinition {
  return command;
}

export interface RegisteredCommand extends CommandDefinition {
  trigger: string;
}
