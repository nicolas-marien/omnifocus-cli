#!/usr/bin/env node

import { parseArgs } from "./args";
import { runCommand } from "./commands";
import { CliError } from "./errors";

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  await runCommand(parsed);
}

main().catch((error: unknown) => {
  if (error instanceof CliError) {
    process.stderr.write(`${error.code}: ${error.message}\n`);
    process.exit(error.exitCode);
  }

  if (error instanceof Error) {
    process.stderr.write(`E_UNKNOWN: ${error.message}\n`);
  } else {
    process.stderr.write("E_UNKNOWN: unknown error\n");
  }
  process.exit(1);
});
