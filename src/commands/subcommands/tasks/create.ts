import { defineCommand } from "citty";
import { createTask } from "../../../omni/tasks";
import { printOutput } from "../../../output";
import { runWithIo } from "../../shared";
import { createArgsDef, parseCreateInput } from "./shared";

export const createTaskCommand = defineCommand({
  meta: { name: "create", description: "Create task" },
  args: createArgsDef,
  async run(ctx) {
    await runWithIo(
      ctx.rawArgs,
      ctx.args as Record<string, unknown>,
      createArgsDef,
      true,
      async ({ outputMode, inputJson }) => {
        const input = parseCreateInput(ctx.args as Record<string, unknown>, inputJson);
        const task = await createTask(input);
        printOutput(task, outputMode);
      },
    );
  },
});
