import { fail } from "../../../errors";
import { listProjectRefs } from "../../../omni/projects";
import { formatArg } from "../../shared";

export const projectTargetArgsDef = {
  id: {
    type: "string" as const,
    description: "Project identifier",
    valueHint: "id",
  },
  name: {
    type: "string" as const,
    description: "Project name or name fragment",
    valueHint: "name",
  },
  "input-json": {
    type: "string" as const,
    description: "JSON payload with id or name",
    valueHint: "json",
  },
  ...formatArg,
};

function pickProjectTargets(
  projects: Array<{ id: string; name: string }>,
  nameOrQuery: string,
): Array<{ id: string; name: string }> {
  const exact = projects.filter((project) => project.name === nameOrQuery);
  if (exact.length > 0) {
    return exact;
  }
  return projects.filter((project) =>
    project.name.toLowerCase().includes(nameOrQuery.toLowerCase()),
  );
}

export async function resolveProjectTargetId(
  args: Record<string, unknown>,
  inputJson?: unknown,
): Promise<string> {
  const payload = inputJson && typeof inputJson === "object" ? (inputJson as { id?: string; name?: string }) : undefined;
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

  const source = await listProjectRefs();
  const matches = pickProjectTargets(source, name);
  if (matches.length === 0) {
    fail("E_NO_MATCH", `No projects found for name '${name}'`, 2);
  }
  if (matches.length > 1) {
    fail("E_MULTI_MATCH", `Multiple projects match '${name}'. Use --id.`, 2);
  }
  const project = matches[0];
  if (!project) {
    fail("E_NO_MATCH", `No projects found for name '${name}'`, 2);
  }
  return project.id;
}
