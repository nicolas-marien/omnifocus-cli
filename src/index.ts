#!/usr/bin/env node

import { type CommandDef, renderUsage, runCommand } from "citty";
import { mainCommand } from "./cli";
import { CliError } from "./errors";

async function resolveUsageCommand(cmd: CommandDef, rawArgs: string[], parent?: CommandDef): Promise<[CommandDef, CommandDef | undefined]> {
  const resolvedSubCommands = typeof cmd.subCommands === "function" ? await cmd.subCommands() : cmd.subCommands;
  const subCommands = resolvedSubCommands as Record<string, CommandDef> | undefined;
  if (subCommands && Object.keys(subCommands).length > 0) {
    const subCommandArgIndex = rawArgs.findIndex((arg) => !arg.startsWith("-"));
    const subCommandName = rawArgs[subCommandArgIndex];
    if (subCommandName && subCommands[subCommandName]) {
      const subCommand = subCommands[subCommandName];
      return resolveUsageCommand(subCommand, rawArgs.slice(subCommandArgIndex + 1), cmd);
    }
  }
  return [cmd, parent];
}

function isCittyUsageError(error: Error): boolean {
  return (
    error.message.startsWith("Unknown command") ||
    error.message === "No command specified." ||
    error.message.startsWith("Missing required argument") ||
    error.message.startsWith("Missing required positional argument")
  );
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    const [cmd, parent] = await resolveUsageCommand(mainCommand, rawArgs);
    process.stdout.write(`${await renderUsage(cmd, parent)}\n`);
    return;
  }
  await runCommand(mainCommand, { rawArgs });
}

main().catch(async (error: unknown) => {
  if (error instanceof CliError) {
    process.stderr.write(`${error.code}: ${error.message}\n`);
    process.exit(error.exitCode);
  }

  if (error instanceof Error && isCittyUsageError(error)) {
    const rawArgs = process.argv.slice(2);
    const [cmd, parent] = await resolveUsageCommand(mainCommand, rawArgs);
    process.stderr.write(`${await renderUsage(cmd, parent)}\n`);
    process.stderr.write(`E_USAGE: ${error.message}\n`);
    process.exit(1);
  }

  if (error instanceof Error) {
    process.stderr.write(`E_UNKNOWN: ${error.message}\n`);
  } else {
    process.stderr.write("E_UNKNOWN: unknown error\n");
  }
  process.exit(1);
});
