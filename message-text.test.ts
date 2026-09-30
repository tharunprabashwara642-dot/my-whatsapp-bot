import { describe, expect, test } from "bun:test";
import { messageBody, parseCommand, quotedBody } from "../src/core/message-text";

describe("command parsing", () => {
  test("chooses the longest allowed prefix", () => {
    expect(parseCommand("//help group", ["/", "//"])).toEqual({
      prefix: "//",
      name: "help",
      args: "group",
    });
  });
  test("rejects regular chat text and invalid triggers", () => {
    expect(parseCommand("hello there", ["/"])).toBeNull();
    expect(parseCommand("/💥", ["/"])).toBeNull();
  });
  test("extracts common message text and quoted content", () => {
    expect(messageBody({ extendedTextMessage: { text: "/ping" } })).toBe("/ping");
    expect(
      quotedBody({
        extendedTextMessage: { contextInfo: { quotedMessage: { conversation: "original" } } },
      }),
    ).toBe("original");
  });
});
