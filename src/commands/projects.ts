import { defineCommand } from "citty";
import { completeProjectCommand } from "./subcommands/projects/complete";
import { createProjectCommand } from "./subcommands/projects/create";
import { dropProjectCommand } from "./subcommands/projects/drop";
import { listProjectsCommand } from "./subcommands/projects/list";
import { pauseProjectCommand } from "./subcommands/projects/pause";
import { resumeProjectCommand } from "./subcommands/projects/resume";
import { updateProjectCommand } from "./subcommands/projects/update";

export const projectsCommand = defineCommand({
  meta: { name: "projects", description: "Manage project lifecycle and naming" },
  subCommands: {
    list: listProjectsCommand,
    create: createProjectCommand,
    update: updateProjectCommand,
    complete: completeProjectCommand,
    pause: pauseProjectCommand,
    resume: resumeProjectCommand,
    drop: dropProjectCommand,
  },
});
