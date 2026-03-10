import { parseFilter, applyFilters } from "./filters";
import { OutputMode, printOutput } from "./output";
import { completeTasksByIds, createTask, listTaskRefs, listTasks } from "./omni/tasks";
import { createProject, listProjects, renameProjectById } from "./omni/projects";
import { createTag, listTags, renameTagById } from "./omni/tags";
import { fail } from "./errors";
import { ParsedArgs } from "./args";
import { CreateTaskInput, Task, TaskBucket, TaskFilter } from "./types";

function asString(value: string | boolean | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function mergeListFilter(parsed: ParsedArgs): TaskFilter {
  const base = parseFilter(asString(parsed.options.filter));
  const effective = Boolean(parsed.options.effective);

  const planned = {
    ...(base.planned ?? {}),
    on: asString(parsed.options["planned-on"]) ?? base.planned?.on,
    before: asString(parsed.options["planned-before"]) ?? base.planned?.before,
    after: asString(parsed.options["planned-after"]) ?? base.planned?.after,
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

function parseCreateInput(parsed: ParsedArgs): CreateTaskInput {
  if (parsed.inputJson && typeof parsed.inputJson === "object") {
    const payload = parsed.inputJson as Partial<CreateTaskInput>;
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

  const name = asString(parsed.options.name) ?? parsed.positionals[0];
  if (!name) {
    fail("E_USAGE", "create requires --name <value> or positional name");
  }

  const tagsRaw = asString(parsed.options.tags);
  const tags = tagsRaw ? tagsRaw.split(",").map((tag) => tag.trim()).filter(Boolean) : [];

  return {
    name,
    note: asString(parsed.options.note),
    flagged: Boolean(parsed.options.flagged),
    projectName: asString(parsed.options.project),
    tags,
    deferAt: asString(parsed.options.defer),
    plannedAt: asString(parsed.options.planned),
    dueAt: asString(parsed.options.due),
  };
}

function pickCompletionTargets(tasks: Array<{ id: string; name: string }>, nameOrQuery: string): Array<{ id: string; name: string }> {
  const exact = tasks.filter((task) => task.name === nameOrQuery);
  if (exact.length > 0) {
    return exact;
  }
  return tasks.filter((task) => task.name.toLowerCase().includes(nameOrQuery.toLowerCase()));
}

export async function runCommand(parsed: ParsedArgs): Promise<void> {
  const outputMode = parsed.outputMode;

  switch (parsed.command) {
    case "list": {
      const bucket: TaskBucket = parsed.bucket ?? "available";
      const tasks = await listTasks(bucket);
      const filter = mergeListFilter(parsed);
      const filtered = applyFilters(tasks, filter, Boolean(parsed.options.effective));
      printOutput(filtered, outputMode);
      return;
    }

    case "create": {
      const input = parseCreateInput(parsed);
      const task = await createTask(input);
      printOutput(task, outputMode);
      return;
    }

    case "complete": {
      const idsRaw = asString(parsed.options.id);
      let targetIds = idsRaw
        ? idsRaw
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean)
        : [];

      if (parsed.inputJson && typeof parsed.inputJson === "object") {
        const payload = parsed.inputJson as { ids?: string[]; name?: string };
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
        const nameOrQuery = asString(parsed.options.name) ?? parsed.positionals[0];
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

      if (parsed.options["dry-run"]) {
        printOutput({ dryRun: true, ids: targetIds }, outputMode);
        return;
      }

      if (targetIds.length > 1 && !parsed.options.yes) {
        fail("E_USAGE", "Refusing to complete multiple tasks without --yes");
      }

      const result = await completeTasksByIds(targetIds);
      printOutput(result, outputMode);
      return;
    }

    case "projects": {
      const subcommand = parsed.subcommand ?? "list";
      if (subcommand === "list") {
        printOutput(await listProjects(), outputMode);
        return;
      }
      if (subcommand === "create") {
        const name = asString(parsed.options.name) ?? parsed.positionals[0];
        if (!name) {
          fail("E_USAGE", "projects create requires --name <value>");
        }
        printOutput(await createProject(name), outputMode);
        return;
      }
      if (subcommand === "update") {
        const id = asString(parsed.options.id);
        const name = asString(parsed.options.name);
        if (!id || !name) {
          fail("E_USAGE", "projects update requires --id <id> --name <value>");
        }
        const updated = await renameProjectById(id, name);
        if (!updated) {
          fail("E_NO_MATCH", `No project found for id '${id}'`, 2);
        }
        printOutput(updated, outputMode);
        return;
      }
      fail("E_USAGE", `Unsupported projects subcommand '${subcommand}'`);
    }

    case "tags": {
      const subcommand = parsed.subcommand ?? "list";
      if (subcommand === "list") {
        printOutput(await listTags(), outputMode);
        return;
      }
      if (subcommand === "create") {
        const name = asString(parsed.options.name) ?? parsed.positionals[0];
        if (!name) {
          fail("E_USAGE", "tags create requires --name <value>");
        }
        printOutput(await createTag(name), outputMode);
        return;
      }
      if (subcommand === "update") {
        const id = asString(parsed.options.id);
        const name = asString(parsed.options.name);
        if (!id || !name) {
          fail("E_USAGE", "tags update requires --id <id> --name <value>");
        }
        const updated = await renameTagById(id, name);
        if (!updated) {
          fail("E_NO_MATCH", `No tag found for id '${id}'`, 2);
        }
        printOutput(updated, outputMode);
        return;
      }
      fail("E_USAGE", `Unsupported tags subcommand '${subcommand}'`);
    }

    case "help":
    default:
      printHelp(outputMode);
  }
}

function printHelp(outputMode: OutputMode): void {
  const text = [
    "of - OmniFocus CLI",
    "",
    "Commands:",
    "  of list [available|remaining|inbox|completed|dropped|all] [--filter '{...}'] [--effective] [--json|--ndjson]",
    "  of create --name <name> [--planned <date>] [--defer <date>] [--due <date>] [--project <name>] [--tags a,b] [--json '<payload>']",
    "  of complete --id <id[,id]> | --name <name> [--dry-run] [--json|--ndjson]",
    "  of projects list|create|update ...",
    "  of tags list|create|update ...",
  ].join("\n");

  if (outputMode === "json" || outputMode === "ndjson") {
    printOutput({ help: text }, outputMode);
    return;
  }
  process.stdout.write(`${text}\n`);
}
