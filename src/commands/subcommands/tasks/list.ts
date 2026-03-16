import { defineCommand } from "citty";
import { applyFilters } from "../../../filters";
import { listTasks } from "../../../omni/tasks";
import { printOutput } from "../../../output";
import { runWithIo } from "../../shared";
import { listArgsDef, mergeListFilter, parseListStatus } from "./shared";

export const listTasksCommand = defineCommand({
  meta: { name: "list", description: "List tasks" },
  args: listArgsDef,
  async run(ctx) {
    await runWithIo(
      ctx.rawArgs,
      ctx.args as Record<string, unknown>,
      listArgsDef,
      false,
      async ({ outputMode }) => {
        const bucket = parseListStatus(ctx.args as Record<string, unknown>);
        const tasks = await listTasks(bucket);
        const filter = mergeListFilter(ctx.args as Record<string, unknown>);
        const filtered = applyFilters(
          tasks,
          filter,
          Boolean(ctx.args.effective),
        );
        printOutput(filtered, outputMode);
      },
    );
  },
});
