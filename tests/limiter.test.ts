import { describe, expect, test } from "bun:test";
import { WorkLimiter } from "../src/services/limiter";

describe("bounded work queue", () => {
  test("limits concurrency, drains active work, and rejects queued work on shutdown", async () => {
    const limiter = new WorkLimiter(1, 1);
    let complete: (() => void) | undefined;
    const first = limiter.run(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    const queued = limiter.run(() => "queued");
    const overflow = limiter.run(() => "overflow");
    await expect(overflow).rejects.toThrow("queue is full");
    limiter.close();
    await expect(queued).rejects.toThrow("shutting down");
    let drained = false;
    const drain = limiter.drain().then(() => {
      drained = true;
    });
    await Promise.resolve();
    expect(drained).toBe(false);
    complete?.();
    await first;
    await drain;
    expect(drained).toBe(true);
  });
});
