import { defineCommand } from "citty";
import { fail } from "./errors";
import { applyFilters, parseFilter } from "./filters";
import { OutputMode, printOutput } from "./output";
import { createProject, listProjects, renameProjectById } from "./omni/projects";
import { createTag, listTags, renameTagById } from "./omni/tags";
import { completeTasksByIds, createTask, listTaskRefs, listTasks } from "./omni/tasks";
import { CreateTaskInput, TaskBucket, TaskFilter } from "./types";

const buckets = new Set<TaskBucket>(["available", "remaining", "inbox", "completed", "dropped", "all"]);

type ArgShape = { type?: "boolean" | "string" | "enum" | "positional"; alias?: string | string[] };

function warnUnknownFlags(rawArgs: string[], argsDef: Record<string, ArgShape>): void {
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
    const values = Array.from(unknown);
    process.stderr.write(`W_USAGE: ignoring unknown option${values.length > 1 ? "s" : ""} ${values.join(", ")}\n`);
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

function resolveName(args: Record<string, unknown>, positionalKey: string): string | undefined {
  return (typeof args.name === "string" ? args.name : undefined) ??
    (typeof args[positionalKey] === "string" ? (args[positionalKey] as string) : undefined);
}

async function runWithIo(
  rawArgs: string[],
  args: Record<string, unknown>,
  argsDef: Record<string, ArgShape>,
  withInputJson: boolean,
  run: (io: { outputMode: OutputMode; inputJson?: unknown }) => Promise<void>
): Promise<void> {
  warnUnknownFlags(rawArgs, argsDef);
  const io = {
    outputMode: parseOutputMode(args),
    inputJson: withInputJson ? parseInputJson(args) : undefined,
  };
  await run(io);
}

function pickCompletionTargets(tasks: Array<{ id: string; name: string }>, nameOrQuery: string): Array<{ id: string; name: string }> {
  const exact = tasks.filter((task) => task.name === nameOrQuery);
  if (exact.length > 0) {
    return exact;
  }
  return tasks.filter((task) => task.name.toLowerCase().includes(nameOrQuery.toLowerCase()));
}

function mergeListFilter(args: Record<string, unknown>): TaskFilter {
  const filterRaw = typeof args.filter === "string" ? args.filter : undefined;
  const base = parseFilter(filterRaw);
  const effective = Boolean(args.effective);

  const planned = {
    ...(base.planned ?? {}),
    on: typeof args["planned-on"] === "string" ? (args["planned-on"] as string) : base.planned?.on,
    before: typeof args["planned-before"] === "string" ? (args["planned-before"] as string) : base.planned?.before,
    after: typeof args["planned-after"] === "string" ? (args["planned-after"] as string) : base.planned?.after,
    useEffective: effective || base.planned?.useEffective,
  };

  return {
    ...base,
    planned:
      planned.on || planned.before || planned.after || planned.useEffective
        ? {
            ...planned,
          }
        : undefined,
  };
}

function parseCreateInput(args: Record<string, unknown>, namePositional?: string, inputJson?: unknown): CreateTaskInput {
  if (inputJson && typeof inputJson === "object") {
    const payload = inputJson as Partial<CreateTaskInput>;
    if (!payload.name) {
      fail("E_USAGE", "create JSON payload requires 'name'");
    }
    return {
      name: payload.name,
      note: payload.note,
      flagged: payload.flagged,
      projectName: payload.projectName,
      tags: payload.tags ?? [],
      deferAt: payload.deferAt,
      plannedAt: payload.plannedAt,
      dueAt: payload.dueAt,
    };
  }

  const name = (typeof args.name === "string" ? args.name : undefined) ?? namePositional;
  if (!name) {
    fail("E_USAGE", "create requires --name <value> or positional name");
  }

  const tagsRaw = typeof args.tags === "string" ? args.tags : undefined;
  const tags = tagsRaw ? tagsRaw.split(",").map((tag) => tag.trim()).filter(Boolean) : [];

  return {
    name,
    note: typeof args.note === "string" ? args.note : undefined,
    flagged: Boolean(args.flagged),
    projectName: typeof args.project === "string" ? args.project : undefined,
    tags,
    deferAt: typeof args.defer === "string" ? args.defer : undefined,
    plannedAt: typeof args.planned === "string" ? args.planned : undefined,
    dueAt: typeof args.due === "string" ? args.due : undefined,
  };
}

const formatArg = {
  format: {
    type: "enum" as const,
    options: ["table", "json", "ndjson"],
    default: "table",
  },
};

const listArgsDef = {
  bucket: { type: "positional" as const, required: false },
  filter: { type: "string" as const },
  effective: { type: "boolean" as const },
  "planned-on": { type: "string" as const },
  "planned-before": { type: "string" as const },
  "planned-after": { type: "string" as const },
  ...formatArg,
};

const createArgsDef = {
  namePositional: { type: "positional" as const, required: false },
  name: { type: "string" as const },
  "input-json": { type: "string" as const },
  note: { type: "string" as const },
  flagged: { type: "boolean" as const },
  project: { type: "string" as const },
  tags: { type: "string" as const },
  defer: { type: "string" as const },
  planned: { type: "string" as const },
  due: { type: "string" as const },
  ...formatArg,
};

const completeArgsDef = {
  namePositional: { type: "positional" as const, required: false },
  "input-json": { type: "string" as const },
  id: { type: "string" as const },
  name: { type: "string" as const },
  "dry-run": { type: "boolean" as const },
  yes: { type: "boolean" as const },
  ...formatArg,
};

const createNameArgsDef = {
  namePositional: { type: "positional" as const, required: false },
  name: { type: "string" as const },
  ...formatArg,
};

const updateNameArgsDef = {
  id: { type: "string" as const },
  name: { type: "string" as const },
  ...formatArg,
};

const listOnlyArgsDef = {
  ...formatArg,
};

export const mainCommand = defineCommand({
  meta: {
    name: "of",
    description: "OmniFocus CLI",
  },
  subCommands: {
    list: defineCommand({
      meta: { name: "list", description: "List tasks" },
      args: listArgsDef,
      async run(ctx) {
        await runWithIo(ctx.rawArgs, ctx.args as Record<string, unknown>, listArgsDef, false, async ({ outputMode }) => {
          const bucketRaw = typeof ctx.args.bucket === "string" ? ctx.args.bucket : undefined;
          const bucket = bucketRaw && buckets.has(bucketRaw as TaskBucket) ? (bucketRaw as TaskBucket) : "available";
          const tasks = await listTasks(bucket);
          const filter = mergeListFilter(ctx.args as Record<string, unknown>);
          const filtered = applyFilters(tasks, filter, Boolean(ctx.args.effective));
          printOutput(filtered, outputMode);
        });
      },
    }),
    create: defineCommand({
      meta: { name: "create", description: "Create task" },
      args: createArgsDef,
      async run(ctx) {
        await runWithIo(ctx.rawArgs, ctx.args as Record<string, unknown>, createArgsDef, true, async ({ outputMode, inputJson }) => {
          const input = parseCreateInput(ctx.args as Record<string, unknown>, ctx.args.namePositional, inputJson);
          const task = await createTask(input);
          printOutput(task, outputMode);
        });
      },
    }),
    complete: defineCommand({
      meta: { name: "complete", description: "Complete task(s)" },
      args: completeArgsDef,
      async run(ctx) {
        await runWithIo(ctx.rawArgs, ctx.args as Record<string, unknown>, completeArgsDef, true, async ({ outputMode, inputJson }) => {
          const idsRaw = typeof ctx.args.id === "string" ? ctx.args.id : undefined;
          let targetIds = idsRaw
            ? idsRaw
                .split(",")
                .map((id) => id.trim())
                .filter(Boolean)
            : [];

          if (inputJson && typeof inputJson === "object") {
            const payload = inputJson as { ids?: string[]; name?: string };
            if (payload.ids?.length) {
              targetIds = payload.ids;
            } else if (payload.name) {
              const source = await listTaskRefs();
              const matches = pickCompletionTargets(source, payload.name);
              if (matches.length === 0) {
                fail("E_NO_MATCH", `No tasks found for name '${payload.name}'`, 2);
              }
              if (matches.length > 1) {
                fail("E_MULTI_MATCH", `Multiple tasks match '${payload.name}'. Use --id.`, 2);
              }
              const task = matches[0];
              if (!task) {
                fail("E_NO_MATCH", `No tasks found for name '${payload.name}'`, 2);
              }
              targetIds = [task.id];
            }
          }

          if (targetIds.length === 0) {
            const nameOrQuery = resolveName(ctx.args as Record<string, unknown>, "namePositional");
            if (!nameOrQuery) {
              fail("E_USAGE", "complete requires --id <id[,id]> or --name <value>");
            }
            const source = await listTaskRefs();
            const matches = pickCompletionTargets(source, nameOrQuery);
            if (matches.length === 0) {
              fail("E_NO_MATCH", `No tasks found for name '${nameOrQuery}'`, 2);
            }
            if (matches.length > 1) {
              fail("E_MULTI_MATCH", `Multiple tasks match '${nameOrQuery}'. Use --id.`, 2);
            }
            const task = matches[0];
            if (!task) {
              fail("E_NO_MATCH", `No tasks found for name '${nameOrQuery}'`, 2);
            }
            targetIds = [task.id];
          }

          if (ctx.args["dry-run"]) {
            printOutput({ dryRun: true, ids: targetIds }, outputMode);
            return;
          }

          if (targetIds.length > 1 && !ctx.args.yes) {
            fail("E_USAGE", "Refusing to complete multiple tasks without --yes");
          }

          const result = await completeTasksByIds(targetIds);
          printOutput(result, outputMode);
        });
      },
    }),
    projects: defineCommand({
      meta: { name: "projects", description: "Manage projects" },
      subCommands: {
        list: defineCommand({
          meta: { name: "list", description: "List projects" },
          args: listOnlyArgsDef,
          async run(ctx) {
            await runWithIo(ctx.rawArgs, ctx.args as Record<string, unknown>, listOnlyArgsDef, false, async ({ outputMode }) => {
              printOutput(await listProjects(), outputMode);
            });
          },
        }),
        create: defineCommand({
          meta: { name: "create", description: "Create project" },
          args: createNameArgsDef,
          async run(ctx) {
            await runWithIo(ctx.rawArgs, ctx.args as Record<string, unknown>, createNameArgsDef, false, async ({ outputMode }) => {
              const name = resolveName(ctx.args as Record<string, unknown>, "namePositional");
              if (!name) {
                fail("E_USAGE", "projects create requires --name <value>");
              }
              printOutput(await createProject(name), outputMode);
            });
          },
        }),
        update: defineCommand({
          meta: { name: "update", description: "Update project" },
          args: updateNameArgsDef,
          async run(ctx) {
            await runWithIo(ctx.rawArgs, ctx.args as Record<string, unknown>, updateNameArgsDef, false, async ({ outputMode }) => {
              const id = typeof ctx.args.id === "string" ? ctx.args.id : undefined;
              const name = typeof ctx.args.name === "string" ? ctx.args.name : undefined;
              if (!id || !name) {
                fail("E_USAGE", "projects update requires --id <id> --name <value>");
              }
              const updated = await renameProjectById(id, name);
              if (!updated) {
                fail("E_NO_MATCH", `No project found for id '${id}'`, 2);
              }
              printOutput(updated, outputMode);
            });
          },
        }),
      },
    }),
    tags: defineCommand({
      meta: { name: "tags", description: "Manage tags" },
      subCommands: {
        list: defineCommand({
          meta: { name: "list", description: "List tags" },
          args: listOnlyArgsDef,
          async run(ctx) {
            await runWithIo(ctx.rawArgs, ctx.args as Record<string, unknown>, listOnlyArgsDef, false, async ({ outputMode }) => {
              printOutput(await listTags(), outputMode);
            });
          },
        }),
        create: defineCommand({
          meta: { name: "create", description: "Create tag" },
          args: createNameArgsDef,
          async run(ctx) {
            await runWithIo(ctx.rawArgs, ctx.args as Record<string, unknown>, createNameArgsDef, false, async ({ outputMode }) => {
              const name = resolveName(ctx.args as Record<string, unknown>, "namePositional");
              if (!name) {
                fail("E_USAGE", "tags create requires --name <value>");
              }
              printOutput(await createTag(name), outputMode);
            });
          },
        }),
        update: defineCommand({
          meta: { name: "update", description: "Update tag" },
          args: updateNameArgsDef,
          async run(ctx) {
            await runWithIo(ctx.rawArgs, ctx.args as Record<string, unknown>, updateNameArgsDef, false, async ({ outputMode }) => {
              const id = typeof ctx.args.id === "string" ? ctx.args.id : undefined;
              const name = typeof ctx.args.name === "string" ? ctx.args.name : undefined;
              if (!id || !name) {
                fail("E_USAGE", "tags update requires --id <id> --name <value>");
              }
              const updated = await renameTagById(id, name);
              if (!updated) {
                fail("E_NO_MATCH", `No tag found for id '${id}'`, 2);
              }
              printOutput(updated, outputMode);
            });
          },
        }),
      },
    }),
  },
});
