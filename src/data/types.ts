export type Id = string;

export interface BaseEntity {
  id: Id;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export type ProjectStatus = "active" | "paused" | "done";

export interface Project extends BaseEntity {
  name: string;
  color: string;
  status: ProjectStatus;
  description: string;
  sortOrder: number;
}

export const TASK_STATUSES = ["upcoming", "doing", "done", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  upcoming: "即将开始",
  doing: "进行中",
  done: "已完成",
  cancelled: "中途取消"
};

export type TaskPriority = "high" | "mid" | "low";

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: "高",
  mid: "中",
  low: "低"
};

export interface Task extends BaseEntity {
  projectId: Id | null;
  parentId: Id | null;
  title: string;
  note: string;
  status: TaskStatus;
  priority: TaskPriority;
  startAt: number | null;
  dueAt: number | null;
  doneAt: number | null;
  estimateMin: number | null;
  tagIds: Id[];
  sortOrder: number;
  /** 重复规则，null 表示不重复。完成后会自动生成下一次。 */
  repeat: RepeatFreq | null;
  /** 同一串重复任务的标识，第一条的 seriesId 就是它自己的 id。 */
  seriesId: Id | null;
}

export type RepeatFreq = "daily" | "weekdays" | "weekly" | "monthly";

/** 任务模板：把常用任务的固定信息存下来，一键生成新任务。 */
export interface Template extends BaseEntity {
  name: string;
  title: string;
  note: string;
  priority: TaskPriority;
  projectId: Id | null;
  tagIds: Id[];
  /** 生成的任务默认在几天后到期；null 表示不设日期 */
  dueOffsetDays: number | null;
  repeat: RepeatFreq | null;
  sortOrder: number;
}

export interface Tag extends BaseEntity {
  name: string;
  color: string;
}

export interface Milestone extends BaseEntity {
  projectId: Id;
  name: string;
  date: number;
}

export interface Dependency extends BaseEntity {
  taskId: Id;
  dependsOnId: Id;
}

export interface Reminder extends BaseEntity {
  taskId: Id;
  /** 相对截止时间的提前分钟数，0 表示准时。 */
  offsetMinutes: number;
  /** 已经弹过的提醒不会再弹，改时间会把它清空。 */
  firedAt: number | null;
  /** 「稍后提醒」的目标时间。 */
  snoozeUntil: number | null;
}

/** 提醒时间以天为单位？不，按"每天的提醒时刻 + 提前量"计算。设置项直接用 key 当主键。 */
export interface Setting extends BaseEntity {
  value: string;
}

export interface TimeEntry extends BaseEntity {
  taskId: Id;
  startedAt: number;
  endedAt: number | null;
  note: string;
}

export type EntityKind =
  | "project"
  | "task"
  | "tag"
  | "milestone"
  | "dependency"
  | "reminder"
  | "timeEntry"
  | "setting"
  | "view"
  | "template";

export type NavView =
  | { kind: "all" }
  | { kind: "inbox" }
  | { kind: "today" }
  | { kind: "upcoming" }
  | { kind: "project"; projectId: Id }
  | { kind: "archive" };

export type DueFilter = "any" | "overdue" | "today" | "week" | "none";

export interface TaskFilters {
  text: string;
  statuses: TaskStatus[];
  priorities: TaskPriority[];
  tagIds: Id[];
  due: DueFilter;
}

export const EMPTY_FILTERS: TaskFilters = { text: "", statuses: [], priorities: [], tagIds: [], due: "any" };

export function hasActiveFilters(filters: TaskFilters): boolean {
  return (
    filters.text.trim() !== "" ||
    filters.statuses.length > 0 ||
    filters.priorities.length > 0 ||
    filters.tagIds.length > 0 ||
    filters.due !== "any"
  );
}

export type SortKey = "default" | "due" | "priority" | "updated" | "title";

export const SORT_LABEL: Record<SortKey, string> = {
  default: "默认（状态 + 截止）",
  due: "截止时间",
  priority: "优先级",
  updated: "最近更新",
  title: "标题"
};

/** 保存下来的视图：把「看哪儿 + 怎么看 + 筛选条件 + 排序」打包存起来。 */
export interface SavedView extends BaseEntity {
  name: string;
  nav: NavView;
  mode: string;
  filters: TaskFilters;
  sort: SortKey;
  sortOrder: number;
}

export interface EntityMap {
  project: Project;
  task: Task;
  tag: Tag;
  milestone: Milestone;
  dependency: Dependency;
  reminder: Reminder;
  timeEntry: TimeEntry;
  setting: Setting;
  view: SavedView;
  template: Template;
}

export interface Snapshot {
  projects: Project[];
  tasks: Task[];
  tags: Tag[];
  milestones: Milestone[];
  dependencies: Dependency[];
  reminders: Reminder[];
  timeEntries: TimeEntry[];
  settings: Setting[];
  views: SavedView[];
  templates: Template[];
}

export function emptySnapshot(): Snapshot {
  return {
    projects: [],
    tasks: [],
    tags: [],
    milestones: [],
    dependencies: [],
    reminders: [],
    timeEntries: [],
    settings: [],
    views: [],
    templates: []
  };
}

export const REMINDER_PRESETS: { label: string; minutes: number }[] = [
  { label: "准时", minutes: 0 },
  { label: "提前 1 小时", minutes: 60 },
  { label: "提前 1 天", minutes: 1440 },
  { label: "提前 3 天", minutes: 4320 },
  { label: "提前 1 周", minutes: 10080 }
];

export const DEFAULT_REMINDER_TIME = "09:30";

export const PROJECT_COLORS = [
  "#e0653f",
  "#2383e2",
  "#c29343",
  "#0f7b6c",
  "#9065b0",
  "#d44c47",
  "#3f8f5b",
  "#7a7873"
];
