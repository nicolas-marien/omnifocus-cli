import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { printOutput } from "../src/output";
import { Perspective, Project, Tag, Task } from "../src/types";

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "t-1",
    name: "Task",
    note: null,
    flagged: false,
    blocked: false,
    completed: false,
    dropped: false,
    inInbox: false,
    project: null,
    tags: [],
    deferAt: null,
    effectiveDeferAt: null,
    plannedAt: null,
    effectivePlannedAt: null,
    dueAt: null,
    effectiveDueAt: null,
    completedAt: null,
    droppedAt: null,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

describe("printOutput", () => {
  let out = "";

  beforeEach(() => {
    out = "";
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
      out += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders task table with state precedence", () => {
    const tasks: Task[] = [
      makeTask({ id: "t1", name: "Done", completed: true }),
      makeTask({ id: "t2", name: "Dropped", dropped: true }),
      makeTask({ id: "t3", name: "Inbox", inInbox: true, blocked: true }),
      makeTask({ id: "t4", name: "Blocked", blocked: true }),
      makeTask({ id: "t5", name: "Available" }),
    ];

    printOutput(tasks, "table");

    expect(out).toMatchSnapshot();
  });

  it("renders project table", () => {
    const projects: Project[] = [
      {
        id: "p1",
        name: "Website",
        status: "active",
        plannedAt: null,
        effectivePlannedAt: null,
      },
    ];

    printOutput(projects, "table");

    expect(out).toMatchSnapshot();
  });

  it("renders tag table", () => {
    const tags: Tag[] = [{ id: "g1", name: "urgent" }];

    printOutput(tags, "table");

    expect(out).toMatchSnapshot();
  });

  it("renders perspective table", () => {
    const perspectives: Perspective[] = [{ id: "ps1", name: "Today", kind: "builtin" }];

    printOutput(perspectives, "table");

    expect(out).toMatchSnapshot();
  });

  it("renders JSON mode with pretty formatting", () => {
    printOutput({ ok: true, count: 2 }, "json");

    expect(out).toMatchSnapshot();
  });

  it("renders NDJSON mode for arrays", () => {
    printOutput([{ id: 1 }, { id: 2 }], "ndjson");

    expect(out).toMatchSnapshot();
  });

  it("renders NDJSON mode for single objects", () => {
    printOutput({ id: 1, ok: true }, "ndjson");

    expect(out).toMatchSnapshot();
  });

  it("falls back to JSON for empty arrays in table mode", () => {
    printOutput([], "table");

    expect(out).toBe("[]\n");
  });

  it("falls back to pretty JSON for unknown objects in table mode", () => {
    printOutput({ hello: "world" }, "table");

    expect(out).toBe(`{\n  "hello": "world"\n}\n`);
  });
});
