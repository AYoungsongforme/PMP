import { ChevronRight, CloudUpload, FileText, GanttChart, List, Plus, SlidersHorizontal, SquareKanban } from "lucide-react";
import type { NavView } from "../data/select";
import { projectById } from "../data/select";
import type { Snapshot } from "../data/types";
import type { ViewMode } from "../App";

interface Props {
  snapshot: Snapshot;
  nav: NavView;
  mode: ViewMode;
  onMode: (mode: ViewMode) => void;
  onNewTask: () => void;
  filterCount: number;
  filterOpen: boolean;
  onToggleFilter: () => void;
  publishDirty: boolean;
  onPublish: () => void;
}

const TITLES: Record<NavView["kind"], string> = {
  all: "全部任务",
  inbox: "收件箱",
  today: "今天",
  upcoming: "即将到期",
  project: "项目",
  archive: "已归档"
};

export default function Topbar({
  snapshot,
  nav,
  mode,
  onMode,
  onNewTask,
  filterCount,
  filterOpen,
  onToggleFilter,
  publishDirty,
  onPublish
}: Props) {
  const project = nav.kind === "project" ? projectById(snapshot).get(nav.projectId) : undefined;
  const title = project?.name ?? TITLES[nav.kind];

  return (
    <header
      className="flex flex-wrap items-center gap-2.5 px-4 py-2"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <div className="flex min-w-0 items-center gap-1.5 font-medium">
        {project ? (
          <>
            <span style={{ color: "var(--faint)" }}>工作</span>
            <ChevronRight size={13} style={{ color: "var(--faint)" }} />
          </>
        ) : null}
        <span className="truncate">{title}</span>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <div className="seg">
          <button className="seg-item" aria-pressed={mode === "list"} onClick={() => onMode("list")}>
            <List size={14} />
            列表
          </button>
          <button className="seg-item" aria-pressed={mode === "board"} onClick={() => onMode("board")}>
            <SquareKanban size={14} />
            看板
          </button>
          <button className="seg-item" aria-pressed={mode === "timeline"} onClick={() => onMode("timeline")}>
            <GanttChart size={14} />
            时间轴
          </button>
          <button className="seg-item" aria-pressed={mode === "docs"} onClick={() => onMode("docs")}>
            <FileText size={14} />
            文档
          </button>
        </div>
        <button className="btn" aria-pressed={filterOpen} onClick={onToggleFilter}>
          <SlidersHorizontal size={14} />
          筛选
          {filterCount > 0 ? (
            <span className="pill" style={{ background: "var(--accent)", color: "#fff", padding: "0 5px" }}>
              {filterCount}
            </span>
          ) : null}
        </button>
        <button className="btn" onClick={onPublish} title={publishDirty ? "有未发布的改动" : "发布到 GitHub Pages"}>
          <CloudUpload size={14} />
          发布
          {publishDirty ? (
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--amber)" }} aria-label="有未发布的改动" />
          ) : null}
        </button>
        <button className="btn btn-primary" onClick={onNewTask}>
          <Plus size={15} />
          新建任务
        </button>
      </div>
    </header>
  );
}
