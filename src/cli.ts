import { defineCommand } from "citty";
import { projectsCommand } from "./commands/projects";
import { tagsCommand } from "./commands/tags";
import { completeTasksCommand } from "./commands/subcommands/tasks/complete";
import { createTaskCommand } from "./commands/subcommands/tasks/create";
import { listTasksCommand } from "./commands/subcommands/tasks/list";

export const mainCommand = defineCommand({
  meta: {
    name: "of",
    description: "OmniFocus CLI",
  },
  subCommands: {
    list: listTasksCommand,
    create: createTaskCommand,
    complete: completeTasksCommand,
    projects: projectsCommand,
    tags: tagsCommand,
  },
});
