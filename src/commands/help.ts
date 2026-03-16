import { type ArgsDef, type CommandDef, defineCommand, renderUsage } from "citty";
import { fail } from "../errors";
import { runWithIo } from "./shared";

type JsonArg = {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  default?: unknown;
  options?: string[];
  valueHint?: string;
  aliases?: string[];
};

type JsonSubCommand = {
  name: string;
  path: string;
  description?: string;
  command?: JsonCommand;
};

type JsonCommand = {
  name: string;
  path: string;
  description?: string;
  args: JsonArg[];
  subcommands: JsonSubCommand[];
};

type CommandTreeNode = {
  cmd: CommandDef<any>;
  parent?: CommandDef<any>;
  segments: string[];
};

const helpArgsDef = {
  command: {
    type: "positional" as const,
    required: false,
    description: "Top-level command name",
  },
  subcommand: {
    type: "positional" as const,
    required: false,
    description: "Nested subcommand name",
  },
  json: {
    type: "boolean" as const,
    description: "Emit machine-readable command metadata",
  },
  recursive: {
    type: "boolean" as const,
    description: "Include nested subcommands in JSON output",
  },
};

type Resolvable<T> = T | Promise<T> | (() => T) | (() => Promise<T>);

async function resolveValue<T>(value: Resolvable<T> | undefined): Promise<T | undefined> {
  if (typeof value === "function") {
    const resolver = value as (() => T) | (() => Promise<T>);
    return await resolver();
  }
  return await value;
}

function toPath(segments: string[]): string {
  return `of${segments.length > 0 ? ` ${segments.join(" ")}` : ""}`;
}

function pickPositionalSegments(args: Record<string, unknown>): string[] {
  const fromUnderscore = Array.isArray(args._)
    ? args._.filter((part): part is string => typeof part === "string")
    : [];
  if (fromUnderscore.length > 0) {
    return fromUnderscore;
  }

  const segments: string[] = [];
  if (typeof args.command === "string") {
    segments.push(args.command);
  }
  if (typeof args.subcommand === "string") {
    segments.push(args.subcommand);
  }
  return segments;
}

async function resolveTreeNode(main: CommandDef<any>, segments: string[]): Promise<CommandTreeNode> {
  let current: CommandTreeNode = { cmd: main, segments: [] };

  for (const segment of segments) {
    const subCommands = (await resolveValue(current.cmd.subCommands)) as
      | Record<string, Resolvable<CommandDef<any>>>
      | undefined;
    if (!subCommands || Object.keys(subCommands).length === 0) {
      fail("E_USAGE", `Command '${toPath(current.segments)}' does not accept subcommands`);
    }

    const next = subCommands[segment];
    if (!next) {
      fail("E_NO_MATCH", `Unknown command '${segment}' in '${toPath(current.segments)}'`, 2);
    }

    current = {
      cmd: (await resolveValue(next)) as CommandDef<any>,
      parent: current.cmd,
      segments: [...current.segments, segment],
    };
  }

  return current;
}

function toJsonArg(name: string, arg: Record<string, unknown>): JsonArg {
  const type = typeof arg.type === "string" ? arg.type : "string";
  const hasDefault = Object.prototype.hasOwnProperty.call(arg, "default");
  const required =
    type === "positional"
      ? arg.required !== false && !hasDefault
      : arg.required === true && !hasDefault;

  return {
    name,
    type,
    required,
    ...(typeof arg.description === "string" ? { description: arg.description } : {}),
    ...(hasDefault ? { default: arg.default } : {}),
    ...(Array.isArray(arg.options) ? { options: arg.options.filter((option): option is string => typeof option === "string") } : {}),
    ...(typeof arg.valueHint === "string" ? { valueHint: arg.valueHint } : {}),
    ...(typeof arg.alias === "string" || Array.isArray(arg.alias)
      ? {
          aliases: (Array.isArray(arg.alias) ? arg.alias : [arg.alias]).filter(
            (alias): alias is string => typeof alias === "string",
          ),
        }
      : {}),
  };
}

async function toJsonCommand(node: CommandTreeNode, recursive: boolean): Promise<JsonCommand> {
  const meta = (await resolveValue(node.cmd.meta)) as Record<string, unknown> | undefined;
  const argsDef = (await resolveValue(node.cmd.args)) as Record<string, Record<string, unknown>> | undefined;
  const subCommandsDef = (await resolveValue(node.cmd.subCommands)) as
    | Record<string, Resolvable<CommandDef<any>>>
    | undefined;

  const args = argsDef
    ? Object.entries(argsDef).map(([name, arg]) => toJsonArg(name, arg))
    : [];

  const subcommands: JsonSubCommand[] = [];
  if (subCommandsDef) {
    for (const [name, subCommand] of Object.entries(subCommandsDef)) {
      const resolvedSub = (await resolveValue(subCommand)) as CommandDef<any>;
      const resolvedMeta = (await resolveValue(resolvedSub.meta)) as Record<string, unknown> | undefined;
      const childSegments = [...node.segments, name];
      subcommands.push({
        name,
        path: toPath(childSegments),
        ...(typeof resolvedMeta?.description === "string" ? { description: resolvedMeta.description } : {}),
        ...(recursive
          ? {
              command: await toJsonCommand(
                {
                  cmd: resolvedSub,
                  parent: node.cmd,
                  segments: childSegments,
                },
                true,
              ),
            }
          : {}),
      });
    }
  }

  return {
    name: typeof meta?.name === "string" ? meta.name : node.segments[node.segments.length - 1] ?? "of",
    path: toPath(node.segments),
    ...(typeof meta?.description === "string" ? { description: meta.description } : {}),
    args,
    subcommands,
  };
}

export function createHelpCommand(getMainCommand: () => CommandDef<ArgsDef>): CommandDef<any> {
  return defineCommand({
    meta: {
      name: "help",
      description: "Show command help for humans or agents",
    },
    args: helpArgsDef,
    async run(ctx) {
      await runWithIo(
        ctx.rawArgs,
        ctx.args as Record<string, unknown>,
        helpArgsDef,
        false,
        async () => {
          const args = ctx.args as Record<string, unknown>;
          const recursive = Boolean(args.recursive);
          const asJson = Boolean(args.json);
          if (recursive && !asJson) {
            fail("E_USAGE", "help --recursive requires --json");
          }

          const segments = pickPositionalSegments(args);
          const target = await resolveTreeNode(getMainCommand(), segments);
          if (asJson) {
            process.stdout.write(`${JSON.stringify(await toJsonCommand(target, recursive), null, 2)}\n`);
            return;
          }

          process.stdout.write(`${await renderUsage(target.cmd, target.parent)}\n`);
        },
      );
    },
  });
}
