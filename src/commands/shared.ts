import { fail } from "../errors";
import { OutputMode } from "../output";

export type ArgShape = { type?: "boolean" | "string" | "enum" | "positional"; alias?: string | string[] };

export const formatArg = {
  format: {
    type: "enum" as const,
    options: ["table", "json", "ndjson"],
    default: "table",
  },
};

export const createNameArgsDef = {
  name: { type: "string" as const },
  "input-json": { type: "string" as const },
  ...formatArg,
};

export const updateNameArgsDef = {
  id: { type: "string" as const },
  name: { type: "string" as const },
  "input-json": { type: "string" as const },
  ...formatArg,
};

export const listOnlyArgsDef = {
  ...formatArg,
};

function failUnknownFlags(rawArgs: string[], argsDef: Record<string, ArgShape>): void {
  const byName = new Map<string, ArgShape>();
  for (const [name, shape] of Object.entries(argsDef)) {
    byName.set(name, shape);
  }

  const allowed = new Set(byName.keys());
  for (const definition of Object.values(argsDef)) {
    const aliases = definition.alias ? (Array.isArray(definition.alias) ? definition.alias : [definition.alias]) : [];
    for (const alias of aliases) {
      allowed.add(alias);
      if (!byName.has(alias)) {
        byName.set(alias, definition);
      }
    }
  }

  const booleanFlags = new Set(
    Array.from(byName.entries())
      .filter(([, def]) => def.type === "boolean")
      .map(([name]) => name)
  );

  const unknown = new Set<string>();

  for (const token of rawArgs) {
    if (token === "--") {
      break;
    }

    if (token.startsWith("--")) {
      const longToken = token.slice(2).split("=", 1)[0] ?? "";
      if (!longToken) {
        continue;
      }
      const isNo = longToken.startsWith("no-");
      const key = isNo ? longToken.slice(3) : longToken;
      if (!allowed.has(key) || (isNo && !booleanFlags.has(key))) {
        unknown.add(`--${longToken}`);
      }
      continue;
    }

    if (token.startsWith("-") && token.length > 1) {
      unknown.add(token);
    }
  }

  if (unknown.size > 0) {
    const values = Array.from(unknown).sort();
    fail("E_USAGE", `Unknown option${values.length > 1 ? "s" : ""}: ${values.join(", ")}`);
  }
}

function parseOutputMode(args: Record<string, unknown>): OutputMode {
  const format = args.format;
  if (format === "json" || format === "ndjson" || format === "table") {
    return format;
  }
  return "table";
}

function parseInputJson(args: Record<string, unknown>): unknown {
  const raw = args["input-json"];
  if (raw === undefined) {
    return undefined;
  }
  if (typeof raw !== "string") {
    fail("E_USAGE", "Invalid JSON passed to --input-json");
  }
  try {
    return JSON.parse(raw);
  } catch {
    fail("E_USAGE", "Invalid JSON passed to --input-json");
  }
}

export function resolveName(args: Record<string, unknown>): string | undefined {
  return typeof args.name === "string" ? args.name : undefined;
}

export async function runWithIo(
  rawArgs: string[],
  args: Record<string, unknown>,
  argsDef: Record<string, ArgShape>,
  withInputJson: boolean,
  run: (io: { outputMode: OutputMode; inputJson?: unknown }) => Promise<void>
): Promise<void> {
  failUnknownFlags(rawArgs, argsDef);
  const io = {
    outputMode: parseOutputMode(args),
    inputJson: withInputJson ? parseInputJson(args) : undefined,
  };
  await run(io);
}
