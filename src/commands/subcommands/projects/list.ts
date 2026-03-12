import { defineCommand } from "citty";
import { fail } from "../../../errors";
import { listProjects } from "../../../omni/projects";
import { printOutput } from "../../../output";
import { ProjectStatus } from "../../../types";
import { formatArg, runWithIo } from "../../shared";

const projectStatuses = new Set<ProjectStatus>([
  "active",
  "paused",
  "completed",
  "dropped",
]);

const listProjectsArgsDef = {
  status: { type: "string" as const },
  ...formatArg,
};

function parseStatusFilter(value: unknown): ProjectStatus[] | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const parsed = value
    .split(",")
    .map((status) => status.trim().toLowerCase())
    .filter(Boolean);

  if (parsed.length === 0) {
    return undefined;
  }

  const unique = Array.from(new Set(parsed));
  for (const status of unique) {
    if (!projectStatuses.has(status as ProjectStatus)) {
      fail(
        "E_USAGE",
        "projects list --status accepts only active, paused, completed, dropped",
      );
    }
  }

  return unique as ProjectStatus[];
}

export const listProjectsCommand = defineCommand({
  meta: { name: "list", description: "List projects" },
  args: listProjectsArgsDef,
  async run(ctx) {
    await runWithIo(
      ctx.rawArgs,
      ctx.args as Record<string, unknown>,
      listProjectsArgsDef,
      false,
      async ({ outputMode }) => {
        const statuses = parseStatusFilter(ctx.args.status);
        printOutput(await listProjects(statuses), outputMode);
      },
    );
  },
});
