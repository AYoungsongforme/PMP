import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, FileText, Folder, Search, Tag as TagIcon } from "lucide-react";
import { searchAll } from "../data/select";
import { TASK_STATUS_LABEL, type Snapshot } from "../data/types";
import { formatShort } from "../lib/date";

interface Props {
  snapshot: Snapshot;
  onOpenTask: (id: string) => void;
  onOpenProject: (id: string) => void;
  onPickTag: (id: string) => void;
  onOpenDoc: (projectId: string, docId: string) => void;
  onClose: () => void;
}

type Item =
  | { kind: "task"; id: string; title: string; sub: string }
  | { kind: "project"; id: string; title: string; sub: string; color: string }
  | { kind: "tag"; id: string; title: string; sub: string }
  | { kind: "doc"; id: string; title: string; sub: string; projectId: string };

export default function SearchOverlay({ snapshot, onOpenTask, onOpenProject, onPickTag, onOpenDoc, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const items = useMemo<Item[]>(() => {
    const found = searchAll(snapshot, query);
    return [
      ...found.tasks.map((task) => ({
        kind: "task" as const,
        id: task.id,
        title: task.title,
        sub: `${TASK_STATUS_LABEL[task.status]}${task.dueAt ? ` · 截止 ${formatShort(task.dueAt)}` : ""}`
      })),
      ...found.projects.map((project) => ({
        kind: "project" as const,
        id: project.id,
        title: project.name,
        sub: "项目",
        color: project.color
      })),
      ...found.tags.map((tag) => ({ kind: "tag" as const, id: tag.id, title: tag.name, sub: "标签" })),
      ...found.docs.map((doc) => ({
        kind: "doc" as const,
        id: doc.id,
        title: doc.title,
        sub: "文档",
        projectId: doc.projectId
      }))
    ];
  }, [snapshot, query]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const pick = (item: Item | undefined) => {
    if (!item) return;
    if (item.kind === "task") onOpenTask(item.id);
    if (item.kind === "project") onOpenProject(item.id);
    if (item.kind === "tag") onPickTag(item.id);
    if (item.kind === "doc") onOpenDoc(item.projectId, item.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex justify-center px-4 pt-[12vh]"
      style={{ background: "rgba(15,15,15,0.35)" }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[70vh] w-full max-w-[560px] flex-col overflow-hidden rounded-xl"
        style={{ background: "var(--bg)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-3.5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <Search size={16} style={{ color: "var(--muted)" }} />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--fg)" }}
            placeholder="搜索任务、项目、标签…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((prev) => Math.min(prev + 1, items.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((prev) => Math.max(prev - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                pick(items[active]);
              } else if (event.key === "Escape") {
                onClose();
              }
            }}
          />
          <kbd className="rounded px-1.5 py-0.5 text-[10px]" style={{ border: "1px solid var(--border)", color: "var(--faint)" }}>
            Esc
          </kbd>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-1.5">
          {query.trim() === "" ? (
            <p className="px-3.5 py-6 text-center text-xs" style={{ color: "var(--faint)" }}>
              输入关键字开始搜索。支持搜备注内容，↑↓ 选择，回车打开。
            </p>
          ) : items.length === 0 ? (
            <p className="px-3.5 py-6 text-center text-xs" style={{ color: "var(--faint)" }}>
              没有匹配的结果。
            </p>
          ) : (
            items.map((item, index) => (
              <button
                key={`${item.kind}:${item.id}`}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left"
                style={{ background: index === active ? "var(--hover)" : "transparent" }}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(item)}
              >
                {item.kind === "task" ? (
                  <Search size={14} style={{ color: "var(--muted)" }} />
                ) : item.kind === "project" ? (
                  <Folder size={14} style={{ color: "var(--muted)" }} />
                ) : item.kind === "doc" ? (
                  <FileText size={14} style={{ color: "var(--muted)" }} />
                ) : (
                  <TagIcon size={14} style={{ color: "var(--muted)" }} />
                )}
                <span className="min-w-0 flex-1 truncate text-[13px]">{item.title}</span>
                <span className="shrink-0 text-[11px]" style={{ color: "var(--faint)" }}>
                  {item.sub}
                </span>
                {index === active ? <CornerDownLeft size={13} style={{ color: "var(--faint)" }} /> : null}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
