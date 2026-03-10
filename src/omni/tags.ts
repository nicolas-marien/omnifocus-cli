import { Tag } from "../types";
import { jxaString, runJxa } from "./jxa";

export async function listTags(): Promise<Tag[]> {
  return runJxa<Tag[]>(`
const omnifocus = Application("OmniFocus");
const doc = omnifocus.defaultDocument();
const tags = doc.flattenedTags().map(tag => ({ id: tag.id(), name: tag.name() }));
return JSON.stringify(tags);
`);
}

export async function createTag(name: string): Promise<Tag> {
  return runJxa<Tag>(`
const omnifocus = Application("OmniFocus");
const doc = omnifocus.defaultDocument();
const existing = doc.flattenedTags().filter(tag => tag.name() === ${jxaString(name)});
if (existing.length > 0) {
  const tag = existing[0];
  return JSON.stringify({ id: tag.id(), name: tag.name() });
}
const tag = omnifocus.Tag({ name: ${jxaString(name)} });
doc.tags().push(tag);
return JSON.stringify({ id: tag.id(), name: tag.name() });
`);
}

export async function renameTagById(id: string, name: string): Promise<Tag | null> {
  return runJxa<Tag | null>(`
const omnifocus = Application("OmniFocus");
const doc = omnifocus.defaultDocument();
const tag = doc.flattenedTags.byId(${jxaString(id)});
if (!tag) {
  return JSON.stringify(null);
}
tag.name = ${jxaString(name)};
return JSON.stringify({ id: tag.id(), name: tag.name() });
`);
}
