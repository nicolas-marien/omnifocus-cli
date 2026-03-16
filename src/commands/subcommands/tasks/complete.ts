import { defineCommand } from "citty";
import { fail } from "../../../errors";
import { completeTasksByIds, listTaskRefs } from "../../../omni/tasks";
import { printOutput } from "../../../output";
import { resolveName, runWithIo } from "../../shared";
import { completeArgsDef, pickCompletionTargets } from "./shared";

export const completeTasksCommand = defineCommand({
  meta: { name: "complete", description: "Complete task(s)" },
  args: completeArgsDef,
  async run(ctx) {
    await runWithIo(
      ctx.rawArgs,
      ctx.args as Record<string, unknown>,
      completeArgsDef,
      true,
      async ({ outputMode, inputJson }) => {
        const idsRaw =
          typeof ctx.args.id === "string" ? ctx.args.id : undefined;
        let targetIds = idsRaw
          ? idsRaw
              .split(",")
              .map((id) => id.trim())
              .filter(Boolean)
          : [];

        if (inputJson && typeof inputJson === "object") {
          const payload = inputJson as { ids?: string[]; name?: string };
          if (payload.ids?.length) {
            targetIds = payload.ids;
          } else if (payload.name) {
            const source = await listTaskRefs();
            const matches = pickCompletionTargets(source, payload.name);
            if (matches.length === 0) {
              fail(
                "E_NO_MATCH",
                `No tasks found for name '${payload.name}'`,
                2,
              );
            }
            if (matches.length > 1) {
              fail(
                "E_MULTI_MATCH",
                `Multiple tasks match '${payload.name}'. Use --id.`,
                2,
              );
            }
            const task = matches[0];
            if (!task) {
              fail(
                "E_NO_MATCH",
                `No tasks found for name '${payload.name}'`,
                2,
              );
            }
            targetIds = [task.id];
          }
        }

        if (targetIds.length === 0) {
          const nameOrQuery = resolveName(ctx.args as Record<string, unknown>);
          if (!nameOrQuery) {
            fail(
              "E_USAGE",
              "complete requires --id <id[,id]> or --name <value>",
            );
          }
          const source = await listTaskRefs();
          const matches = pickCompletionTargets(source, nameOrQuery);
          if (matches.length === 0) {
            fail("E_NO_MATCH", `No tasks found for name '${nameOrQuery}'`, 2);
          }
          if (matches.length > 1) {
            fail(
              "E_MULTI_MATCH",
              `Multiple tasks match '${nameOrQuery}'. Use --id.`,
              2,
            );
          }
          const task = matches[0];
          if (!task) {
            fail("E_NO_MATCH", `No tasks found for name '${nameOrQuery}'`, 2);
          }
          targetIds = [task.id];
        }

        if (ctx.args["dry-run"]) {
          printOutput({ dryRun: true, ids: targetIds }, outputMode);
          return;
        }

        if (targetIds.length > 1 && !ctx.args.yes) {
          fail("E_USAGE", "Refusing to complete multiple tasks without --yes");
        }

        const result = await completeTasksByIds(targetIds);
        printOutput(result, outputMode);
      },
    );
  },
});
