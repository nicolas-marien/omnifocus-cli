import { defineCommand } from "citty";
import { fail } from "../../../errors";
import { renameProjectById } from "../../../omni/projects";
import { printOutput } from "../../../output";
import { runWithIo, updateNameArgsDef } from "../../shared";

export const updateProjectCommand = defineCommand({
  meta: { name: "update", description: "Rename a project" },
  args: updateNameArgsDef,
  async run(ctx) {
    await runWithIo(
      ctx.rawArgs,
      ctx.args as Record<string, unknown>,
      updateNameArgsDef,
      true,
      async ({ outputMode, inputJson }) => {
        const payload = inputJson && typeof inputJson === "object" ? (inputJson as { id?: string; name?: string }) : undefined;
        const id = (typeof payload?.id === "string" ? payload.id : undefined) ?? (typeof ctx.args.id === "string" ? ctx.args.id : undefined);
        const name = (typeof payload?.name === "string" ? payload.name : undefined) ?? (typeof ctx.args.name === "string" ? ctx.args.name : undefined);
        if (!id || !name) {
          fail("E_USAGE", "projects update requires --id <id> --name <value>");
        }
        const updated = await renameProjectById(id, name);
        if (!updated) {
          fail("E_NO_MATCH", `No project found for id '${id}'`, 2);
        }
        printOutput(updated, outputMode);
      },
    );
  },
});
