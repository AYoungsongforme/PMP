import { addDays, dayDiff, startOfDay, today } from "../lib/date";
import type {
  Dependency,
  Id,
  NavView,
  Project,
  Reminder,
  SavedView,
  Snapshot,
  SortKey,
  Tag,
  Task,
  TaskFilters,
  TaskStatus
} from "./types";

export type { NavView } from "./types";

export function activeProjects(snap: Snapshot): Project[] {
  return snap.projects
    .filter((p) => p.deletedAt === null && p.status !== "done")
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function archivedProjects(snap: Snapshot): Project[] {
  return snap.projects.filter((p) => p.deletedAt === null && p.status === "done").sort((a, b) => a.sortOrder - b.sortOrder);
}

export function liveTasks(snap: Snapshot): Task[] {
  return snap.tasks.filter((t) => t.deletedAt === null);
}

export function tagById(snap: Snapshot): Map<Id, Tag> {
  return new Map(snap.tags.filter((t) => t.deletedAt === null).map((t) => [t.id, t]));
}

export function projectById(snap: Snapshot): Map<Id, Project> {
  return new Map(snap.projects.filter((p) => p.deletedAt === null).map((p) => [p.id, p]));
}

function isOverdue(task: Task): boolean {
  return task.status !== "done" && task.dueAt !== null && dayDiff(task.dueAt, Date.now()) < 0;
}

export function filterTasks(snap: Snapshot, view: NavView): Task[] {
  const tasks = liveTasks(snap);
  const t = today();

  switch (view.kind) {
    case "all":
      return tasks;
    case "inbox":
      return tasks.filter((task) => task.projectId === null);
    case "today":
      return tasks.filter(
        (task) => task.status !== "done" && task.dueAt !== null && dayDiff(task.dueAt, t) <= 0
      );
    case "upcoming":
      return tasks.filter((task) => {
        if (task.status === "done" || task.dueAt === null) return false;
        const d = dayDiff(task.dueAt, t);
        return d > 0 && d <= 7;
      });
    case "archive": {
      const ids = new Set(archivedProjects(snap).map((p) => p.id));
      return tasks.filter((task) => task.projectId !== null && ids.has(task.projectId));
    }
    case "project":
      return tasks.filter((task) => task.projectId === view.projectId);
  }
}

export interface BadgeCounts {
  inbox: number;
  today: number;
  upcoming: number;
  byProject: Map<Id, number>;
}

export function badgeCounts(snap: Snapshot): BadgeCounts {
  const tasks = liveTasks(snap).filter((task) => task.status !== "done");
  const byProject = new Map<Id, number>();
  let inbox = 0;
  let todayCount = 0;
  let upcoming = 0;
  const t = today();

  for (const task of tasks) {
    if (task.projectId === null) inbox += 1;
    else byProject.set(task.projectId, (byProject.get(task.projectId) ?? 0) + 1);

    if (task.dueAt !== null) {
      const d = dayDiff(task.dueAt, t);
      if (d <= 0) todayCount += 1;
      else if (d <= 7) upcoming += 1;
    }
  }
  return { inbox, today: todayCount, upcoming, byProject };
}

export function sortForList(tasks: Task[]): Task[] {
  const rank: Record<TaskStatus, number> = { doing: 0, review: 1, todo: 2, done: 3 };
  return [...tasks].sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    if (a.status === "done" && b.status === "done") return (b.doneAt ?? 0) - (a.doneAt ?? 0);
    const ad = a.dueAt ?? Number.MAX_SAFE_INTEGER;
    const bd = b.dueAt ?? Number.MAX_SAFE_INTEGER;
    if (ad !== bd) return ad - bd;
    return b.updatedAt - a.updatedAt;
  });
}

// ---------- 筛选与排序 ----------

const DUE_WINDOW_DAYS = 7;

export function applyFilters(tasks: Task[], filters: TaskFilters): Task[] {
  const needle = filters.text.trim().toLowerCase();
  const start = today();

  return tasks.filter((task) => {
    if (needle) {
      const haystack = `${task.title}\n${task.note}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) return false;
    if (filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) return false;
    if (filters.tagIds.length > 0 && !task.tagIds.some((id) => filters.tagIds.includes(id))) return false;

    switch (filters.due) {
      case "overdue":
        if (task.dueAt === null || dayDiff(task.dueAt, start) >= 0 || task.status === "done") return false;
        break;
      case "today":
        if (task.dueAt === null || dayDiff(task.dueAt, start) !== 0) return false;
        break;
      case "week": {
        if (task.dueAt === null) return false;
        const diff = dayDiff(task.dueAt, start);
        if (diff < 0 || diff > DUE_WINDOW_DAYS) return false;
        break;
      }
      case "none":
        if (task.dueAt !== null) return false;
        break;
      case "any":
      default:
        break;
    }

    return true;
  });
}

const PRIORITY_RANK: Record<Task["priority"], number> = { high: 0, mid: 1, low: 2 };

export function sortTasks(tasks: Task[], sort: SortKey): Task[] {
  if (sort === "default") return sortForList(tasks);

  const list = [...tasks];
  switch (sort) {
    case "due":
      return list.sort((a, b) => (a.dueAt ?? Number.MAX_SAFE_INTEGER) - (b.dueAt ?? Number.MAX_SAFE_INTEGER));
    case "priority":
      return list.sort((a, b) => {
        if (a.priority !== b.priority) return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        return (a.dueAt ?? Number.MAX_SAFE_INTEGER) - (b.dueAt ?? Number.MAX_SAFE_INTEGER);
      });
    case "updated":
      return list.sort((a, b) => b.updatedAt - a.updatedAt);
    case "title":
      return list.sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));
    default:
      return sortForList(list);
  }
}

export function activeViews(snap: Snapshot): SavedView[] {
  return snap.views.filter((view) => view.deletedAt === null).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function activeTemplates(snap: Snapshot) {
  return snap.templates.filter((template) => template.deletedAt === null).sort((a, b) => a.sortOrder - b.sortOrder);
}

/** 全局搜索：任务、项目、标签一起搜。 */
export function searchAll(snap: Snapshot, query: string): { tasks: Task[]; projects: Project[]; tags: Tag[] } {
  const needle = query.trim().toLowerCase();
  if (!needle) return { tasks: [], projects: [], tags: [] };

  const tasks = liveTasks(snap)
    .filter((task) => `${task.title}\n${task.note}`.toLowerCase().includes(needle))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 12);
  const projects = snap.projects
    .filter((project) => project.deletedAt === null && project.name.toLowerCase().includes(needle))
    .slice(0, 6);
  const tags = snap.tags.filter((tag) => tag.deletedAt === null && tag.name.toLowerCase().includes(needle)).slice(0, 6);

  return { tasks, projects, tags };
}

export { isOverdue };

// ---------- 依赖 ----------

export interface Blocking {
  dep: Dependency;
  /** 我等待的那个前置任务 */
  task: Task;
  /** 前置任务已完成 */
  resolved: boolean;
  /** 前置任务还没完，但我已经排到它前面开始了 */
  violated: boolean;
}

export function liveDependencies(snap: Snapshot): Dependency[] {
  const liveTaskIds = new Set(liveTasks(snap).map((task) => task.id));
  return snap.dependencies.filter(
    (dep) => dep.deletedAt === null && liveTaskIds.has(dep.taskId) && liveTaskIds.has(dep.dependsOnId)
  );
}

/** 我依赖的前置任务（我等待它们）。 */
export function blockersOf(snap: Snapshot, task: Task): Blocking[] {
  const tasks = new Map(liveTasks(snap).map((item) => [item.id, item]));
  return liveDependencies(snap)
    .filter((dep) => dep.taskId === task.id)
    .map((dep) => {
      const predecessor = tasks.get(dep.dependsOnId);
      if (!predecessor) return null;
      const resolved = predecessor.status === "done";
      const violated =
        !resolved &&
        task.startAt !== null &&
        predecessor.dueAt !== null &&
        startOfDay(task.startAt) < startOfDay(predecessor.dueAt);
      return { dep, task: predecessor, resolved, violated };
    })
    .filter((item): item is Blocking => item !== null);
}

/** 反过来：哪些任务在等我。 */
export function dependentsOf(snap: Snapshot, taskId: Id): Task[] {
  const tasks = new Map(liveTasks(snap).map((item) => [item.id, item]));
  return liveDependencies(snap)
    .filter((dep) => dep.dependsOnId === taskId)
    .map((dep) => tasks.get(dep.taskId))
    .filter((item): item is Task => item !== undefined);
}

export function blockedCount(snap: Snapshot, taskId: Id): number {
  const tasks = new Map(liveTasks(snap).map((item) => [item.id, item]));
  return liveDependencies(snap).filter((dep) => dep.taskId === taskId && tasks.get(dep.dependsOnId)?.status !== "done")
    .length;
}

// ---------- 提醒 ----------

export function settingValue(snap: Snapshot, key: string, fallback: string): string {
  const found = snap.settings.find((item) => item.deletedAt === null && item.id === key);
  return found?.value ?? fallback;
}

export function reminderOf(snap: Snapshot, taskId: Id): Reminder | null {
  return snap.reminders.find((item) => item.deletedAt === null && item.taskId === taskId) ?? null;
}

/** 提醒时刻 = 截止日当天的提醒时刻 - 提前量 */
export function remindAtMs(dueAt: number | null, offsetMinutes: number, timeOfDayMs: number): number | null {
  if (dueAt === null) return null;
  return startOfDay(dueAt) + timeOfDayMs - offsetMinutes * 60_000;
}

export interface DueReminder {
  reminder: Reminder;
  task: Task;
  at: number;
}

/** 已经到点、还没弹过的提醒。 */
export function dueReminders(snap: Snapshot, now: number, timeOfDayMs: number): DueReminder[] {
  const tasks = new Map(
    liveTasks(snap)
      .filter((task) => task.status !== "done")
      .map((task) => [task.id, task])
  );

  return snap.reminders
    .filter((reminder) => reminder.deletedAt === null && reminder.firedAt === null)
    .map((reminder) => {
      const task = tasks.get(reminder.taskId);
      if (!task) return null;
      const base = remindAtMs(task.dueAt, reminder.offsetMinutes, timeOfDayMs);
      if (base === null) return null;
      const at = reminder.snoozeUntil !== null && reminder.snoozeUntil > base ? reminder.snoozeUntil : base;
      if (at > now) return null;
      return { reminder, task, at };
    })
    .filter((item): item is DueReminder => item !== null)
    .sort((a, b) => a.at - b.at);
}

// ---------- 今日 ----------

export interface TodayBuckets {
  overdue: Task[];
  today: Task[];
  doing: Task[];
  doneToday: Task[];
}

export function todayBuckets(snap: Snapshot, now: number = Date.now()): TodayBuckets {
  const tasks = liveTasks(snap);
  const start = startOfDay(now);
  const end = addDays(start, 1);

  return {
    overdue: tasks
      .filter((task) => task.status !== "done" && task.dueAt !== null && startOfDay(task.dueAt) < start)
      .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0)),
    today: tasks
      .filter((task) => task.status !== "done" && task.dueAt !== null && startOfDay(task.dueAt) === start)
      .sort((a, b) => a.priority.localeCompare(b.priority)),
    doing: tasks
      .filter((task) => task.status === "doing" && task.dueAt === null)
      .sort((a, b) => a.title.localeCompare(b.title)),
    doneToday: tasks.filter((task) => task.doneAt !== null && task.doneAt >= start && task.doneAt < end)
  };
}

// ---------- 时间轴 ----------

export interface TimelineRange {
  start: number;
  days: number;
}

const MAX_DAYS = 140;

/**
 * 时间轴显示范围：覆盖所有已排期任务，并且一定包含今天。
 * 首尾对齐到周一/周日，看上去才像日历。
 */
export function timelineRange(tasks: Task[], now: number = Date.now()): TimelineRange {
  const stamps: number[] = [startOfDay(now)];
  for (const task of tasks) {
    if (task.startAt !== null) stamps.push(startOfDay(task.startAt));
    if (task.dueAt !== null) stamps.push(startOfDay(task.dueAt));
  }

  let min = Math.min(...stamps);
  let max = Math.max(...stamps);
  min = Math.min(min, addDays(startOfDay(now), -3));
  max = Math.max(max, addDays(startOfDay(now), 10));

  // 对齐到周一开头
  const weekday = (new Date(min).getDay() + 6) % 7;
  min = addDays(min, -weekday);

  const end = addDays(max, (7 - ((new Date(max).getDay() + 6) % 7) - 1 + 7) % 7);
  const days = Math.min(MAX_DAYS, Math.max(14, Math.round((end - min) / 86_400_000) + 1));
  return { start: min, days };
}
