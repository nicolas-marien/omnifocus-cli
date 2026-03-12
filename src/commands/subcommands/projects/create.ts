import { defineCommand } from "citty";
import { fail } from "../../../errors";
import { createProject } from "../../../omni/projects";
import { printOutput } from "../../../output";
import { createNameArgsDef, resolveName, runWithIo } from "../../shared";

export const createProjectCommand = defineCommand({
  meta: { name: "create", description: "Create project" },
  args: createNameArgsDef,
  async run(ctx) {
    await runWithIo(
      ctx.rawArgs,
      ctx.args as Record<string, unknown>,
      createNameArgsDef,
      false,
      async ({ outputMode }) => {
        const name = resolveName(
          ctx.args as Record<string, unknown>,
          "namePositional",
        );
        if (!name) {
          fail("E_USAGE", "projects create requires --name <value>");
        }
        printOutput(await createProject(name), outputMode);
      },
    );
  },
});
