import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { logger } from "./logger";
import type { CommandDefinition, RegisteredCommand } from "./types";

const commandRoot = join(import.meta.dir, "..", "commands");

export async function discoverCommands(
  root = commandRoot,
): Promise<Map<string, RegisteredCommand>> {
  const files: string[] = [];
  async function walk(directory: string): Promise<void> {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      if (item.name.startsWith("_")) continue;
      const path = join(directory, item.name);
      if (item.isDirectory()) await walk(path);
      else if (item.isFile() && item.name.endsWith(".ts") && !item.name.endsWith(".test.ts"))
        files.push(path);
    }
  }
  await walk(root);
  files.sort();
  const commands = new Map<string, RegisteredCommand>();
  for (const file of files) {
    const module = (await import(pathToFileURL(file).href)) as { default?: CommandDefinition };
    const command = module.default;
    if (
      !command ||
      typeof command.handler !== "function" ||
      !command.name ||
      !command.category ||
      !command.description
    ) {
      throw new Error(`Invalid command module: ${relative(root, file)}`);
    }
    const primary = command.name.toLowerCase().trim();
    const triggers = new Set([
      primary,
      ...(command.aliases ?? []).map((item) => item.toLowerCase().trim()),
    ]);
    for (const trigger of triggers) {
      if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(trigger))
        throw new Error(`Invalid command trigger "${trigger}" in ${relative(root, file)}`);
      if (commands.has(trigger))
        throw new Error(`Duplicate command trigger "${trigger}" in ${relative(root, file)}`);
      commands.set(trigger, { ...command, trigger });
    }
  }
  logger.info({ modules: files.length, triggers: commands.size }, "Command catalogue ready");
  return commands;
}
