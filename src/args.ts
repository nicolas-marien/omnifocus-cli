import { parseArgs as parseCittyArgs, type ArgsDef } from "citty";
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

const listArgsDef = {
  filter: { type: "string" },
  effective: { type: "boolean" },
  "planned-on": { type: "string" },
  "planned-before": { type: "string" },
  "planned-after": { type: "string" },
  json: { type: "string" },
  ndjson: { type: "boolean" },
} satisfies ArgsDef;

const createArgsDef = {
  name: { type: "string" },
  note: { type: "string" },
  flagged: { type: "boolean" },
  project: { type: "string" },
  tags: { type: "string" },
  defer: { type: "string" },
  planned: { type: "string" },
  due: { type: "string" },
  json: { type: "string" },
  ndjson: { type: "boolean" },
} satisfies ArgsDef;

const completeArgsDef = {
  id: { type: "string" },
  name: { type: "string" },
  "dry-run": { type: "boolean" },
  yes: { type: "boolean" },
  json: { type: "string" },
  ndjson: { type: "boolean" },
} satisfies ArgsDef;

const projectsTagsArgsDef = {
  id: { type: "string" },
  name: { type: "string" },
  json: { type: "string" },
  ndjson: { type: "boolean" },
} satisfies ArgsDef;

const helpArgsDef = {
  json: { type: "string" },
  ndjson: { type: "boolean" },
} satisfies ArgsDef;

function parseKnownOptions(rawArgs: string[], argsDef: ArgsDef): Record<string, string | boolean> {
  const parsed = parseCittyArgs(rawArgs, argsDef) as Record<string, unknown>;
  const options: Record<string, string | boolean> = {};

  for (const key of Object.keys(argsDef)) {
    if (key === "json" || key === "ndjson") {
      continue;
    }
    const value = parsed[key];
    if (typeof value === "string" || typeof value === "boolean") {
      options[key] = value;
    }
  }

  return options;
}

function parsePositionals(rawArgs: string[], argsDef: ArgsDef): string[] {
  const parsed = parseCittyArgs(rawArgs, argsDef) as { _: unknown[] };
  return parsed._.map((value) => String(value));
}

function validateStrictFlags(rawArgs: string[], argsDef: ArgsDef): void {
  const allowed = new Set(Object.keys(argsDef));
  const booleanFlags = new Set(
    Object.entries(argsDef)
      .filter(([, def]) => def.type === "boolean")
      .map(([name]) => name)
  );

  for (const token of rawArgs) {
    if (token === "--") {
      return;
    }

    if (token.startsWith("--")) {
      const longToken = token.slice(2).split("=", 1)[0] ?? "";
      if (!longToken) {
        continue;
      }
      const isNo = longToken.startsWith("no-");
      const key = isNo ? longToken.slice(3) : longToken;

      if (!allowed.has(key)) {
        fail("E_USAGE", `Unknown option --${longToken}`);
      }

      if (isNo && !booleanFlags.has(key)) {
        fail("E_USAGE", `Unknown option --${longToken}`);
      }

      continue;
    }

    if (token.startsWith("-") && token.length > 1) {
      fail("E_USAGE", `Unknown option ${token}`);
    }
  }
}

function parseOutputAndInput(rawArgs: string[]): {
  outputMode: OutputMode;
  inputJson?: unknown;
  jsonInput?: boolean;
  jsonOutput?: boolean;
  ndjson?: boolean;
} {
  let outputMode: OutputMode = "table";
  let inputJson: unknown;
  let jsonInput = false;
  let jsonOutput = false;
  let ndjson = false;

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (!arg) {
      continue;
    }

    if (arg === "--json") {
      const next = rawArgs[i + 1];
      if (next && !next.startsWith("--")) {
        try {
          inputJson = JSON.parse(next);
        } catch {
          fail("E_USAGE", "Invalid JSON passed to --json");
        }
        jsonInput = true;
        i += 1;
      } else {
        outputMode = "json";
        jsonOutput = true;
      }
      continue;
    }

    if (arg === "--ndjson") {
      outputMode = "ndjson";
      ndjson = true;
    }
  }

  return {
    outputMode,
    inputJson,
    jsonInput: jsonInput || undefined,
    jsonOutput: jsonOutput || undefined,
    ndjson: ndjson || undefined,
  };
}

function enforceSubcommandOptionRules(command: "projects" | "tags", subcommand: string, options: Record<string, string | boolean>): void {
  const hasId = Object.prototype.hasOwnProperty.call(options, "id");
  const hasName = Object.prototype.hasOwnProperty.call(options, "name");

  if (subcommand === "list") {
    if (hasId || hasName) {
      fail("E_USAGE", `${command} list does not accept --id or --name`);
    }
    return;
  }

  if (subcommand === "create") {
    if (hasId) {
      fail("E_USAGE", `${command} create does not accept --id`);
    }
    return;
  }

  if (subcommand === "update") {
    return;
  }

  if (subcommand) {
    if (hasId || hasName) {
      fail("E_USAGE", `Unsupported ${command} subcommand '${subcommand}'`);
    }
  }
}

export function parseArgs(argv: string[]): ParsedArgs {
  const normalizedArgv = argv[0] === "--" ? argv.slice(1) : argv;

  if (normalizedArgv.length === 0) {
    return {
      command: "help",
      options: {},
      positionals: [],
      outputMode: "table",
    };
  }

  const command = normalizedArgv[0] as string;
  const rest = normalizedArgv.slice(1);
  let argsDef: ArgsDef | undefined;

  switch (command) {
    case "list":
      argsDef = listArgsDef;
      break;
    case "create":
      argsDef = createArgsDef;
      break;
    case "complete":
      argsDef = completeArgsDef;
      break;
    case "projects":
    case "tags":
      argsDef = projectsTagsArgsDef;
      break;
    case "help":
      argsDef = helpArgsDef;
      break;
    default:
      if (command.startsWith("-")) {
        fail("E_USAGE", `Unknown option ${command}`);
      }
  }

  const options: Record<string, string | boolean> = argsDef ? parseKnownOptions(rest, argsDef) : {};
  const positionals = argsDef ? parsePositionals(rest, argsDef) : [...rest];

  if (argsDef) {
    validateStrictFlags(rest, argsDef);
  }

  const io = parseOutputAndInput(rest);
  let outputMode = io.outputMode;
  const inputJson = io.inputJson;

  if (io.jsonInput) {
    options.jsonInput = true;
  }
  if (io.jsonOutput) {
    options.jsonOutput = true;
  }
  if (io.ndjson) {
    options.ndjson = true;
  }

  let bucket: TaskBucket | undefined;
  let subcommand: string | undefined;

  if (command === "list" && positionals[0] && buckets.has(positionals[0] as TaskBucket)) {
    bucket = positionals[0] as TaskBucket;
    positionals.shift();
  }

  if ((command === "projects" || command === "tags") && positionals[0]) {
    subcommand = positionals.shift() as string;
    enforceSubcommandOptionRules(command, subcommand, options);
  } else if (command === "projects" || command === "tags") {
    enforceSubcommandOptionRules(command, "list", options);
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
