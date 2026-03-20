import { describe, expect, it } from "vitest";
import { CliError } from "../src/errors";
import {
  mergeListFilter,
  parseCreateInput,
  parseListStatus,
  pickCompletionTargets,
} from "../src/commands/subcommands/tasks/shared";

function expectCliError(fn: () => unknown, code: string): void {
  try {
    fn();
    throw new Error("Expected function to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).code).toBe(code);
  }
}

describe("parseCreateInput", () => {
  it("maps CLI args into CreateTaskInput", () => {
    const parsed = parseCreateInput({
      name: "Ship release",
      note: "Do it today",
      flagged: true,
      project: "Work",
      tags: "ops, urgent , qa ,,",
      defer: "2026-03-20T09:00:00.000Z",
      planned: "2026-03-20T10:00:00.000Z",
      due: "2026-03-21T10:00:00.000Z",
    });

    expect(parsed).toEqual({
      name: "Ship release",
      note: "Do it today",
      flagged: true,
      projectName: "Work",
      tags: ["ops", "urgent", "qa"],
      deferAt: "2026-03-20T09:00:00.000Z",
      plannedAt: "2026-03-20T10:00:00.000Z",
      dueAt: "2026-03-21T10:00:00.000Z",
    });
  });

  it("prefers input-json payload when provided", () => {
    const parsed = parseCreateInput(
      { name: "ignored", project: "ignored" },
      {
        name: "From JSON",
        projectName: "Client A",
        tags: ["alpha"],
      },
    );

    expect(parsed).toEqual({
      name: "From JSON",
      note: undefined,
      flagged: undefined,
      projectName: "Client A",
      tags: ["alpha"],
      deferAt: undefined,
      plannedAt: undefined,
      dueAt: undefined,
    });
  });

  it("fails when name is missing", () => {
    expectCliError(() => parseCreateInput({}), "E_USAGE");
    expectCliError(() => parseCreateInput({}, { projectName: "Work" }), "E_USAGE");
  });
});

describe("pickCompletionTargets", () => {
  const tasks = [
    { id: "1", name: "Email Alice" },
    { id: "2", name: "Email Alice follow-up" },
    { id: "3", name: "Review PR" },
  ];

  it("returns exact matches first", () => {
    const result = pickCompletionTargets(tasks, "Email Alice");
    expect(result).toEqual([{ id: "1", name: "Email Alice" }]);
  });

  it("falls back to case-insensitive contains", () => {
    const result = pickCompletionTargets(tasks, "email");
    expect(result).toEqual([
      { id: "1", name: "Email Alice" },
      { id: "2", name: "Email Alice follow-up" },
    ]);
  });
});

describe("mergeListFilter and parseListStatus", () => {
  it("merges planned flags from filter and CLI options", () => {
    const merged = mergeListFilter({
      filter: JSON.stringify({ planned: { before: "2026-03-31" } }),
      "planned-on": "2026-03-20",
      effective: true,
    });

    expect(merged.planned).toEqual({
      before: "2026-03-31",
      on: "2026-03-20",
      after: undefined,
      useEffective: true,
    });
  });

  it("defaults list status to available", () => {
    expect(parseListStatus({})).toBe("available");
  });

  it("rejects unsupported list statuses", () => {
    expectCliError(() => parseListStatus({ status: "later" }), "E_USAGE");
  });
});
