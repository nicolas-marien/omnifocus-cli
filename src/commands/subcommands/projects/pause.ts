import { defineCommand } from "citty";
import { fail } from "../../../errors";
import { pauseProjectById } from "../../../omni/projects";
import { printOutput } from "../../../output";
import { runWithIo } from "../../shared";
import { projectTargetArgsDef, resolveProjectTargetId } from "./shared";

export const pauseProjectCommand = defineCommand({
  meta: { name: "pause", description: "Pause project" },
  args: projectTargetArgsDef,
  async run(ctx) {
    await runWithIo(
      ctx.rawArgs,
      ctx.args as Record<string, unknown>,
      projectTargetArgsDef,
      true,
      async ({ outputMode, inputJson }) => {
        const id = await resolveProjectTargetId(ctx.args as Record<string, unknown>, inputJson);
        const updated = await pauseProjectById(id);
        if (!updated) {
          fail("E_NO_MATCH", `No project found for id '${id}'`, 2);
        }
        printOutput(updated, outputMode);
      },
    );
  },
});
