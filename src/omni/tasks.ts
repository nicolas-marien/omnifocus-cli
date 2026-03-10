import { fail } from "../errors";
import { CreateTaskInput, Task, TaskBucket } from "../types";
import { jxaString, runJxa } from "./jxa";

function taskCollectorExpression(bucket: TaskBucket): string {
  switch (bucket) {
    case "available":
      return "doc.flattenedTasks().filter(t => !t.completed() && !t.dropped() && !t.blocked())";
    case "remaining":
      return "doc.flattenedTasks().filter(t => !t.completed() && !t.dropped())";
    case "inbox":
      return "doc.inboxTasks().filter(t => !t.completed() && !t.dropped())";
    case "completed":
      return "doc.flattenedTasks().filter(t => t.completed())";
    case "dropped":
      return "doc.flattenedTasks().filter(t => t.dropped())";
    case "all":
      return "doc.flattenedTasks()";
    default:
      fail("E_USAGE", `Unsupported bucket: ${bucket}`);
  }
}

export async function listTasks(bucket: TaskBucket): Promise<Task[]> {
  const collector = taskCollectorExpression(bucket);
  return runJxa<Task[]>(`
const omnifocus = Application("OmniFocus");
const doc = omnifocus.defaultDocument();

function safeDateFrom(getter) {
  try {
    const value = getter();
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

const tasks = ${collector};

const data = tasks.map(t => {
  try {
    const project = safeValue(() => t.containingProject(), null);
    const tags = safeValue(() => (t.tags ? t.tags().map(tag => tag.name()) : []), []);

    return {
      id: safeValue(() => t.id(), ""),
      name: safeValue(() => t.name(), ""),
      note: safeValue(() => (t.note ? t.note().toString() : null), null),
      flagged: safeValue(() => t.flagged(), false),
      blocked: safeValue(() => t.blocked(), false),
      completed: safeValue(() => t.completed(), false),
      dropped: safeValue(() => t.dropped(), false),
      inInbox: safeValue(() => t.inInbox(), false),
      project: project ? { id: safeValue(() => project.id(), ""), name: safeValue(() => project.name(), "") } : null,
      tags,
      deferAt: safeDateFrom(() => t.deferDate()),
      effectiveDeferAt: safeDateFrom(() => t.effectiveDeferDate()),
      plannedAt: safeDateFrom(() => t.plannedDate()),
      effectivePlannedAt: safeDateFrom(() => t.effectivePlannedDate()),
      dueAt: safeDateFrom(() => t.dueDate()),
      effectiveDueAt: safeDateFrom(() => t.effectiveDueDate()),
      completedAt: safeDateFrom(() => t.completionDate()),
      droppedAt: safeDateFrom(() => t.droppedDate()),
      createdAt: safeDateFrom(() => t.creationDate()),
      updatedAt: safeDateFrom(() => t.modificationDate())
    };
  } catch (_error) {
    return null;
  }
}).filter(Boolean);

return JSON.stringify(data);
`);
}

export async function listTaskRefs(): Promise<Array<{ id: string; name: string }>> {
  return runJxa<Array<{ id: string; name: string }>>(`
const omnifocus = Application("OmniFocus");
const doc = omnifocus.defaultDocument();
const tasks = doc.flattenedTasks().map(task => ({ id: task.id(), name: task.name() }));
return JSON.stringify(tasks);
`);
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const name = jxaString(input.name);
  const note = input.note ? `task.note = ${jxaString(input.note)};` : "";
  const flagged = input.flagged ? "task.flagged = true;" : "";
  const deferAt = input.deferAt ? `task.deferDate = new Date(${jxaString(input.deferAt)});` : "";
  const plannedAt = input.plannedAt ? `task.plannedDate = new Date(${jxaString(input.plannedAt)});` : "";
  const dueAt = input.dueAt ? `task.dueDate = new Date(${jxaString(input.dueAt)});` : "";

  const script = `
const omnifocus = Application("OmniFocus");
const doc = omnifocus.defaultDocument();
const task = omnifocus.Task({ name: ${name} });
${note}
${flagged}
${deferAt}
${plannedAt}
${dueAt}
doc.inboxTasks().push(task);

if (${jxaString(input.projectName ?? "")}) {
  const projectName = ${jxaString(input.projectName ?? "")};
  const projects = doc.flattenedProjects();
  const project = projects.find(p => p.name() === projectName);
  if (project) {
    task.assignedContainer = project;
  }
}

const tagNames = ${JSON.stringify(input.tags ?? [])};
if (tagNames.length > 0) {
  for (const tagName of tagNames) {
    const tags = doc.flattenedTags().filter(tag => tag.name() === tagName);
    let tag = tags[0];
    if (!tag) {
      tag = omnifocus.Tag({ name: tagName });
      doc.tags().push(tag);
    }
    omnifocus.add(tag, { to: task.tags() });
  }
}

function safeDate(value) {
  return value ? value.toISOString() : null;
}

return JSON.stringify({
  id: task.id(),
  name: task.name(),
  note: task.note() ? task.note().toString() : null,
  flagged: task.flagged(),
  blocked: task.blocked(),
  completed: task.completed(),
  dropped: task.dropped(),
  inInbox: task.inInbox(),
  project: task.containingProject() ? { id: task.containingProject().id(), name: task.containingProject().name() } : null,
  tags: task.tags() ? task.tags().map(tag => tag.name()) : [],
  deferAt: safeDate(task.deferDate()),
  effectiveDeferAt: safeDate(task.effectiveDeferDate()),
  plannedAt: safeDate(task.plannedDate()),
  effectivePlannedAt: safeDate(task.effectivePlannedDate()),
  dueAt: safeDate(task.dueDate()),
  effectiveDueAt: safeDate(task.effectiveDueDate()),
  completedAt: safeDate(task.completionDate()),
  droppedAt: safeDate(task.droppedDate()),
  createdAt: safeDate(task.creationDate()),
  updatedAt: safeDate(task.modificationDate())
});
`;

  return runJxa<Task>(script);
}

export async function completeTasksByIds(taskIds: string[]): Promise<{ completedIds: string[] }> {
  const idsLiteral = JSON.stringify(taskIds);
  return runJxa<{ completedIds: string[] }>(`
const omnifocus = Application("OmniFocus");
const doc = omnifocus.defaultDocument();
const ids = ${idsLiteral};

const completedIds = [];
for (const id of ids) {
  const task = doc.flattenedTasks.byId(id);
  if (!task) {
    continue;
  }
  omnifocus.markComplete(task);
  completedIds.push(id);
}
return JSON.stringify({ completedIds });
`);
}
