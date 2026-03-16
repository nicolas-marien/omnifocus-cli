import { fail } from "../errors";
import { Perspective, Task } from "../types";
import { jxaString, runOmniJs } from "./jxa";

function pickPerspectiveTargets(
  perspectives: Array<{ id: string; name: string }>,
  nameOrQuery: string,
): Array<{ id: string; name: string }> {
  const exact = perspectives.filter(
    (perspective) => perspective.name === nameOrQuery,
  );
  if (exact.length > 0) {
    return exact;
  }
  return perspectives.filter((perspective) =>
    perspective.name.toLowerCase().includes(nameOrQuery.toLowerCase()),
  );
}

export async function listPerspectives(): Promise<Perspective[]> {
  return runOmniJs<Perspective[]>(`
(() => {
  const builtins = [
    ["Inbox", Perspective.BuiltIn.Inbox],
    ["Projects", Perspective.BuiltIn.Projects],
    ["Tags", Perspective.BuiltIn.Tags],
    ["Forecast", Perspective.BuiltIn.Forecast],
    ["Flagged", Perspective.BuiltIn.Flagged],
    ["Nearby", Perspective.BuiltIn.Nearby],
    ["Review", Perspective.BuiltIn.Review],
    ["Search", Perspective.BuiltIn.Search]
  ]
    .filter((entry) => entry[1])
    .map(([builtinId, perspective]) => ({
      id: "builtin:" + builtinId,
      name: perspective.name,
      kind: "builtin"
    }));

  const customs = Perspective.Custom.all.map((perspective) => ({
    id: "custom:" + perspective.identifier,
    name: perspective.name,
    kind: "custom"
  }));

  return JSON.stringify(builtins.concat(customs));
})()
`);
}

export async function listPerspectiveRefs(): Promise<
  Array<{ id: string; name: string }>
> {
  const perspectives = await listPerspectives();
  return perspectives.map(({ id, name }) => ({ id, name }));
}

export async function resolvePerspectiveTargetId(
  args: Record<string, unknown>,
  inputJson?: unknown,
): Promise<string> {
  const payload =
    inputJson && typeof inputJson === "object"
      ? (inputJson as { id?: string; name?: string })
      : undefined;
  const id =
    (typeof payload?.id === "string" ? payload.id : undefined) ??
    (typeof args.id === "string" ? args.id : undefined);
  if (id) {
    return id;
  }

  const name =
    (typeof payload?.name === "string" ? payload.name : undefined) ??
    (typeof args.name === "string" ? args.name : undefined);
  if (!name) {
    fail("E_USAGE", "requires --id <id> or --name <value>");
  }

  const source = await listPerspectiveRefs();
  const matches = pickPerspectiveTargets(source, name);
  if (matches.length === 0) {
    fail("E_NO_MATCH", `No perspectives found for name '${name}'`, 2);
  }
  if (matches.length > 1) {
    fail("E_MULTI_MATCH", `Multiple perspectives match '${name}'. Use --id.`, 2);
  }
  const perspective = matches[0];
  if (!perspective) {
    fail("E_NO_MATCH", `No perspectives found for name '${name}'`, 2);
  }
  return perspective.id;
}

export async function listTasksInPerspective(id: string): Promise<Task[]> {
  return runOmniJs<Task[]>(`
(() => {
  function safeDate(value) {
    try {
      return value ? value.toISOString() : null;
    } catch (_error) {
      return null;
    }
  }

  function safeValue(getter, fallback) {
    try {
      return getter();
    } catch (_error) {
      return fallback;
    }
  }

  function resolvePerspective(targetId) {
    if (targetId.startsWith("builtin:")) {
      const key = targetId.slice("builtin:".length);
      const table = {
        Inbox: Perspective.BuiltIn.Inbox,
        Projects: Perspective.BuiltIn.Projects,
        Tags: Perspective.BuiltIn.Tags,
        Forecast: Perspective.BuiltIn.Forecast,
        Flagged: Perspective.BuiltIn.Flagged,
        Nearby: Perspective.BuiltIn.Nearby,
        Review: Perspective.BuiltIn.Review,
        Search: Perspective.BuiltIn.Search
      };
      return table[key] || null;
    }

    if (targetId.startsWith("custom:")) {
      const identifier = targetId.slice("custom:".length);
      return Perspective.Custom.byIdentifier(identifier);
    }

    return null;
  }

  function taskIdFor(task) {
    try {
      return task.id ? task.id.primaryKey : null;
    } catch (_error) {
      return null;
    }
  }

  function serializeTask(task) {
    const project = safeValue(() => task.containingProject, null);
    const tags = safeValue(() => task.tags.map((tag) => tag.name), []);
    return {
      id: safeValue(() => task.id.primaryKey, ""),
      name: safeValue(() => task.name, ""),
      note: safeValue(() => (task.note ? task.note.toString() : null), null),
      flagged: Boolean(safeValue(() => task.flagged, false)),
      blocked: Boolean(safeValue(() => task.blocked, false)),
      completed: Boolean(safeValue(() => task.completed, false)),
      dropped: Boolean(safeValue(() => task.dropped, false)),
      inInbox: Boolean(safeValue(() => task.inInbox, false)),
      project: project
        ? {
            id: safeValue(() => project.id.primaryKey, ""),
            name: safeValue(() => project.name, "")
          }
        : null,
      tags,
      deferAt: safeDate(safeValue(() => task.deferDate, null)),
      effectiveDeferAt: safeDate(safeValue(() => task.effectiveDeferDate, null)),
      plannedAt: safeDate(safeValue(() => task.plannedDate, null)),
      effectivePlannedAt: safeDate(safeValue(() => task.effectivePlannedDate, null)),
      dueAt: safeDate(safeValue(() => task.dueDate, null)),
      effectiveDueAt: safeDate(safeValue(() => task.effectiveDueDate, null)),
      completedAt: safeDate(safeValue(() => task.completionDate, null)),
      droppedAt: safeDate(safeValue(() => task.dropDate, null)),
      createdAt: safeDate(safeValue(() => task.added, null)),
      updatedAt: safeDate(safeValue(() => task.modified, null))
    };
  }

  function collectTasks(node, acc) {
    const object = safeValue(() => node.object, null);
    if (object) {
      if (object.constructor && object.constructor.name === "Task") {
        const id = taskIdFor(object);
        if (id) {
          acc.set(id, object);
        }
      } else if (object.task) {
        const embeddedTask = safeValue(() => object.task, null);
        const id = taskIdFor(embeddedTask);
        if (id) {
          acc.set(id, embeddedTask);
        }
      }
    }

    const children = safeValue(() => node.children, []);
    for (const child of children) {
      collectTasks(child, acc);
    }
  }

  const win = document.windows[0];
  if (!win) {
    throw new Error("No OmniFocus window is available");
  }

  const target = resolvePerspective(${jxaString(id)});
  if (!target) {
    throw new Error("Perspective not found for id: " + ${jxaString(id)});
  }

  const original = win.perspective;
  try {
    win.perspective = target;
    const tasks = new Map();
    collectTasks(win.content.rootNode, tasks);
    return JSON.stringify(Array.from(tasks.values()).map(serializeTask));
  } finally {
    try {
      win.perspective = original;
    } catch (_error) {
      // ignore restore failures
    }
  }
})()
`);
}
