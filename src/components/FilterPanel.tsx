import { useState } from "react";
import { Bookmark, X } from "lucide-react";
import {
  EMPTY_FILTERS,
  SORT_LABEL,
  TASK_PRIORITY_LABEL,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  type DueFilter,
  type Snapshot,
  type SortKey,
  type TaskFilters,
  type TaskPriority,
  type TaskStatus
} from "../data/types";

interface Props {
  snapshot: Snapshot;
  filters: TaskFilters;
  sort: SortKey;
  onFilters: (filters: TaskFilters) => void;
  onSort: (sort: SortKey) => void;
  onSaveView: (name: string) => void;
}

const DUE_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: "any", label: "不限" },
  { value: "overdue", label: "已逾期" },
  { value: "today", label: "今天" },
  { value: "week", label: "七天内" },
  { value: "none", label: "无截止" }
];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function FilterPanel({ snapshot, filters, sort, onFilters, onSort, onSaveView }: Props) {
  const [viewName, setViewName] = useState("");
  const tags = snapshot.tags.filter((tag) => tag.deletedAt === null);

  const suggested =
    filters.text.trim() !== ""
      ? `搜索：${filters.text.trim()}`
      : filters.due !== "any"
        ? (DUE_OPTIONS.find((option) => option.value === filters.due)?.label ?? "我的视图")
        : "我的视图";

  return (
    <div className="flex flex-col gap-2.5 px-4 py-3" style={{ borderBottom: "1px solid var(--border)", background: "var(--side)" }}>
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          className="input"
          style={{ maxWidth: 220 }}
          placeholder="关键字（含备注）"
          value={filters.text}
          onChange={(event) => onFilters({ ...filters, text: event.target.value })}
        />

        <div className="seg">
          {TASK_STATUSES.map((status: TaskStatus) => (
            <button
              key={status}
              className="seg-item"
              aria-pressed={filters.statuses.includes(status)}
              onClick={() => onFilters({ ...filters, statuses: toggle(filters.statuses, status) })}
            >
              {TASK_STATUS_LABEL[status]}
            </button>
          ))}
        </div>

        <div className="seg">
          {(["high", "mid", "low"] as TaskPriority[]).map((priority) => (
            <button
              key={priority}
              className="seg-item"
              aria-pressed={filters.priorities.includes(priority)}
              onClick={() => onFilters({ ...filters, priorities: toggle(filters.priorities, priority) })}
            >
              {TASK_PRIORITY_LABEL[priority]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="seg">
          {DUE_OPTIONS.map((option) => (
            <button
              key={option.value}
              className="seg-item"
              aria-pressed={filters.due === option.value}
              onClick={() => onFilters({ ...filters, due: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>
          排序
          <select className="input" style={{ width: 150, height: 26, fontSize: 12 }} value={sort} onChange={(event) => onSort(event.target.value as SortKey)}>
            {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
              <option key={key} value={key}>
                {SORT_LABEL[key]}
              </option>
            ))}
          </select>
        </label>

        <button className="btn" onClick={() => onFilters({ ...EMPTY_FILTERS })}>
          <X size={13} />
          清除筛选
        </button>
      </div>

      {tags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="field-label">标签</span>
          {tags.map((tag) => {
            const on = filters.tagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                className="chip"
                aria-pressed={on}
                style={on ? { background: "var(--accent)", color: "#fff" } : undefined}
                onClick={() => onFilters({ ...filters, tagIds: toggle(filters.tagIds, tag.id) })}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Bookmark size={13} style={{ color: "var(--faint)" }} />
        <input
          className="input"
          style={{ maxWidth: 220, height: 26, fontSize: 12 }}
          aria-label="视图名称"
          placeholder={suggested}
          value={viewName}
          onChange={(event) => setViewName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onSaveView(viewName.trim() || suggested);
              setViewName("");
            }
          }}
        />
        <button
          className="btn"
          onClick={() => {
            onSaveView(viewName.trim() || suggested);
            setViewName("");
          }}
        >
          保存为视图
        </button>
        <span className="text-[11px]" style={{ color: "var(--faint)" }}>
          会记住「看哪儿 + 哪个视图 + 筛选 + 排序」
        </span>
      </div>
    </div>
  );
}
