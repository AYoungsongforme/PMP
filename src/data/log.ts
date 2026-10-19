import type { EntityKind, Id, Snapshot } from "./types";
import { emptySnapshot } from "./types";

export type ChangeOp = "upsert" | "delete";

/**
 * 一条变更记录 = 一次字段级修改。
 * 这是唯一需要跨设备同步的东西：只追加、不改写已有行。
 */
export interface ChangeRecord {
  /** 单设备内单调递增 */
  seq: number;
  deviceId: string;
  /** 发生时间（毫秒） */
  at: number;
  kind: EntityKind;
  entityId: Id;
  op: ChangeOp;
  /** upsert 时携带被修改的字段；delete 时为空 */
  patch: Record<string, unknown>;
}

const BUCKET: Record<EntityKind, keyof Snapshot> = {
  project: "projects",
  task: "tasks",
  tag: "tags",
  milestone: "milestones",
  dependency: "dependencies",
  reminder: "reminders",
  timeEntry: "timeEntries",
  setting: "settings",
  view: "views",
  template: "templates"
};

interface Mutable {
  id: Id;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  [key: string]: unknown;
}

/**
 * 老数据里没有的新字段在这里补默认值。
 * 变更日志是只追加的，字段只会越来越多，没有这一步旧记录就会缺字段。
 */
const DEFAULTS: Partial<Record<EntityKind, Record<string, unknown>>> = {
  task: { repeat: null, seriesId: null, tagIds: [] },
  reminder: { offsetMinutes: 0, firedAt: null, snoozeUntil: null },
  template: { tagIds: [], dueOffsetDays: null, repeat: null }
};

function order(a: ChangeRecord, b: ChangeRecord): number {
  if (a.at !== b.at) return a.at - b.at;
  if (a.deviceId !== b.deviceId) return a.deviceId < b.deviceId ? -1 : 1;
  return a.seq - b.seq;
}

/**
 * 把变更日志重放成当前状态。
 * 按时间排序后逐字段覆盖，等价于"字段级最后写入者获胜"，同一份日志在任何设备上重放结果一致。
 */
export function materialize(records: ChangeRecord[]): Snapshot {
  const buckets: Record<EntityKind, Map<Id, Mutable>> = {
    project: new Map(),
    task: new Map(),
    tag: new Map(),
    milestone: new Map(),
    dependency: new Map(),
    reminder: new Map(),
    timeEntry: new Map(),
    setting: new Map(),
    view: new Map(),
    template: new Map()
  };

  for (const r of [...records].sort(order)) {
    const bucket = buckets[r.kind];
    if (!bucket) continue;

    if (r.op === "delete") {
      const cur = bucket.get(r.entityId);
      if (cur) cur.deletedAt = r.at;
      continue;
    }

    const cur = bucket.get(r.entityId);
    if (!cur) {
      bucket.set(r.entityId, {
        id: r.entityId,
        createdAt: r.at,
        updatedAt: r.at,
        deletedAt: null,
        ...(DEFAULTS[r.kind] ?? {}),
        ...r.patch
      });
      continue;
    }

    const next: Mutable = { ...(DEFAULTS[r.kind] ?? {}), ...cur, ...r.patch, updatedAt: r.at };
    // 删除之后又发生的修改，视为恢复
    if (cur.deletedAt !== null && r.at > cur.deletedAt) next.deletedAt = null;
    bucket.set(r.entityId, next);
  }

  const snap = emptySnapshot();
  for (const kind of Object.keys(buckets) as EntityKind[]) {
    const list = [...buckets[kind].values()] as unknown[];
    (snap[BUCKET[kind]] as unknown[]) = list;
  }
  return snap;
}

export function parseLog(text: string): ChangeRecord[] {
  const out: ChangeRecord[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as ChangeRecord);
    } catch {
      // 跳过损坏的行，不让一行坏数据毁掉整个文件
    }
  }
  return out;
}

export function stringifyLog(records: ChangeRecord[]): string {
  return records.map((r) => JSON.stringify(r)).join("\n");
}
