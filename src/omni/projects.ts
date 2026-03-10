import { Project } from "../types";
import { jxaString, runJxa } from "./jxa";

export async function listProjects(): Promise<Project[]> {
  return runJxa<Project[]>(`
const omnifocus = Application("OmniFocus");
const doc = omnifocus.defaultDocument();

function safeDate(value) {
  return value ? value.toISOString() : null;
}

const projects = doc.flattenedProjects().map(project => ({
  id: project.id(),
  name: project.name(),
  status: project.status().toString(),
  plannedAt: safeDate(project.plannedDate()),
  effectivePlannedAt: safeDate(project.effectivePlannedDate())
}));

return JSON.stringify(projects);
`);
}

export async function createProject(name: string): Promise<Project> {
  return runJxa<Project>(`
const omnifocus = Application("OmniFocus");
const doc = omnifocus.defaultDocument();
const project = omnifocus.Project({ name: ${jxaString(name)} });
doc.projects().push(project);

function safeDate(value) {
  return value ? value.toISOString() : null;
}

return JSON.stringify({
  id: project.id(),
  name: project.name(),
  status: project.status().toString(),
  plannedAt: safeDate(project.plannedDate()),
  effectivePlannedAt: safeDate(project.effectivePlannedDate())
});
`);
}

export async function renameProjectById(id: string, name: string): Promise<Project | null> {
  return runJxa<Project | null>(`
const omnifocus = Application("OmniFocus");
const doc = omnifocus.defaultDocument();
const project = doc.flattenedProjects.byId(${jxaString(id)});
if (!project) {
  return JSON.stringify(null);
}
project.name = ${jxaString(name)};

function safeDate(value) {
  return value ? value.toISOString() : null;
}

return JSON.stringify({
  id: project.id(),
  name: project.name(),
  status: project.status().toString(),
  plannedAt: safeDate(project.plannedDate()),
  effectivePlannedAt: safeDate(project.effectivePlannedDate())
});
`);
}
