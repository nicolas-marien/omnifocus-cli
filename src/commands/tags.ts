import { defineCommand } from "citty";
import { createTagCommand } from "./subcommands/tags/create";
import { listTagsCommand } from "./subcommands/tags/list";
import { updateTagCommand } from "./subcommands/tags/update";

export const tagsCommand = defineCommand({
  meta: { name: "tags", description: "List, create, and rename tags" },
  subCommands: {
    list: listTagsCommand,
    create: createTagCommand,
    update: updateTagCommand,
  },
});
