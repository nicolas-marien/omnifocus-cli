export type TaskStatus = "available" | "remaining" | "inbox" | "completed" | "dropped";

export type TaskBucket = TaskStatus | "all";

export type Task = {
  id: string;
  name: string;
  note: string | null;
  flagged: boolean;
  blocked: boolean;
  completed: boolean;
  dropped: boolean;
  inInbox: boolean;
  project: { id: string; name: string } | null;
  tags: string[];
  deferAt: string | null;
  effectiveDeferAt: string | null;
  plannedAt: string | null;
  effectivePlannedAt: string | null;
  dueAt: string | null;
  effectiveDueAt: string | null;
  completedAt: string | null;
  droppedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type Project = {
  id: string;
  name: string;
  status: string;
  plannedAt: string | null;
  effectivePlannedAt: string | null;
};

export type Tag = {
  id: string;
  name: string;
};

export type DateWindow = {
  on?: string;
  before?: string;
  after?: string;
  useEffective?: boolean;
};

export type TaskFilter = {
  ids?: string[];
  name?: {
    contains?: string;
    equals?: string;
  };
  project?: {
    id?: string;
    name?: string;
  };
  tags?: string[];
  planned?: DateWindow;
  due?: DateWindow;
  defer?: DateWindow;
  flagged?: boolean;
  blocked?: boolean;
  limit?: number;
};

export type CreateTaskInput = {
  name: string;
  note?: string;
  flagged?: boolean;
  projectName?: string;
  tags?: string[];
  deferAt?: string | null;
  plannedAt?: string | null;
  dueAt?: string | null;
};
