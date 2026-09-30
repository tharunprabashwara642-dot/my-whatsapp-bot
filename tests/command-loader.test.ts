import { describe, expect, test } from "bun:test";
import { discoverCommands } from "../src/core/command-loader";
import { AppDatabase } from "../src/core/database";
import type { CommandContext } from "../src/core/types";

describe("command plugin catalogue", () => {
  test("loads unique command triggers with metadata", async () => {
    const commands = await discoverCommands();
    expect(commands.size).toBeGreaterThan(10);
    expect(commands.get("menu")?.name).toBe("help");
    expect(commands.get("kick")?.permission).toBe("group-admin");
  });
  test("help omits disabled and owner-only commands from non-owners", async () => {
    const commands = await discoverCommands();
    const database = await AppDatabase.open(":memory:");
    database.setCommandEnabled("ask", false);
    let menu = "";
    const context = {
      database,
      prefix: "/",
      text: "",
      args: [],
      isOwner: false,
      isSudo: true,
      isGroup: false,
      config: { name: "Kiteframe" },
      reply: async (text: string) => {
        menu = text;
      },
    } as unknown as CommandContext;
    await commands.get("help")?.handler(context);
    expect(menu).not.toContain("/ask");
    expect(menu).not.toContain("/prefix");
    expect(menu).not.toContain("/feature");
    await database.close();
  });
});
