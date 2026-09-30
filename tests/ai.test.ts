import { afterEach, describe, expect, test, mock } from "bun:test";
import { loadConfig } from "../src/core/config";
import { completeAI } from "../src/services/ai";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("AI provider router", () => {
  test("sends OpenAI-compatible requests and returns text", async () => {
    const config = loadConfig({
      KITEFRAME_OWNER_NUMBERS: "15551234567",
      KITEFRAME_AI_PROVIDER: "openai-compatible",
      KITEFRAME_AI_API_KEY: "test-key",
    });
    let seen: Request | undefined;
    globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      seen = new Request(input, init);
      return new Response(JSON.stringify({ choices: [{ message: { content: "hello" } }] }), {
        status: 200,
      });
    }) as unknown as typeof fetch;
    expect(await completeAI(config, "test")).toBe("hello");
    expect(seen?.headers.get("authorization")).toBe("Bearer test-key");
    expect(seen?.url).toBe("https://api.openai.com/v1/chat/completions");
  });
  test("supports Gemini without placing its key in the URL", async () => {
    const config = loadConfig({
      KITEFRAME_OWNER_NUMBERS: "15551234567",
      KITEFRAME_AI_PROVIDER: "gemini",
      KITEFRAME_AI_API_KEY: "test-key",
    });
    let seen: Request | undefined;
    globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      seen = new Request(input, init);
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: "vision" }] } }] }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    expect(
      await completeAI(config, "describe", [], { mimeType: "image/jpeg", base64: "AA==" }),
    ).toBe("vision");
    expect(seen?.headers.get("x-goog-api-key")).toBe("test-key");
    expect(seen?.url).not.toContain("test-key");
  });
  test("rejects oversized provider response bodies", async () => {
    const config = loadConfig({
      KITEFRAME_OWNER_NUMBERS: "15551234567",
      KITEFRAME_AI_PROVIDER: "openai-compatible",
      KITEFRAME_AI_API_KEY: "test-key",
    });
    globalThis.fetch = mock(
      async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: "x".repeat(1_100_000) } }] }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;
    await expect(completeAI(config, "test")).rejects.toThrow("exceeded the allowed size");
  });
  test("does not call a provider when AI is disabled", async () => {
    const config = loadConfig({ KITEFRAME_OWNER_NUMBERS: "15551234567" });
    await expect(completeAI(config, "test")).rejects.toThrow("AI is disabled");
  });
});
