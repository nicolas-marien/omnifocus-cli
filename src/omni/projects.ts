import { Project, ProjectStatus } from "../types";
import { jxaString, runJxa } from "./jxa";

export async function listProjects(statuses?: ProjectStatus[]): Promise<Project[]> {
  const statusesLiteral = JSON.stringify(statuses ?? []);
  return runJxa<Project[]>(`
const omnifocus = Application("OmniFocus");
const doc = omnifocus.defaultDocument();
const selectedStatuses = ${statusesLiteral};

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

const projects = doc.flattenedProjects().map(project => ({
  id: project.id(),
  name: project.name(),
  status: normalizeStatus(project.status()),
  plannedAt: safeDate(project.plannedDate()),
  effectivePlannedAt: safeDate(project.effectivePlannedDate())
})).filter(project => selectedStatuses.length === 0 || selectedStatuses.includes(project.status));

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

return JSON.stringify({
  id: project.id(),
  name: project.name(),
  status: normalizeStatus(project.status()),
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

return JSON.stringify({
  id: project.id(),
  name: project.name(),
  status: normalizeStatus(project.status()),
  plannedAt: safeDate(project.plannedDate()),
  effectivePlannedAt: safeDate(project.effectivePlannedDate())
});
`);
}
