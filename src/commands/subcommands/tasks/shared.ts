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
  bucket: { type: "positional" as const, required: false },
  filter: { type: "string" as const },
  effective: { type: "boolean" as const },
  "planned-on": { type: "string" as const },
  "planned-before": { type: "string" as const },
  "planned-after": { type: "string" as const },
  ...formatArg,
};

export const createArgsDef = {
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

export const completeArgsDef = {
  namePositional: { type: "positional" as const, required: false },
  "input-json": { type: "string" as const },
  id: { type: "string" as const },
  name: { type: "string" as const },
  "dry-run": { type: "boolean" as const },
  yes: { type: "boolean" as const },
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
  namePositional?: string,
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

  const name =
    (typeof args.name === "string" ? args.name : undefined) ?? namePositional;
  if (!name) {
    fail("E_USAGE", "create requires --name <value> or positional name");
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
