import { defineCommand } from "../../core/types";

export default defineCommand({
  name: "help",
  aliases: ["menu"],
  category: "General",
  description: "Browse the active command catalogue.",
  usage: "/help [category]",
  cooldownSeconds: 2,
  async handler(context) {
    const { discoverCommands } = await import("../../core/command-loader");
    const registry = await discoverCommands();
    const unique = new Map([...registry.values()].map((command) => [command.name, command]));
    const filter = context.text.trim().toLowerCase();
    const groups = new Map<string, string[]>();
    for (const command of unique.values()) {
      if (filter && !command.category.toLowerCase().includes(filter)) continue;
      if (!context.isOwner && command.permission === "owner") continue;
      if (command.enabled === false || !context.database.isCommandEnabled(command.name)) continue;
      if (!context.isGroup && command.groupOnly) continue;
      if (context.isGroup && command.privateOnly) continue;
      const current = groups.get(command.category) ?? [];
      current.push(command.name);
      groups.set(command.category, current);
    }
    if (filter && groups.size === 0) {
      await context.reply(`No commands found in “${context.text.trim()}”.`);
      return;
    }
    const rows = [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([category, names]) =>
          `\n*${category}*\n${names
            .sort()
            .map((name) => `${context.prefix}${name}`)
            .join("  ")}`,
      )
      .join("\n");
    await context.reply(
      `✦ *${context.config.name}*\nA small toolkit for useful chats.\n${rows}\n\nUse ${context.prefix}help <category> to narrow the list.`,
    );
  },
});
