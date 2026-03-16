import { defineCommand } from "citty";
import {
  listTasksInPerspective,
  resolvePerspectiveTargetId,
} from "../../../omni/perspectives";
import { printOutput } from "../../../output";
import { runWithIo } from "../../shared";
import { perspectiveTargetArgsDef } from "./shared";

export const listPerspectiveTasksCommand = defineCommand({
  meta: {
    name: "tasks",
    description: "List task items visible in a perspective",
  },
  args: perspectiveTargetArgsDef,
  async run(ctx) {
    await runWithIo(
      ctx.rawArgs,
      ctx.args as Record<string, unknown>,
      perspectiveTargetArgsDef,
      true,
      async ({ outputMode, inputJson }) => {
        const id = await resolvePerspectiveTargetId(
          ctx.args as Record<string, unknown>,
          inputJson,
        );
        printOutput(await listTasksInPerspective(id), outputMode);
      },
    );
  },
});
