import { defineCommand } from "citty";
import { listProjects } from "../../../omni/projects";
import { printOutput } from "../../../output";
import { listOnlyArgsDef, runWithIo } from "../../shared";

export const listProjectsCommand = defineCommand({
  meta: { name: "list", description: "List projects" },
  args: listOnlyArgsDef,
  async run(ctx) {
    await runWithIo(
      ctx.rawArgs,
      ctx.args as Record<string, unknown>,
      listOnlyArgsDef,
      false,
      async ({ outputMode }) => {
        printOutput(await listProjects(), outputMode);
      },
    );
  },
});
