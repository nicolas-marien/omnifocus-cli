import { defineCommand } from "citty";
import { projectsCommand } from "./commands/projects";
import { tagsCommand } from "./commands/tags";
import { tasksCommand } from "./commands/tasks";

export const mainCommand = defineCommand({
  meta: {
    name: "of",
    description: "OmniFocus CLI",
  },
  subCommands: {
    tasks: tasksCommand,
    projects: projectsCommand,
    tags: tagsCommand,
  },
});
