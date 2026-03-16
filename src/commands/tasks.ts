import { defineCommand } from "citty";
import { completeTasksCommand } from "./subcommands/tasks/complete";
import { createTaskCommand } from "./subcommands/tasks/create";
import { listTasksCommand } from "./subcommands/tasks/list";

export const tasksCommand = defineCommand({
  meta: { name: "tasks", description: "List, create, and complete tasks" },
  subCommands: {
    list: listTasksCommand,
    create: createTaskCommand,
    complete: completeTasksCommand,
  },
});
