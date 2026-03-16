import { formatArg } from "../../shared";

export const perspectiveTargetArgsDef = {
  id: {
    type: "string" as const,
    description: "Perspective identifier",
    valueHint: "id",
  },
  name: {
    type: "string" as const,
    description: "Perspective name or name fragment",
    valueHint: "name",
  },
  "input-json": {
    type: "string" as const,
    description: "JSON payload with id or name",
    valueHint: "json",
  },
  ...formatArg,
};
