import { describe, expect, test } from "bun:test";
import { loadConfig } from "../src/core/config";

describe("configuration", () => {
  test("requires an explicitly configured owner and provides safe AI defaults", () => {
    expect(() => loadConfig({})).toThrow("KITEFRAME_OWNER_NUMBERS");
    const config = loadConfig({ KITEFRAME_OWNER_NUMBERS: "+1 (555) 123-4567" });
    expect(config.owners).toEqual(["15551234567"]);
    expect(config.ai.provider).toBe("disabled");
    expect(config.ai.memoryEnabled).toBe(false);
  });
  test("validates provider, timezone, and bounded media configuration", () => {
    expect(() =>
      loadConfig({ KITEFRAME_OWNER_NUMBERS: "15551234567", KITEFRAME_AI_PROVIDER: "mystery" }),
    ).toThrow("KITEFRAME_AI_PROVIDER");
    expect(() =>
      loadConfig({ KITEFRAME_OWNER_NUMBERS: "15551234567", KITEFRAME_TIMEZONE: "Mars/NotAZone" }),
    ).toThrow("KITEFRAME_TIMEZONE");
    expect(() =>
      loadConfig({
        KITEFRAME_OWNER_NUMBERS: "15551234567",
        KITEFRAME_MEDIA_MAX_BYTES: "999999999",
      }),
    ).toThrow("numeric configuration");
    expect(() => loadConfig({ KITEFRAME_OWNER_NUMBERS: "not-a-number" })).toThrow(
      "international phone number",
    );
    expect(() =>
      loadConfig({ KITEFRAME_OWNER_NUMBERS: "15551234567", KITEFRAME_LOG_LEVEL: "not-a-level" }),
    ).toThrow("KITEFRAME_LOG_LEVEL");
    expect(() =>
      loadConfig({
        KITEFRAME_OWNER_NUMBERS: "15551234567",
        KITEFRAME_AI_PROVIDER: "openai-compatible",
        KITEFRAME_AI_ENDPOINT: "http://10.0.0.5/v1",
      }),
    ).toThrow("HTTPS");
    expect(
      loadConfig({ KITEFRAME_OWNER_NUMBERS: "15551234567", KITEFRAME_AI_PROVIDER: "gemini" }).ai
        .endpoint,
    ).toContain("generativelanguage.googleapis.com");
  });
});
