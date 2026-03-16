import { Project, ProjectStatus } from "../types";
import { jxaString, runJxa } from "./jxa";

const projectSerializer = `
function safeDate(value) {
  return value ? value.toISOString() : null;
}

function normalizeStatus(value) {
  const raw = (value || "").toString().toLowerCase();
  switch (raw) {
    case "active status":
      return "active";
    case "on hold status":
      return "paused";
    case "done status":
      return "completed";
    case "dropped status":
      return "dropped";
    default:
      return "active";
  }
}

function serializeProject(project) {
  return {
    id: project.id(),
    name: project.name(),
    status: normalizeStatus(project.status()),
    plannedAt: safeDate(project.plannedDate()),
    effectivePlannedAt: safeDate(project.effectivePlannedDate())
  };
}
`;

export async function listProjects(statuses?: ProjectStatus[]): Promise<Project[]> {
  const statusesLiteral = JSON.stringify(statuses ?? []);
  return runJxa<Project[]>(`
const omnifocus = Application("OmniFocus");
const doc = omnifocus.defaultDocument();
const selectedStatuses = ${statusesLiteral};
${projectSerializer}

const projects = doc.flattenedProjects().map(serializeProject).filter(project => selectedStatuses.length === 0 || selectedStatuses.includes(project.status));

return JSON.stringify(projects);
`);
}

export async function listProjectRefs(): Promise<Array<{ id: string; name: string }>> {
  return runJxa<Array<{ id: string; name: string }>>(`
const omnifocus = Application("OmniFocus");
const doc = omnifocus.defaultDocument();
const projects = doc.flattenedProjects().map(project => ({ id: project.id(), name: project.name() }));
return JSON.stringify(projects);
`);
}

export async function createProject(name: string): Promise<Project> {
  return runJxa<Project>(`
const omnifocus = Application("OmniFocus");
const doc = omnifocus.defaultDocument();
const project = omnifocus.Project({ name: ${jxaString(name)} });
doc.projects().push(project);
${projectSerializer}

return JSON.stringify(serializeProject(project));
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
${projectSerializer}

return JSON.stringify(serializeProject(project));
`);
}

export async function completeProjectById(id: string): Promise<Project | null> {
  return runJxa<Project | null>(`
const omnifocus = Application("OmniFocus");
const doc = omnifocus.defaultDocument();
const project = doc.flattenedProjects.byId(${jxaString(id)});
if (!project) {
  return JSON.stringify(null);
}
omnifocus.markComplete(project);
${projectSerializer}

return JSON.stringify(serializeProject(project));
`);
}

export async function dropProjectById(id: string): Promise<Project | null> {
  return runJxa<Project | null>(`
const omnifocus = Application("OmniFocus");
const doc = omnifocus.defaultDocument();
const project = doc.flattenedProjects.byId(${jxaString(id)});
if (!project) {
  return JSON.stringify(null);
}
omnifocus.markDropped(project);
${projectSerializer}

return JSON.stringify(serializeProject(project));
`);
}

export async function pauseProjectById(id: string): Promise<Project | null> {
  return runJxa<Project | null>(`
const omnifocus = Application("OmniFocus");
const doc = omnifocus.defaultDocument();
const project = doc.flattenedProjects.byId(${jxaString(id)});
if (!project) {
  return JSON.stringify(null);
}
project.status = "on hold status";
${projectSerializer}

return JSON.stringify(serializeProject(project));
`);
}

export async function resumeProjectById(id: string): Promise<Project | null> {
  return runJxa<Project | null>(`
const omnifocus = Application("OmniFocus");
const doc = omnifocus.defaultDocument();
const project = doc.flattenedProjects.byId(${jxaString(id)});
if (!project) {
  return JSON.stringify(null);
}
omnifocus.markIncomplete(project);
project.status = "active status";
${projectSerializer}

return JSON.stringify(serializeProject(project));
`);
}
