import { useState } from "react";
import { Archive, Trash2, X } from "lucide-react";
import { repo } from "../state/store";
import type { Project, Snapshot } from "../data/types";

export default function ProjectMenuDialog({
  project,
  snapshot,
  onClose
}: {
  project: Project;
  snapshot: Snapshot;
  onClose: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState(project.name);
  const taskCount = snapshot.tasks.filter((task) => task.deletedAt === null && task.projectId === project.id).length;
  const nameDirty = name.trim() !== "" && name.trim() !== project.name;

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center px-4"
      style={{ background: "rgba(15,15,15,0.35)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[400px] rounded-xl p-4"
        style={{ background: "var(--bg)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-medium">{project.name}</h2>
            <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--faint)" }}>
              {taskCount} 条任务
            </p>
          </div>
          <button className="icon-btn ml-auto" aria-label="关闭" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <input
            className="input"
            aria-label="项目名称"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && nameDirty) {
                repo.updateProject(project.id, { name: name.trim() });
              }
            }}
          />
          <button
            className="btn"
            disabled={!nameDirty}
            onClick={() => repo.updateProject(project.id, { name: name.trim() })}
          >
            保存
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <button
            className="btn justify-start"
            onClick={() => {
              repo.archiveProject(project.id, true);
              onClose();
            }}
          >
            <Archive size={14} />
            归档项目（任务保留，可在「已归档」里找到）
          </button>

          <button
            className="btn justify-start"
            style={confirming ? { borderColor: "var(--red)", color: "var(--red)" } : { color: "var(--red)" }}
            onClick={() => {
              if (!confirming) {
                setConfirming(true);
                return;
              }
              repo.deleteProject(project.id, true);
              onClose();
            }}
          >
            <Trash2 size={14} />
            {confirming ? `确认删除项目及 ${taskCount} 条任务` : "删除项目"}
          </button>

          {confirming ? (
            <p className="text-[11px]" style={{ color: "var(--muted)" }}>
              删除是软删除，数据仍在变更日志里，但界面上不再显示。再点一次红色按钮确认。
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
