import {
  Archive,
  Bookmark,
  CalendarDays,
  ChevronDown,
  FilePlus2,
  Inbox,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Sun,
  Tag as TagIcon,
  X
} from "lucide-react";
import { activeProjects, archivedProjects, liveTasks, type BadgeCounts, type NavView } from "../data/select";
import { activeTemplates, activeViews } from "../data/select";
import type { Project, SavedView, Snapshot } from "../data/types";

interface Props {
  snapshot: Snapshot;
  nav: NavView;
  counts: BadgeCounts;
  onNavigate: (view: NavView) => void;
  onNewProject: () => void;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
  onApplyView: (view: SavedView) => void;
  onDeleteView: (id: string) => void;
  onUseTemplate: (id: string) => void;
  onDeleteTemplate: (id: string) => void;
  onManageProject: (project: Project) => void;
  onManageTags: () => void;
  width?: number;
}

function isActive(nav: NavView, kind: NavView["kind"], id?: string): boolean {
  if (nav.kind !== kind) return false;
  if (kind === "project" && nav.kind === "project") return nav.projectId === id;
  return true;
}

export default function Sidebar({
  snapshot,
  nav,
  counts,
  onNavigate,
  onNewProject,
  onOpenSettings,
  onOpenSearch,
  onApplyView,
  onDeleteView,
  onUseTemplate,
  onDeleteTemplate,
  onManageProject,
  onManageTags,
  width = 236
}: Props) {
  const projects = activeProjects(snapshot);
  const archived = archivedProjects(snapshot);
  const tags = snapshot.tags.filter((tag) => tag.deletedAt === null);
  const openTasks = liveTasks(snapshot).filter((task) => task.status !== "done");
  const views = activeViews(snapshot);
  const templates = activeTemplates(snapshot);

  return (
    <aside
      className="hidden shrink-0 flex-col gap-0.5 overflow-y-auto p-2 md:flex"
      style={{ width, background: "var(--side)", borderRight: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-2 px-1.5 pb-2.5 pt-1 font-medium">
        <span
          className="grid h-5 w-5 place-items-center rounded text-[11px]"
          style={{ background: "var(--fg)", color: "var(--bg)" }}
        >
          工
        </span>
        <span className="flex-1 truncate">工作台</span>
        <ChevronDown size={14} style={{ color: "var(--muted)" }} />
      </div>

      <button
        type="button"
        className="mb-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs"
        style={{ color: "var(--muted)", background: "var(--hover)", width: "100%" }}
        onClick={onOpenSearch}
      >
        <Search size={14} />
        <span className="flex-1 text-left">搜索任务</span>
        <kbd className="rounded px-1 text-[10px]" style={{ border: "1px solid var(--border)" }}>
          ⌘K
        </kbd>
      </button>

      <nav className="flex flex-col gap-0.5">
        <button className="nav-item" aria-current={isActive(nav, "inbox")} onClick={() => onNavigate({ kind: "inbox" })}>
          <Inbox size={15} style={{ color: "var(--muted)" }} />
          <span className="flex-1 truncate">收件箱</span>
          <span className="text-[11px]" style={{ color: "var(--faint)" }}>
            {counts.inbox || ""}
          </span>
        </button>
        <button className="nav-item" aria-current={isActive(nav, "today")} onClick={() => onNavigate({ kind: "today" })}>
          <Sun size={15} style={{ color: "var(--muted)" }} />
          <span className="flex-1 truncate">今天</span>
          <span className="text-[11px]" style={{ color: "var(--faint)" }}>
            {counts.today || ""}
          </span>
        </button>
        <button className="nav-item" aria-current={isActive(nav, "upcoming")} onClick={() => onNavigate({ kind: "upcoming" })}>
          <CalendarDays size={15} style={{ color: "var(--muted)" }} />
          <span className="flex-1 truncate">即将到期</span>
          <span className="text-[11px]" style={{ color: "var(--faint)" }}>
            {counts.upcoming || ""}
          </span>
        </button>
        <button className="nav-item" aria-current={isActive(nav, "all")} onClick={() => onNavigate({ kind: "all" })}>
          <span className="flex-1 truncate" style={{ color: "var(--muted)" }}>
            全部任务
          </span>
          <span className="text-[11px]" style={{ color: "var(--faint)" }}>
            {openTasks.length}
          </span>
        </button>
      </nav>

      <div className="px-1.5 pb-1 pt-3 text-[11px]" style={{ color: "var(--faint)" }}>
        项目
      </div>
      <nav className="flex flex-col gap-0.5">
        {projects.map((project) => (
          <div key={project.id} className="group flex items-center">
            <button
              className="nav-item min-w-0 flex-1"
              aria-current={isActive(nav, "project", project.id)}
              onClick={() => onNavigate({ kind: "project", projectId: project.id })}
            >
              <span className="dot" style={{ background: project.color }} />
              <span className="flex-1 truncate">{project.name}</span>
              <span className="text-[11px]" style={{ color: "var(--faint)" }}>
                {counts.byProject.get(project.id) || ""}
              </span>
            </button>
            <button
              className="icon-btn h-5 w-5 opacity-0 group-hover:opacity-100"
              aria-label={`管理项目 ${project.name}`}
              onClick={() => onManageProject(project)}
            >
              <MoreHorizontal size={13} />
            </button>
          </div>
        ))}
        <button className="nav-item" onClick={onNewProject} style={{ color: "var(--muted)" }}>
          <Plus size={15} />
          <span className="flex-1 truncate">新建项目</span>
        </button>
      </nav>

      {tags.length > 0 && (
        <>
          <div className="flex items-center px-1.5 pb-1 pt-3">
            <span className="text-[11px]" style={{ color: "var(--faint)" }}>
              标签
            </span>
            <button className="ml-auto text-[10.5px]" style={{ color: "var(--faint)" }} onClick={onManageTags}>
              管理
            </button>
          </div>
          <div className="flex flex-wrap gap-1 px-1.5 pb-1">
            {tags.map((tag) => (
              <span key={tag.id} className="chip">
                <TagIcon size={10} className="mr-1" />
                {tag.name}
              </span>
            ))}
          </div>
        </>
      )}

      {views.length > 0 && (
        <>
          <div className="px-1.5 pb-1 pt-3 text-[11px]" style={{ color: "var(--faint)" }}>
            视图
          </div>
          <nav className="flex flex-col gap-0.5">
            {views.map((view) => (
              <div key={view.id} className="group flex items-center">
                <button className="nav-item min-w-0" onClick={() => onApplyView(view)}>
                  <Bookmark size={14} style={{ color: "var(--muted)" }} />
                  <span className="flex-1 truncate">{view.name}</span>
                </button>
                <button className="icon-btn h-5 w-5 opacity-0 group-hover:opacity-100" aria-label={`删除视图 ${view.name}`} onClick={() => onDeleteView(view.id)}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </nav>
        </>
      )}

      {templates.length > 0 && (
        <>
          <div className="px-1.5 pb-1 pt-3 text-[11px]" style={{ color: "var(--faint)" }}>
            模板
          </div>
          <nav className="flex flex-col gap-0.5">
            {templates.map((template) => (
              <div key={template.id} className="group flex items-center">
                <button className="nav-item min-w-0" onClick={() => onUseTemplate(template.id)} title="点一下用这个模板建任务">
                  <FilePlus2 size={14} style={{ color: "var(--muted)" }} />
                  <span className="flex-1 truncate">{template.name}</span>
                </button>
                <button
                  className="icon-btn h-5 w-5 opacity-0 group-hover:opacity-100"
                  aria-label={`删除模板 ${template.name}`}
                  onClick={() => onDeleteTemplate(template.id)}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </nav>
        </>
      )}

      <div className="mt-auto flex flex-col gap-0.5 border-t pt-2" style={{ borderColor: "var(--border)" }}>
        <button className="nav-item" aria-current={isActive(nav, "archive")} onClick={() => onNavigate({ kind: "archive" })}>
          <Archive size={15} style={{ color: "var(--muted)" }} />
          <span className="flex-1 truncate">已归档</span>
          <span className="text-[11px]" style={{ color: "var(--faint)" }}>
            {archived.length || ""}
          </span>
        </button>
        <button className="nav-item" onClick={onOpenSettings}>
          <Settings size={15} />
          <span className="flex-1 truncate">设置</span>
        </button>
      </div>
    </aside>
  );
}
