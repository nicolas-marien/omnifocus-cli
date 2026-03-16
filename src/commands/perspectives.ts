import { defineCommand } from "citty";
import { listPerspectivesCommand } from "./subcommands/perspectives/list";
import { listPerspectiveTasksCommand } from "./subcommands/perspectives/tasks";

export const perspectivesCommand = defineCommand({
  meta: { name: "perspectives", description: "List perspectives and their visible tasks" },
  subCommands: {
    list: listPerspectivesCommand,
    tasks: listPerspectiveTasksCommand,
  },
});
