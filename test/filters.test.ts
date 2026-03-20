import { describe, expect, it } from "vitest";
import { CliError } from "../src/errors";
import { applyFilters, parseFilter } from "../src/filters";
import { Task } from "../src/types";

const tasks: Task[] = [
  {
    id: "a",
    name: "Alpha Task",
    note: null,
    flagged: true,
    blocked: false,
    completed: false,
    dropped: false,
    inInbox: false,
    project: { id: "p1", name: "Project One" },
    tags: ["Work", "Ops"],
    deferAt: "2026-03-20T09:00:00.000Z",
    effectiveDeferAt: "2026-03-20T09:00:00.000Z",
    plannedAt: "2026-03-20T10:00:00.000Z",
    effectivePlannedAt: "2026-03-20T10:00:00.000Z",
    dueAt: "2026-03-21T10:00:00.000Z",
    effectiveDueAt: "2026-03-21T10:00:00.000Z",
    completedAt: null,
    droppedAt: null,
    createdAt: "2026-03-19T10:00:00.000Z",
    updatedAt: "2026-03-19T11:00:00.000Z",
  },
  {
    id: "b",
    name: "Beta Task",
    note: null,
    flagged: false,
    blocked: true,
    completed: false,
    dropped: false,
    inInbox: true,
    project: { id: "p2", name: "Project Two" },
    tags: ["Home"],
    deferAt: "2026-03-22T09:00:00.000Z",
    effectiveDeferAt: "2026-03-23T09:00:00.000Z",
    plannedAt: "2026-03-22T10:00:00.000Z",
    effectivePlannedAt: "2026-03-23T10:00:00.000Z",
    dueAt: "2026-03-25T10:00:00.000Z",
    effectiveDueAt: "2026-03-26T10:00:00.000Z",
    completedAt: null,
    droppedAt: null,
    createdAt: "2026-03-19T12:00:00.000Z",
    updatedAt: "2026-03-19T12:30:00.000Z",
  },
  {
    id: "c",
    name: "Gamma Task",
    note: null,
    flagged: false,
    blocked: false,
    completed: false,
    dropped: false,
    inInbox: false,
    project: null,
    tags: ["Errand"],
    deferAt: null,
    effectiveDeferAt: null,
    plannedAt: null,
    effectivePlannedAt: null,
    dueAt: null,
    effectiveDueAt: null,
    completedAt: null,
    droppedAt: null,
    createdAt: "2026-03-19T13:00:00.000Z",
    updatedAt: "2026-03-19T13:30:00.000Z",
  },
];

function expectCliError(fn: () => unknown, code: string): void {
  try {
    fn();
    throw new Error("Expected function to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).code).toBe(code);
  }
}

describe("parseFilter", () => {
  it("accepts valid JSON object", () => {
    const parsed = parseFilter('{"name":{"contains":"Alpha"}}');
    expect(parsed).toEqual({ name: { contains: "Alpha" } });
  });

  it("rejects invalid JSON payload", () => {
    expectCliError(() => parseFilter("{invalid"), "E_BAD_FILTER");
  });

  it("rejects non-object JSON payload", () => {
    expectCliError(() => parseFilter('"text"'), "E_BAD_FILTER");
  });
});

describe("applyFilters", () => {
  it("filters by ids and project name", () => {
    const out = applyFilters(tasks, {
      ids: ["a", "c"],
      project: { name: "Project One" },
    });
    expect(out.map((task) => task.id)).toEqual(["a"]);
  });

  it("matches tags case-insensitively with match-any semantics", () => {
    const out = applyFilters(tasks, { tags: ["ops", "home"] });
    expect(out.map((task) => task.id)).toEqual(["a", "b"]);
  });

  it("filters by flagged and blocked", () => {
    const out = applyFilters(tasks, { flagged: false, blocked: true });
    expect(out.map((task) => task.id)).toEqual(["b"]);
  });

  it("uses effective planned date when requested", () => {
    const out = applyFilters(
      tasks,
      {
        planned: { before: "2026-03-23T00:00:00.000Z" },
      },
      true,
    );
    expect(out.map((task) => task.id)).toEqual(["a"]);
  });

  it("applies positive integer limit", () => {
    const out = applyFilters(tasks, { limit: 2 });
    expect(out.map((task) => task.id)).toEqual(["a", "b"]);
  });

  it("rejects invalid limit values", () => {
    expectCliError(() => applyFilters(tasks, { limit: 0 }), "E_BAD_FILTER");
    expectCliError(() => applyFilters(tasks, { limit: 1.2 }), "E_BAD_FILTER");
  });
});
