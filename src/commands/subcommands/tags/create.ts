import { defineCommand } from "citty";
import { fail } from "../../../errors";
import { createTag } from "../../../omni/tags";
import { printOutput } from "../../../output";
import { createNameArgsDef, resolveName, runWithIo } from "../../shared";

export const createTagCommand = defineCommand({
  meta: { name: "create", description: "Create tag" },
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
          fail("E_USAGE", "tags create requires --name <value>");
        }
        printOutput(await createTag(name), outputMode);
      },
    );
  },
});
