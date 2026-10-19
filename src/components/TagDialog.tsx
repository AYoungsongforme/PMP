import { useState } from "react";
import { Plus, Tag as TagIcon, Trash2, X } from "lucide-react";
import { repo } from "../state/store";
import type { Snapshot } from "../data/types";

export default function TagDialog({ snapshot, onClose }: { snapshot: Snapshot; onClose: () => void }) {
  const tags = snapshot.tags.filter((tag) => tag.deletedAt === null);
  const [draft, setDraft] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const usage = (tagId: string) =>
    snapshot.tasks.filter((task) => task.deletedAt === null && task.tagIds.includes(tagId)).length;

  const add = () => {
    const name = draft.trim();
    if (!name) return;
    repo.ensureTag(name);
    setDraft("");
  };

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center px-4"
      style={{ background: "rgba(15,15,15,0.35)" }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-[440px] flex-col overflow-hidden rounded-xl"
        style={{ background: "var(--bg)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3">
          <TagIcon size={15} style={{ color: "var(--muted)" }} />
          <h2 className="ml-2 text-sm font-medium">标签管理</h2>
          <button className="icon-btn ml-auto" aria-label="关闭" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2 px-4 pb-3">
          <input
            className="input"
            placeholder="新标签名称"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") add();
            }}
          />
          <button className="btn" onClick={add} disabled={!draft.trim()}>
            <Plus size={14} />
            添加
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {tags.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs" style={{ color: "var(--muted)" }}>
              还没有标签。任务详情里也能直接新建。
            </p>
          ) : (
            tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                onMouseLeave={() => setConfirmId((current) => (current === tag.id ? null : current))}
              >
                <span className="dot" style={{ background: tag.color }} />
                <input
                  className="input h-7 flex-1"
                  style={{ fontSize: 12 }}
                  defaultValue={tag.name}
                  aria-label={`标签名称 ${tag.name}`}
                  onBlur={(event) => repo.renameTag(tag.id, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                />
                <span className="shrink-0 text-[11px]" style={{ color: "var(--faint)" }}>
                  {usage(tag.id)} 条
                </span>
                <button
                  className="icon-btn h-6 w-6"
                  aria-label={confirmId === tag.id ? `确认删除标签 ${tag.name}` : `删除标签 ${tag.name}`}
                  style={confirmId === tag.id ? { color: "var(--red)" } : undefined}
                  onClick={() => {
                    if (confirmId !== tag.id) {
                      setConfirmId(tag.id);
                      return;
                    }
                    repo.deleteTag(tag.id);
                    setConfirmId(null);
                  }}
                >
                  {confirmId === tag.id ? <span className="text-[10px]">确认</span> : <Trash2 size={13} />}
                </button>
              </div>
            ))
          )}
        </div>

        <p className="border-t px-4 py-2 text-[11px]" style={{ borderColor: "var(--border)", color: "var(--faint)" }}>
          改了名字直接点别处就会保存；删除标签会同时从任务上摘掉它。
        </p>
      </div>
    </div>
  );
}
