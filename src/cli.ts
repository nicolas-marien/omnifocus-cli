import { type CommandDef, defineCommand } from "citty";
import { createHelpCommand } from "./commands/help";
import { projectsCommand } from "./commands/projects";
import { tagsCommand } from "./commands/tags";
import { tasksCommand } from "./commands/tasks";

function mainSubCommands(): Record<string, CommandDef<any>> {
  return {
    tasks: tasksCommand,
    projects: projectsCommand,
    tags: tagsCommand,
    help: createHelpCommand(() => mainCommand),
  };
}

export const mainCommand: CommandDef<any> = defineCommand({
  meta: {
    name: "of",
    description: "OmniFocus CLI",
  },
  subCommands: mainSubCommands,
});
