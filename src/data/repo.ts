import { createId } from "../lib/id";
import { today } from "../lib/date";
import { nextFutureOccurrence } from "../lib/repeat";
import { createKv, type KvStore } from "./kv";
import { materialize, parseLog, stringifyLog, type ChangeOp, type ChangeRecord } from "./log";
import { seedRecords } from "./seed";
import type {
  Dependency,
  EntityKind,
  Id,
  Project,
  Reminder,
  SavedView,
  Snapshot,
  SortKey,
  Tag,
  Task,
  TaskFilters,
  TaskPriority,
  TaskStatus,
  NavView,
  DocNode,
  RepeatFreq,
  Template
} from "./types";
import { emptySnapshot, PROJECT_COLORS } from "./types";

export interface NewTaskInput {
  title: string;
  projectId?: Id | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  startAt?: number | null;
  dueAt?: number | null;
  note?: string;
  tagIds?: Id[];
}

export interface NewProjectInput {
  name: string;
  color?: string;
}

type Listener = () => void;

const LOG_KEY = "log";
const DEVICE_KEY = "deviceId";

/**
 * 数据仓库：界面只跟它打交道，不关心数据存在浏览器里还是文件里。
 * 所有写操作都变成"追加一条变更记录"，当前状态由日志重放得到。
 */
export class Repo {
  private kv: KvStore = createKv();
  private records: ChangeRecord[] = [];
  private snapshot: Snapshot = emptySnapshot();
  private listeners = new Set<Listener>();
  private spawnListeners = new Set<(task: Task) => void>();
  private seq = 0;
  private flushTimer: number | null = null;

  deviceId = "";
  ready = false;

  get backend(): string {
    return this.kv.backend;
  }

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getSnapshot = (): Snapshot => this.snapshot;

  async init(): Promise<void> {
    this.deviceId = (await this.kv.get<string>(DEVICE_KEY)) ?? createId();
    await this.kv.set(DEVICE_KEY, this.deviceId);

    const text = (await this.kv.get<string>(LOG_KEY)) ?? "";
    this.records = parseLog(text);
    if (this.records.length === 0) {
      this.records = seedRecords(this.deviceId);
      await this.persist();
    }
    this.seq = this.records.reduce((max, r) => (r.deviceId === this.deviceId ? Math.max(max, r.seq) : max), 0);
    this.rebuild();
    this.migrateLegacyStatuses();
    this.ready = true;
    this.emit();
  }

  /**
   * 旧版本的状态要迁到新枚举：
   * 待办(todo) → 即将开始(upcoming)，待评审(review) → 进行中(doing)。
   */
  private migrateLegacyStatuses(): void {
    const legacy = this.snapshot.tasks.filter((task) => {
      if (task.deletedAt !== null) return false;
      const status = task.status as string;
      return status === "todo" || status === "review";
    });

    const legacyViews = this.snapshot.views.filter((view) => {
      if (view.deletedAt !== null) return false;
      const statuses = (view.filters?.statuses ?? []) as string[];
      return statuses.includes("todo") || statuses.includes("review");
    });

    if (legacy.length === 0 && legacyViews.length === 0) return;

    const mapStatus = (status: string): TaskStatus => (status === "todo" ? "upcoming" : "doing");

    this.writeBatch([
      ...legacy.map((task) => ({
        kind: "task" as EntityKind,
        entityId: task.id,
        op: "upsert" as ChangeOp,
        patch: { status: mapStatus(task.status as string) }
      })),
      ...legacyViews.map((view) => ({
        kind: "view" as EntityKind,
        entityId: view.id,
        op: "upsert" as ChangeOp,
        patch: {
          filters: {
            ...view.filters,
            statuses: [
              ...new Set(
                view.filters.statuses.map((status) => {
                  const value = status as string;
                  return value === "todo" || value === "review" ? mapStatus(value) : status;
                })
              )
            ]
          }
        }
      }))
    ]);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  private rebuild(): void {
    this.snapshot = materialize(this.records);
  }

  private write(kind: EntityKind, entityId: Id, op: ChangeOp, patch: Record<string, unknown>): void {
    this.seq += 1;
    this.records.push({ seq: this.seq, deviceId: this.deviceId, at: Date.now(), kind, entityId, op, patch });
    this.rebuild();
    this.emit();
    this.scheduleFlush();
  }

  /** 批量写入：一次重建、一次通知，避免循环里反复重算。 */
  private writeBatch(items: { kind: EntityKind; entityId: Id; op: ChangeOp; patch: Record<string, unknown> }[]): void {
    if (items.length === 0) return;
    const at = Date.now();
    for (const item of items) {
      this.seq += 1;
      this.records.push({
        seq: this.seq,
        deviceId: this.deviceId,
        at,
        kind: item.kind,
        entityId: item.entityId,
        op: item.op,
        patch: item.patch
      });
    }
    this.rebuild();
    this.emit();
    this.scheduleFlush();
  }

  /** 订阅「生成了下一次重复任务」的事件，用于界面提示。 */
  onTaskSpawned(listener: (task: Task) => void): () => void {
    this.spawnListeners.add(listener);
    return () => {
      this.spawnListeners.delete(listener);
    };
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== null) window.clearTimeout(this.flushTimer);
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = null;
      void this.persist();
    }, 200);
  }

  private async persist(): Promise<void> {
    await this.kv.set(LOG_KEY, stringifyLog(this.records));
  }

  // ---------- 项目 ----------

  createProject(input: NewProjectInput): Project {
    const at = Date.now();
    const order = this.snapshot.projects.reduce((max, p) => Math.max(max, p.sortOrder), 0) + 1;
    const project: Project = {
      id: createId(),
      name: input.name.trim() || "未命名项目",
      color: input.color ?? PROJECT_COLORS[this.snapshot.projects.length % PROJECT_COLORS.length],
      status: "active",
      description: "",
      sortOrder: order,
      createdAt: at,
      updatedAt: at,
      deletedAt: null
    };
    this.write("project", project.id, "upsert", { ...project });
    return project;
  }

  updateProject(id: Id, patch: Partial<Project>): void {
    this.write("project", id, "upsert", patch as Record<string, unknown>);
  }

  archiveProject(id: Id, archived = true): void {
    this.updateProject(id, { status: archived ? "done" : "active" });
  }

  deleteProject(id: Id, withTasks = false): void {
    const tasks = withTasks
      ? this.snapshot.tasks.filter((task) => task.deletedAt === null && task.projectId === id).map((task) => task.id)
      : [];
    this.writeBatch([
      { kind: "project", entityId: id, op: "delete", patch: {} },
      ...tasks.map((taskId) => ({ kind: "task" as EntityKind, entityId: taskId, op: "delete" as ChangeOp, patch: {} }))
    ]);
  }

  // ---------- 任务 ----------

  createTask(input: NewTaskInput): Task {
    const at = Date.now();
    const task: Task = {
      id: createId(),
      projectId: input.projectId ?? null,
      parentId: null,
      title: input.title.trim() || "未命名任务",
      note: input.note ?? "",
      status: input.status ?? "upcoming",
      priority: input.priority ?? "mid",
      startAt: input.startAt ?? null,
      dueAt: input.dueAt ?? null,
      doneAt: null,
      estimateMin: null,
      tagIds: input.tagIds ?? [],
      sortOrder: at,
      repeat: null,
      seriesId: null,
      createdAt: at,
      updatedAt: at,
      deletedAt: null
    };
    this.write("task", task.id, "upsert", { ...task });
    return task;
  }

  updateTask(id: Id, patch: Partial<Task>): void {
    const current = this.snapshot.tasks.find((task) => task.id === id && task.deletedAt === null);
    const next: Partial<Task> = { ...patch };
    if (patch.status !== undefined) {
      next.doneAt = patch.status === "done" ? Date.now() : null;
    }
    this.write("task", id, "upsert", next as Record<string, unknown>);

    // 从未完成变成完成时，如果设了重复规则就生成下一次
    if (current && patch.status === "done" && current.status !== "done") {
      this.spawnNextOccurrence(current, next);
    }
  }

  private spawnNextOccurrence(task: Task, patch: Partial<Task>): void {
    const freq = patch.repeat ?? task.repeat;
    if (!freq) return;

    const base = patch.dueAt ?? task.dueAt ?? Date.now();
    const nextDue = nextFutureOccurrence(base, freq, Date.now());
    const seriesId = task.seriesId ?? task.id;

    // 同一串里已经有这个日期的任务就不再生成，避免反复勾选勾出多条
    const duplicated = this.snapshot.tasks.some(
      (item) => item.deletedAt === null && item.seriesId === seriesId && item.dueAt === nextDue
    );
    if (duplicated) return;

    const at = Date.now();
    const span = task.startAt !== null && task.dueAt !== null ? task.dueAt - task.startAt : null;
    const next: Task = {
      id: createId(),
      projectId: task.projectId,
      parentId: task.parentId,
      title: task.title,
      note: task.note,
      status: "upcoming",
      priority: task.priority,
      startAt: span === null ? null : nextDue - span,
      dueAt: nextDue,
      doneAt: null,
      estimateMin: task.estimateMin,
      tagIds: [...task.tagIds],
      sortOrder: at,
      repeat: freq,
      seriesId,
      createdAt: at,
      updatedAt: at,
      deletedAt: null
    };
    this.write("task", next.id, "upsert", { ...next });
    for (const listener of this.spawnListeners) listener(next);
  }

  setTaskRepeat(id: Id, repeat: RepeatFreq | null): void {
    const task = this.snapshot.tasks.find((item) => item.id === id && item.deletedAt === null);
    if (!task) return;
    this.updateTask(id, { repeat, seriesId: repeat === null ? null : task.seriesId ?? task.id });
  }


  setTaskStatus(id: Id, status: TaskStatus): void {
    this.updateTask(id, { status });
  }

  deleteTask(id: Id): void {
    this.write("task", id, "delete", {});
  }

  deleteTasks(ids: Id[]): number {
    const unique = [...new Set(ids)];
    this.writeBatch(
      unique.map((id) => ({ kind: "task" as EntityKind, entityId: id, op: "delete" as ChangeOp, patch: {} }))
    );
    return unique.length;
  }

  // ---------- 文档 ----------

  createDoc(projectId: Id, parentId: Id | null, kind: DocNode["kind"]): DocNode {
    const at = Date.now();
    const siblings = this.snapshot.docs.filter((doc) => doc.deletedAt === null && doc.parentId === parentId && doc.projectId === projectId);
    const doc: DocNode = {
      id: createId(),
      projectId,
      parentId,
      kind,
      title: kind === "folder" ? "新建文件夹" : "未命名文档",
      content: "",
      tagIds: [],
      sortOrder: siblings.length + 1,
      createdAt: at,
      updatedAt: at,
      deletedAt: null
    };
    this.write("doc", doc.id, "upsert", { ...doc });
    return doc;
  }

  updateDoc(id: Id, patch: Partial<DocNode>): void {
    this.write("doc", id, "upsert", patch as Record<string, unknown>);
  }

  /** 删文件夹时把里面的文档一起软删除。 */
  deleteDoc(id: Id): void {
    const ids = new Set<Id>([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const doc of this.snapshot.docs) {
        if (doc.deletedAt === null && doc.parentId !== null && ids.has(doc.parentId) && !ids.has(doc.id)) {
          ids.add(doc.id);
          grew = true;
        }
      }
    }
    this.writeBatch([...ids].map((docId) => ({ kind: "doc" as EntityKind, entityId: docId, op: "delete" as ChangeOp, patch: {} })));
  }

  // ---------- 依赖 ----------

  addDependency(taskId: Id, dependsOnId: Id): void {
    if (taskId === dependsOnId) return;
    const exists = this.snapshot.dependencies.some(
      (dep) => dep.deletedAt === null && dep.taskId === taskId && dep.dependsOnId === dependsOnId
    );
    if (exists) return;
    if (this.wouldCycle(taskId, dependsOnId)) return;

    const at = Date.now();
    const dependency: Dependency = {
      id: createId(),
      taskId,
      dependsOnId,
      createdAt: at,
      updatedAt: at,
      deletedAt: null
    };
    this.write("dependency", dependency.id, "upsert", { ...dependency });
  }

  removeDependency(id: Id): void {
    this.write("dependency", id, "delete", {});
  }

  // ---------- 提醒 ----------

  setReminder(taskId: Id, offsetMinutes: number): void {
    const existing = this.snapshot.reminders.find((item) => item.deletedAt === null && item.taskId === taskId);
    if (existing) {
      this.write("reminder", existing.id, "upsert", { offsetMinutes, firedAt: null, snoozeUntil: null });
      return;
    }
    const at = Date.now();
    const reminder: Reminder = {
      id: createId(),
      taskId,
      offsetMinutes,
      firedAt: null,
      snoozeUntil: null,
      createdAt: at,
      updatedAt: at,
      deletedAt: null
    };
    this.write("reminder", reminder.id, "upsert", { ...reminder });
  }

  removeReminder(id: Id): void {
    this.write("reminder", id, "delete", {});
  }

  markReminderFired(id: Id, at: number = Date.now()): void {
    this.write("reminder", id, "upsert", { firedAt: at, snoozeUntil: null });
  }

  snoozeReminder(id: Id, until: number): void {
    this.write("reminder", id, "upsert", { firedAt: null, snoozeUntil: until });
  }

  // ---------- 设置 ----------

  setSetting(key: string, value: string): void {
    this.write("setting", key, "upsert", { value });
  }

  // ---------- 保存的视图 ----------

  createView(input: { name: string; nav: NavView; mode: string; filters: TaskFilters; sort: SortKey }): SavedView {
    const at = Date.now();
    const order = this.snapshot.views.reduce((max, view) => Math.max(max, view.sortOrder), 0) + 1;
    const view: SavedView = {
      id: createId(),
      name: input.name.trim() || "未命名视图",
      nav: input.nav,
      mode: input.mode,
      filters: input.filters,
      sort: input.sort,
      sortOrder: order,
      createdAt: at,
      updatedAt: at,
      deletedAt: null
    };
    this.write("view", view.id, "upsert", { ...view });
    return view;
  }

  deleteView(id: Id): void {
    this.write("view", id, "delete", {});
  }

  // ---------- 任务模板 ----------

  createTemplate(input: {
    name: string;
    title: string;
    note: string;
    priority: TaskPriority;
    projectId: Id | null;
    tagIds: Id[];
    dueOffsetDays: number | null;
    repeat: RepeatFreq | null;
  }): Template {
    const at = Date.now();
    const order = this.snapshot.templates.reduce((max, item) => Math.max(max, item.sortOrder), 0) + 1;
    const template: Template = {
      id: createId(),
      name: input.name.trim() || input.title,
      title: input.title,
      note: input.note,
      priority: input.priority,
      projectId: input.projectId,
      tagIds: [...input.tagIds],
      dueOffsetDays: input.dueOffsetDays,
      repeat: input.repeat,
      sortOrder: order,
      createdAt: at,
      updatedAt: at,
      deletedAt: null
    };
    this.write("template", template.id, "upsert", { ...template });
    return template;
  }

  deleteTemplate(id: Id): void {
    this.write("template", id, "delete", {});
  }

  createTaskFromTemplate(id: Id): Task | null {
    const template = this.snapshot.templates.find((item) => item.id === id && item.deletedAt === null);
    if (!template) return null;
    const due = template.dueOffsetDays === null ? null : today() + template.dueOffsetDays * 86_400_000;
    const task = this.createTask({
      title: template.title,
      projectId: template.projectId,
      priority: template.priority,
      note: template.note,
      dueAt: due,
      tagIds: [...template.tagIds]
    });
    if (template.repeat) this.setTaskRepeat(task.id, template.repeat);
    return this.snapshot.tasks.find((item) => item.id === task.id) ?? task;
  }

  /** 加依赖前检查会不会成环：沿 dependsOn 一路往外走，能回到 taskId 就是环。 */
  private wouldCycle(taskId: Id, dependsOnId: Id): boolean {
    const edges = this.snapshot.dependencies.filter((dep) => dep.deletedAt === null);
    const seen = new Set<Id>();
    const stack: Id[] = [dependsOnId];
    while (stack.length > 0) {
      const current = stack.pop() as Id;
      if (current === taskId) return true;
      if (seen.has(current)) continue;
      seen.add(current);
      for (const edge of edges) {
        if (edge.taskId === current) stack.push(edge.dependsOnId);
      }
    }
    return false;
  }

  // ---------- 标签 ----------

  ensureTag(name: string): Tag {
    const trimmed = name.trim();
    const existing = this.snapshot.tags.find((t) => t.deletedAt === null && t.name === trimmed);
    if (existing) return existing;
    const at = Date.now();
    const tag: Tag = {
      id: createId(),
      name: trimmed,
      color: PROJECT_COLORS[this.snapshot.tags.length % PROJECT_COLORS.length],
      createdAt: at,
      updatedAt: at,
      deletedAt: null
    };
    this.write("tag", tag.id, "upsert", { ...tag });
    return tag;
  }

  renameTag(id: Id, name: string): void {
    const next = name.trim();
    if (!next) return;
    this.write("tag", id, "upsert", { name: next });
  }

  /** 删除标签时，把任务里对它的引用一并摘掉。 */
  deleteTag(id: Id): void {
    const affected = this.snapshot.tasks.filter((task) => task.deletedAt === null && task.tagIds.includes(id));
    this.writeBatch([
      { kind: "tag", entityId: id, op: "delete", patch: {} },
      ...affected.map((task) => ({
        kind: "task" as EntityKind,
        entityId: task.id,
        op: "upsert" as ChangeOp,
        patch: { tagIds: task.tagIds.filter((tagId) => tagId !== id) }
      }))
    ]);
  }

  // ---------- 备份 ----------

  exportLog(): string {
    return stringifyLog(this.records);
  }

  importLog(text: string): number {
    const incoming = parseLog(text);
    const seen = new Set(this.records.map((r) => `${r.deviceId}:${r.seq}`));
    let added = 0;
    for (const r of incoming) {
      const key = `${r.deviceId}:${r.seq}`;
      if (seen.has(key)) continue;
      seen.add(key);
      this.records.push(r);
      added += 1;
    }
    if (added > 0) {
      this.seq = this.records.reduce((max, r) => (r.deviceId === this.deviceId ? Math.max(max, r.seq) : max), 0);
      this.rebuild();
      this.emit();
      void this.persist();
    }
    return added;
  }
}
