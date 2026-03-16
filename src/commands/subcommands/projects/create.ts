import { defineCommand } from "citty";
import { fail } from "../../../errors";
import { createProject } from "../../../omni/projects";
import { printOutput } from "../../../output";
import { createNameArgsDef, resolveName, runWithIo } from "../../shared";

export const createProjectCommand = defineCommand({
  meta: { name: "create", description: "Create a project" },
  args: createNameArgsDef,
  async run(ctx) {
    await runWithIo(
      ctx.rawArgs,
      ctx.args as Record<string, unknown>,
      createNameArgsDef,
      true,
      async ({ outputMode, inputJson }) => {
        const payload = inputJson && typeof inputJson === "object" ? (inputJson as { name?: string }) : undefined;
        const name = (typeof payload?.name === "string" ? payload.name : undefined) ?? resolveName(ctx.args as Record<string, unknown>);
        if (!name) {
          fail("E_USAGE", "projects create requires --name <value>");
        }
        printOutput(await createProject(name), outputMode);
      },
    );
  },
});
