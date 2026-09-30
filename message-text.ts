export interface ParsedCommand {
  prefix: string;
  name: string;
  args: string;
}

export function parseCommand(text: string, prefixes: string[]): ParsedCommand | null {
  const trimmed = text.trim();
  const prefix = prefixes
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .find((value) => trimmed.startsWith(value));
  if (!prefix) return null;
  const body = trimmed.slice(prefix.length).trim();
  if (!body) return null;
  const separator = body.search(/\s/);
  const name = (separator < 0 ? body : body.slice(0, separator)).toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(name)) return null;
  return { prefix, name, args: separator < 0 ? "" : body.slice(separator).trim() };
}

export function messageBody(message: Record<string, unknown> | undefined): string {
  if (!message) return "";
  const conversation = message.conversation;
  if (typeof conversation === "string") return conversation;
  const extended = message.extendedTextMessage as { text?: unknown } | undefined;
  if (typeof extended?.text === "string") return extended.text;
  for (const field of [
    "imageMessage",
    "videoMessage",
    "documentMessage",
    "buttonsResponseMessage",
    "listResponseMessage",
  ]) {
    const item = message[field] as { caption?: unknown; selectedDisplayText?: unknown } | undefined;
    if (typeof item?.caption === "string") return item.caption;
    if (typeof item?.selectedDisplayText === "string") return item.selectedDisplayText;
  }
  for (const wrapper of [
    "ephemeralMessage",
    "viewOnceMessage",
    "viewOnceMessageV2",
    "viewOnceMessageV2Extension",
  ]) {
    const nested = message[wrapper] as { message?: Record<string, unknown> } | undefined;
    if (nested?.message) return messageBody(nested.message);
  }
  return "";
}

export function quotedBody(message: Record<string, unknown> | undefined): string | undefined {
  const extended = message?.extendedTextMessage as
    { contextInfo?: { quotedMessage?: Record<string, unknown> } } | undefined;
  const text = messageBody(extended?.contextInfo?.quotedMessage);
  return text || undefined;
}
