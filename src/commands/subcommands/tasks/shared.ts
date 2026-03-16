import { fail } from "../../../errors";
import { parseFilter } from "../../../filters";
import { CreateTaskInput, TaskBucket, TaskFilter } from "../../../types";
import { formatArg } from "../../shared";

export const buckets = new Set<TaskBucket>([
  "available",
  "remaining",
  "inbox",
  "completed",
  "dropped",
  "all",
]);

export const listArgsDef = {
  status: {
    type: "string" as const,
    description: "Task bucket to list",
    valueHint: "available|remaining|inbox|completed|dropped|all",
  },
  filter: {
    type: "string" as const,
    description: "JSON filter object",
    valueHint: "json",
  },
  effective: {
    type: "boolean" as const,
    description: "Use effective dates in date filtering",
  },
  "planned-on": {
    type: "string" as const,
    description: "Match planned date on exact day",
    valueHint: "YYYY-MM-DD|datetime",
  },
  "planned-before": {
    type: "string" as const,
    description: "Match planned date before instant/day",
    valueHint: "YYYY-MM-DD|datetime",
  },
  "planned-after": {
    type: "string" as const,
    description: "Match planned date after instant/day",
    valueHint: "YYYY-MM-DD|datetime",
  },
  ...formatArg,
};

export const createArgsDef = {
  name: {
    type: "string" as const,
    description: "Task name (required unless --input-json is provided)",
    valueHint: "name",
  },
  "input-json": {
    type: "string" as const,
    description: "JSON payload for command input",
    valueHint: "json",
  },
  note: {
    type: "string" as const,
    description: "Task note",
    valueHint: "text",
  },
  flagged: {
    type: "boolean" as const,
    description: "Mark task flagged",
  },
  project: {
    type: "string" as const,
    description: "Project name to assign",
    valueHint: "project-name",
  },
  tags: {
    type: "string" as const,
    description: "Comma-separated tag names",
    valueHint: "tag1,tag2",
  },
  defer: {
    type: "string" as const,
    description: "Defer date or datetime",
    valueHint: "YYYY-MM-DD|datetime",
  },
  planned: {
    type: "string" as const,
    description: "Planned date or datetime",
    valueHint: "YYYY-MM-DD|datetime",
  },
  due: {
    type: "string" as const,
    description: "Due date or datetime",
    valueHint: "YYYY-MM-DD|datetime",
  },
  ...formatArg,
};

export const completeArgsDef = {
  "input-json": {
    type: "string" as const,
    description: "JSON payload with ids[] or name",
    valueHint: "json",
  },
  id: {
    type: "string" as const,
    description: "Task id or comma-separated ids",
    valueHint: "id[,id]",
  },
  name: {
    type: "string" as const,
    description: "Task name or name fragment",
    valueHint: "name",
  },
  "dry-run": {
    type: "boolean" as const,
    description: "Print target ids without completing",
  },
  yes: {
    type: "boolean" as const,
    description: "Confirm multi-task completion",
  },
  ...formatArg,
};

export function pickCompletionTargets(
  tasks: Array<{ id: string; name: string }>,
  nameOrQuery: string,
): Array<{ id: string; name: string }> {
  const exact = tasks.filter((task) => task.name === nameOrQuery);
  if (exact.length > 0) {
    return exact;
  }
  return tasks.filter((task) =>
    task.name.toLowerCase().includes(nameOrQuery.toLowerCase()),
  );
}

export function mergeListFilter(args: Record<string, unknown>): TaskFilter {
  const filterRaw = typeof args.filter === "string" ? args.filter : undefined;
  const base = parseFilter(filterRaw);
  const effective = Boolean(args.effective);

  const planned = {
    ...(base.planned ?? {}),
    on:
      typeof args["planned-on"] === "string"
        ? (args["planned-on"] as string)
        : base.planned?.on,
    before:
      typeof args["planned-before"] === "string"
        ? (args["planned-before"] as string)
        : base.planned?.before,
    after:
      typeof args["planned-after"] === "string"
        ? (args["planned-after"] as string)
        : base.planned?.after,
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

export function parseCreateInput(
  args: Record<string, unknown>,
  inputJson?: unknown,
): CreateTaskInput {
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

  const name = typeof args.name === "string" ? args.name : undefined;
  if (!name) {
    fail("E_USAGE", "create requires --name <value>");
  }

  const tagsRaw = typeof args.tags === "string" ? args.tags : undefined;
  const tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : [];

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

export function parseListStatus(args: Record<string, unknown>): TaskBucket {
  const raw = typeof args.status === "string" ? args.status.trim().toLowerCase() : "";
  if (!raw) {
    return "available";
  }
  if (!buckets.has(raw as TaskBucket)) {
    fail("E_USAGE", "tasks list --status accepts only available, remaining, inbox, completed, dropped, all");
  }
  return raw as TaskBucket;
}
