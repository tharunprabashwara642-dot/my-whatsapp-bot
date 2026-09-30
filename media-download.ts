import type { Readable } from "node:stream";

export async function collectLimitedStream(stream: Readable, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  const timer = setTimeout(() => stream.destroy(new Error("Media download timed out.")), 30_000);
  try {
    for await (const chunk of stream) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
      size += buffer.byteLength;
      if (size > maxBytes) {
        stream.destroy();
        throw new Error("The attached file is too large.");
      }
      chunks.push(buffer);
    }
  } catch (error) {
    stream.destroy();
    throw error;
  } finally {
    clearTimeout(timer);
  }
  return Buffer.concat(chunks, size);
}
