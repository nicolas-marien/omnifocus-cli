import { fail } from "./errors";
import { DateWindow, Task, TaskFilter } from "./types";

type DateBounds = {
  from?: number;
  to?: number;
};

export function parseFilter(raw?: string): TaskFilter {
  if (!raw) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail("E_BAD_FILTER", "--filter must be valid JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail("E_BAD_FILTER", "--filter must be a JSON object");
  }

  return parsed as TaskFilter;
}

function parseDateBoundary(value: string, boundary: "start" | "end"): number {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map((part) => Number(part));
    if (!y || !m || !d) {
      fail("E_BAD_FILTER", `Invalid date: ${value}`);
    }
    const date = new Date(y, m - 1, d, boundary === "start" ? 0 : 23, boundary === "start" ? 0 : 59, boundary === "start" ? 0 : 59, boundary === "start" ? 0 : 999);
    return date.getTime();
  }

  const ts = Date.parse(value);
  if (Number.isNaN(ts)) {
    fail("E_BAD_FILTER", `Invalid date/time: ${value}`);
  }
  return ts;
}

function buildBounds(window?: DateWindow): DateBounds {
  if (!window) {
    return {};
  }

  const bounds: DateBounds = {};
  if (window.on) {
    bounds.from = parseDateBoundary(window.on, "start");
    bounds.to = parseDateBoundary(window.on, "end");
  }
  if (window.after) {
    bounds.from = parseDateBoundary(window.after, "start");
  }
  if (window.before) {
    bounds.to = parseDateBoundary(window.before, "end");
  }
  return bounds;
}

function dateMatch(value: string | null, bounds: DateBounds): boolean {
  if (!value) {
    return false;
  }

  const ts = Date.parse(value);
  if (Number.isNaN(ts)) {
    return false;
  }

  if (bounds.from !== undefined && ts < bounds.from) {
    return false;
  }
  if (bounds.to !== undefined && ts > bounds.to) {
    return false;
  }
  return true;
}

function applyDateFilter(tasks: Task[], window: DateWindow | undefined, valueKey: keyof Task, effectiveKey: keyof Task): Task[] {
  if (!window) {
    return tasks;
  }

  const bounds = buildBounds(window);
  const key = window.useEffective ? effectiveKey : valueKey;
  return tasks.filter((task) => dateMatch(task[key] as string | null, bounds));
}

export function applyFilters(tasks: Task[], filter: TaskFilter, forceEffectiveDates = false): Task[] {
  let out = tasks;

  if (filter.ids?.length) {
    const ids = new Set(filter.ids);
    out = out.filter((task) => ids.has(task.id));
  }

  if (filter.name?.equals) {
    out = out.filter((task) => task.name === filter.name?.equals);
  }

  if (filter.name?.contains) {
    const needle = filter.name.contains.toLowerCase();
    out = out.filter((task) => task.name.toLowerCase().includes(needle));
  }

  if (filter.project?.id) {
    out = out.filter((task) => task.project?.id === filter.project?.id);
  }

  if (filter.project?.name) {
    out = out.filter((task) => task.project?.name === filter.project?.name);
  }

  if (filter.tags?.length) {
    const tags = new Set(filter.tags.map((tag) => tag.toLowerCase()));
    out = out.filter((task) => task.tags.some((tag) => tags.has(tag.toLowerCase())));
  }

  if (filter.flagged !== undefined) {
    out = out.filter((task) => task.flagged === filter.flagged);
  }

  if (filter.blocked !== undefined) {
    out = out.filter((task) => task.blocked === filter.blocked);
  }

  const planned = filter.planned ? { ...filter.planned, useEffective: forceEffectiveDates || filter.planned.useEffective } : undefined;
  const due = filter.due ? { ...filter.due, useEffective: forceEffectiveDates || filter.due.useEffective } : undefined;
  const defer = filter.defer ? { ...filter.defer, useEffective: forceEffectiveDates || filter.defer.useEffective } : undefined;

  out = applyDateFilter(out, planned, "plannedAt", "effectivePlannedAt");
  out = applyDateFilter(out, due, "dueAt", "effectiveDueAt");
  out = applyDateFilter(out, defer, "deferAt", "effectiveDeferAt");

  if (filter.limit !== undefined) {
    if (!Number.isInteger(filter.limit) || filter.limit < 1) {
      fail("E_BAD_FILTER", "filter.limit must be a positive integer");
    }
    out = out.slice(0, filter.limit);
  }

  return out;
}
