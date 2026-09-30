import { describe, expect, test } from "bun:test";
import { loadConfig } from "../src/core/config";
import type { CommandContext } from "../src/core/types";
import { createSticker } from "../src/services/media";

function onePixelBmp(): Buffer {
  const buffer = Buffer.alloc(58);
  buffer.write("BM", 0, "ascii");
  buffer.writeUInt32LE(58, 2);
  buffer.writeUInt32LE(54, 10);
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(1, 18);
  buffer.writeInt32LE(1, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(4, 34);
  buffer.set([0, 0, 255, 0], 54);
  return buffer;
}

describe("media conversion", () => {
  test("converts a bounded image to a WebP sticker", async () => {
    const config = loadConfig({ KITEFRAME_OWNER_NUMBERS: "15551234567" });
    const context = {
      config,
      downloadMedia: async () => ({ buffer: onePixelBmp(), mimeType: "image/bmp", kind: "image" }),
    } as unknown as CommandContext;
    const result = await createSticker(context);
    expect(result.byteLength).toBeGreaterThan(0);
    expect(result.toString("ascii", 0, 4)).toBe("RIFF");
    expect(result.toString("ascii", 8, 12)).toBe("WEBP");
  }, 30_000);
});
