import { defineCommand } from "citty";
import { listPerspectives } from "../../../omni/perspectives";
import { printOutput } from "../../../output";
import { listOnlyArgsDef, runWithIo } from "../../shared";

export const listPerspectivesCommand = defineCommand({
  meta: { name: "list", description: "List built-in and custom perspectives" },
  args: listOnlyArgsDef,
  async run(ctx) {
    await runWithIo(
      ctx.rawArgs,
      ctx.args as Record<string, unknown>,
      listOnlyArgsDef,
      false,
      async ({ outputMode }) => {
        printOutput(await listPerspectives(), outputMode);
      },
    );
  },
});
