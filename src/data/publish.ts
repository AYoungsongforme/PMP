import type { DocNode, Project, Snapshot, Tag, Task } from "./types";

/** 发布到站点上的数据结构。只放站点真正要用的东西。 */
export interface PublishedPayload {
  version: 1;
  app: "pmp";
  publishedAt: number;
  projects: Project[];
  tasks: Task[];
  tags: Tag[];
  /** 旧版本发布的数据里没有这个字段 */
  docs?: DocNode[];
}

export function buildPayload(snapshot: Snapshot, at: number = Date.now()): PublishedPayload {
  const live = <T extends { deletedAt: number | null }>(list: T[]): T[] => list.filter((item) => item.deletedAt === null);

  return {
    version: 1,
    app: "pmp",
    publishedAt: at,
    projects: live(snapshot.projects).sort((a, b) => a.sortOrder - b.sortOrder),
    tasks: live(snapshot.tasks).sort((a, b) => a.sortOrder - b.sortOrder),
    tags: live(snapshot.tags),
    docs: live(snapshot.docs).sort((a, b) => a.sortOrder - b.sortOrder)
  };
}

/** 最近一次修改的时间，用来和「上次发布」比较，判断有没有未发布的改动。 */
export function latestChangeAt(snapshot: Snapshot): number {
  let latest = 0;
  for (const list of [
    snapshot.projects,
    snapshot.tasks,
    snapshot.tags,
    snapshot.views,
    snapshot.templates,
    snapshot.reminders,
    snapshot.dependencies
  ]) {
    for (const item of list) {
      if (item.deletedAt === null && item.updatedAt > latest) latest = item.updatedAt;
    }
  }
  return latest;
}

export function isPayload(value: unknown): value is PublishedPayload {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return item.app === "pmp" && Array.isArray(item.projects) && Array.isArray(item.tasks);
}
