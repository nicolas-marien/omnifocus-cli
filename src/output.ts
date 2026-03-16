import { Project, Tag, Task } from "./types";

export type OutputMode = "table" | "json" | "ndjson";

export function printOutput(data: unknown, mode: OutputMode): void {
  if (mode === "json") {
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
    return;
  }

  if (mode === "ndjson") {
    if (Array.isArray(data)) {
      for (const item of data) {
        process.stdout.write(`${JSON.stringify(item)}\n`);
      }
      return;
    }
    process.stdout.write(`${JSON.stringify(data)}\n`);
    return;
  }

  if (Array.isArray(data) && data.length > 0 && isTask(data[0])) {
    renderTaskTable(data as Task[]);
    return;
  }

  if (Array.isArray(data) && data.length > 0 && isProject(data[0])) {
    renderProjectTable(data as Project[]);
    return;
  }

  if (Array.isArray(data) && data.length > 0 && isTag(data[0])) {
    renderTagTable(data as Tag[]);
    return;
  }

  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

function isTask(value: unknown): value is Task {
  return Boolean(value && typeof value === "object" && "id" in value && "completed" in value && "inInbox" in value);
}

function isProject(value: unknown): value is Project {
  return Boolean(value && typeof value === "object" && "id" in value && "status" in value && "plannedAt" in value);
}

function isTag(value: unknown): value is Tag {
  return Boolean(value && typeof value === "object" && "id" in value && "name" in value);
}

function renderTaskTable(tasks: Task[]): void {
  for (const task of tasks) {
    const state = task.completed ? "completed" : task.dropped ? "dropped" : task.inInbox ? "inbox" : task.blocked ? "blocked" : "available";
    process.stdout.write(`${task.id}\t${state}\t${task.name}\n`);
  }
}

function renderProjectTable(projects: Project[]): void {
  for (const project of projects) {
    process.stdout.write(`${project.id}\t${project.status}\t${project.name}\n`);
  }
}

function renderTagTable(tags: Tag[]): void {
  for (const tag of tags) {
    process.stdout.write(`${tag.id}\t${tag.name}\n`);
  }
}
