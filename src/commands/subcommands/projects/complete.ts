import { defineCommand } from "citty";
import { fail } from "../../../errors";
import { completeProjectById } from "../../../omni/projects";
import { printOutput } from "../../../output";
import { runWithIo } from "../../shared";
import { projectTargetArgsDef, resolveProjectTargetId } from "./shared";

export const completeProjectCommand = defineCommand({
  meta: { name: "complete", description: "Mark a project completed" },
  args: projectTargetArgsDef,
  async run(ctx) {
    await runWithIo(
      ctx.rawArgs,
      ctx.args as Record<string, unknown>,
      projectTargetArgsDef,
      true,
      async ({ outputMode, inputJson }) => {
        const id = await resolveProjectTargetId(ctx.args as Record<string, unknown>, inputJson);
        const updated = await completeProjectById(id);
        if (!updated) {
          fail("E_NO_MATCH", `No project found for id '${id}'`, 2);
        }
        printOutput(updated, outputMode);
      },
    );
  },
});
