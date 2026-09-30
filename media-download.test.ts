import { describe, expect, test } from "bun:test";
import { Readable } from "node:stream";
import { collectLimitedStream } from "../src/services/media-download";

describe("streaming media limit", () => {
  test("collects within limit and rejects oversized content", async () => {
    const collected = await collectLimitedStream(
      Readable.from([Buffer.from("abc"), Buffer.from("de")]),
      5,
    );
    expect(collected.toString()).toBe("abcde");
    await expect(
      collectLimitedStream(Readable.from([Buffer.alloc(4), Buffer.alloc(4)]), 5),
    ).rejects.toThrow("too large");
  });
});
