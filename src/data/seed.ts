import { createId } from "../lib/id";
import { addDays, today } from "../lib/date";
import type { ChangeRecord } from "./log";
import { PROJECT_COLORS, type Project, type Tag, type Task } from "./types";

/**
 * 首次启动时的示例数据，直接写成变更日志，
 * 保证"日志是唯一事实来源"这条规则在第一天就成立。
 */
export function seedRecords(deviceId: string): ChangeRecord[] {
  const out: ChangeRecord[] = [];
  let seq = 0;
  let at = Date.now() - 60_000;

  const push = (kind: ChangeRecord["kind"], entityId: string, patch: Record<string, unknown>) => {
    seq += 1;
    at += 1;
    out.push({ seq, deviceId, at, kind, entityId, op: "upsert", patch });
  };

  const base = { createdAt: at, updatedAt: at, deletedAt: null };
  const t = today();

  const project = (name: string, colorIndex: number, sortOrder: number): Project => {
    const p: Project = {
      ...base,
      id: createId(),
      name,
      color: PROJECT_COLORS[colorIndex],
      status: "active",
      description: "",
      sortOrder
    };
    push("project", p.id, { ...p });
    return p;
  };

  const revisions = project("产品改版 v2.0", 0, 1);
  const dashboard = project("数据看板迁移", 1, 2);
  const review = project("Q3 述职", 2, 3);
  const hiring = project("招聘 · 前端", 3, 4);

  const tag = (name: string): Tag => {
    const tg: Tag = { ...base, id: createId(), name, color: PROJECT_COLORS[5] };
    push("tag", tg.id, { ...tg });
    return tg;
  };

  const tagRequirement = tag("需求");
  const tagCross = tag("跨部门");
  const tagDesign = tag("设计评审");
  const tagReport = tag("汇报");

  const task = (
    title: string,
    opts: Partial<Task> & { projectId: string | null; tagIds?: string[] } = { projectId: null }
  ): Task => {
    const tk: Task = {
      ...base,
      id: createId(),
      projectId: opts.projectId,
      parentId: opts.parentId ?? null,
      title,
      note: opts.note ?? "",
      status: opts.status ?? "todo",
      priority: opts.priority ?? "mid",
      startAt: opts.startAt ?? null,
      dueAt: opts.dueAt ?? null,
      doneAt: opts.status === "done" ? at : null,
      estimateMin: opts.estimateMin ?? null,
      tagIds: opts.tagIds ?? [],
      sortOrder: opts.sortOrder ?? at,
      repeat: opts.repeat ?? null,
      seriesId: opts.seriesId ?? null
    };
    push("task", tk.id, { ...tk });
    return tk;
  };

  task("梳理 v2.0 需求范围", {
    projectId: revisions.id,
    status: "doing",
    priority: "high",
    startAt: addDays(t, -1),
    dueAt: addDays(t, 3),
    estimateMin: 360,
    tagIds: [tagRequirement.id, tagCross.id],
    note: "范围只覆盖首页与登录，不含后台管理。\n\n- 与业务方对齐目标\n- 收集现有流程图\n- 输出需求文档初稿"
  });
  task("输出数据埋点方案", {
    projectId: revisions.id,
    status: "doing",
    priority: "mid",
    startAt: addDays(t, 1),
    dueAt: addDays(t, 7),
    tagIds: [tagCross.id]
  });
  task("竞品交互对比", {
    projectId: revisions.id,
    status: "doing",
    priority: "low",
    dueAt: addDays(t, -2)
  });
  task("评审首页改版稿", {
    projectId: revisions.id,
    status: "todo",
    priority: "high",
    startAt: addDays(t, 6),
    dueAt: addDays(t, 10),
    tagIds: [tagDesign.id]
  });
  task("联调登录接口", {
    projectId: revisions.id,
    status: "todo",
    priority: "high",
    startAt: addDays(t, 11),
    dueAt: addDays(t, 16)
  });
  task("补写接口文档", { projectId: revisions.id, priority: "low" });
  task("需求池整理", {
    projectId: revisions.id,
    status: "done",
    priority: "low",
    dueAt: addDays(t, -4)
  });
  task("v2.0 立项文档", {
    projectId: revisions.id,
    status: "done",
    priority: "mid",
    dueAt: addDays(t, -5)
  });
  task("首页改版高保真稿", {
    projectId: revisions.id,
    status: "review",
    priority: "mid",
    dueAt: addDays(t, 2)
  });
  task("数据口径确认", {
    projectId: dashboard.id,
    status: "review",
    priority: "mid",
    dueAt: addDays(t, 1),
    tagIds: [tagCross.id]
  });
  task("迁移历史报表", {
    projectId: dashboard.id,
    status: "todo",
    priority: "mid",
    startAt: addDays(t, 4),
    dueAt: addDays(t, 12)
  });
  task("整理 Q3 成果数据", {
    projectId: review.id,
    status: "todo",
    priority: "mid",
    startAt: addDays(t, 13),
    dueAt: addDays(t, 17),
    tagIds: [tagReport.id]
  });
  task("写述职初稿", {
    projectId: review.id,
    status: "doing",
    priority: "high",
    startAt: addDays(t, 0),
    dueAt: addDays(t, 5)
  });
  task("筛选前端简历", {
    projectId: hiring.id,
    status: "doing",
    priority: "mid",
    dueAt: addDays(t, 2)
  });
  task("安排一面时间", { projectId: hiring.id, priority: "low", dueAt: addDays(t, 4) });
  task("随手记：周会提到的资源问题", { projectId: null, priority: "mid", dueAt: t });
  task("每日站会纪要", { projectId: null, priority: "mid", dueAt: t, repeat: "weekdays" });
  task("提交周报", {
    projectId: review.id,
    priority: "mid",
    dueAt: addDays(t, (5 - new Date(t).getDay() + 7) % 7),
    repeat: "weekly"
  });

  const template = (input: {
    name: string;
    title: string;
    priority?: Task["priority"];
    projectId: string | null;
    dueOffsetDays?: number | null;
    note?: string;
    repeat?: Task["repeat"];
  }): void => {
    const at2 = (at += 1);
    push("template", createId(), {
      name: input.name,
      title: input.title,
      note: input.note ?? "",
      priority: input.priority ?? "mid",
      projectId: input.projectId,
      tagIds: [],
      dueOffsetDays: input.dueOffsetDays ?? null,
      repeat: input.repeat ?? null,
      sortOrder: at2,
      createdAt: at2,
      updatedAt: at2,
      deletedAt: null
    });
  };

  template({ name: "会议纪要", title: "整理会议纪要并同步", priority: "mid", projectId: null, dueOffsetDays: 0 });
  template({
    name: "需求评审",
    title: "组织需求评审会",
    priority: "high",
    projectId: revisions.id,
    dueOffsetDays: 2,
    note: "提前一天把材料发出去。"
  });
  template({
    name: "每周复盘",
    title: "本周复盘与下周计划",
    priority: "mid",
    projectId: null,
    dueOffsetDays: 0,
    repeat: "weekly"
  });

  return out;
}
