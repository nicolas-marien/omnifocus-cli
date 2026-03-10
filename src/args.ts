import { fail } from "./errors";
import { OutputMode } from "./output";
import { TaskBucket } from "./types";

export type ParsedArgs = {
  command: string;
  subcommand?: string;
  bucket?: TaskBucket;
  options: Record<string, string | boolean>;
  positionals: string[];
  outputMode: OutputMode;
  inputJson?: unknown;
};

const buckets = new Set<TaskBucket>(["available", "remaining", "inbox", "completed", "dropped", "all"]);

export function parseArgs(argv: string[]): ParsedArgs {
  if (argv.length === 0) {
    return {
      command: "help",
      options: {},
      positionals: [],
      outputMode: "table",
    };
  }

  const command = argv[0] as string;
  const rest = argv.slice(1);
  const positionals: string[] = [];
  const options: Record<string, string | boolean> = {};
  let outputMode: OutputMode = "table";
  let inputJson: unknown;

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (!arg) {
      continue;
    }

    if (arg === "--json") {
      const next = rest[i + 1];
      if (next && !next.startsWith("--")) {
        try {
          inputJson = JSON.parse(next);
        } catch {
          fail("E_USAGE", "Invalid JSON passed to --json");
        }
        options.jsonInput = true;
        i += 1;
      } else {
        outputMode = "json";
        options.jsonOutput = true;
      }
      continue;
    }

    if (arg === "--ndjson") {
      outputMode = "ndjson";
      options.ndjson = true;
      continue;
    }

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith("--")) {
        options[key] = next;
        i += 1;
      } else {
        options[key] = true;
      }
      continue;
    }

    positionals.push(arg);
  }

  let bucket: TaskBucket | undefined;
  let subcommand: string | undefined;

  if (command === "list" && positionals[0] && buckets.has(positionals[0] as TaskBucket)) {
    bucket = positionals[0] as TaskBucket;
    positionals.shift();
  }

  if ((command === "projects" || command === "tags") && positionals[0]) {
    subcommand = positionals.shift() as string;
  }

  return {
    command,
    subcommand,
    bucket,
    options,
    positionals,
    outputMode,
    inputJson,
  };
}
