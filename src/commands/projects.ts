import { defineCommand } from "citty";
import { createProjectCommand } from "./subcommands/projects/create";
import { listProjectsCommand } from "./subcommands/projects/list";
import { updateProjectCommand } from "./subcommands/projects/update";

export const projectsCommand = defineCommand({
  meta: { name: "projects", description: "Manage projects" },
  subCommands: {
    list: listProjectsCommand,
    create: createProjectCommand,
    update: updateProjectCommand,
  },
});
