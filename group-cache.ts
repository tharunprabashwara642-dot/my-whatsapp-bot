import type { GroupMetadata, WASocket } from "baileys";

const entries = new Map<string, { expiresAt: number; value: GroupMetadata }>();
const inFlight = new Map<string, Promise<GroupMetadata>>();
const ttlMs = 30_000;

export async function getGroupMetadata(socket: WASocket, jid: string): Promise<GroupMetadata> {
  const cached = entries.get(jid);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const pending = inFlight.get(jid);
  if (pending) return pending;
  const request = socket
    .groupMetadata(jid)
    .then((value) => {
      entries.set(jid, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => inFlight.delete(jid));
  inFlight.set(jid, request);
  return request;
}

export function invalidateGroupMetadata(jid: string): void {
  entries.delete(jid);
}
