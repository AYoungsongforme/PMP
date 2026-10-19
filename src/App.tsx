import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { ensureInit, repo, useSnapshot } from "./state/store";
import { useReminders } from "./state/useReminders";
import { applyFilters, badgeCounts, filterTasks, liveTasks, projectById, sortTasks } from "./data/select";
import { settingValue } from "./data/select";
import { latestChangeAt } from "./data/publish";
import { EMPTY_FILTERS, hasActiveFilters, type NavView, type SavedView, type SortKey, type TaskFilters } from "./data/types";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import ListView from "./components/ListView";
import BoardView from "./components/BoardView";
import TimelineView from "./components/TimelineView";
import TodayView from "./components/TodayView";
import TaskDrawer from "./components/TaskDrawer";
import ProjectDialog from "./components/ProjectDialog";
import SettingsDialog from "./components/SettingsDialog";
import ReminderToasts from "./components/ReminderToasts";
import SearchOverlay from "./components/SearchOverlay";
import FilterPanel from "./components/FilterPanel";
import PublishDialog from "./components/PublishDialog";
import ProjectMenuDialog from "./components/ProjectMenuDialog";
import TagDialog from "./components/TagDialog";
import { formatShort } from "./lib/date";
import type { Id, Project } from "./data/types";

export type ViewMode = "list" | "board" | "timeline";

export default function App() {
  const snap = useSnapshot();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [nav, setNav] = useState<NavView>({ kind: "all" });
  const [mode, setMode] = useState<ViewMode>("list");
  const [openTaskId, setOpenTaskId] = useState<Id | null>(null);
  const [creatingProject, setCreatingProject] = useState(false);
  const [focusTitle, setFocusTitle] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>("default");
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [manageProject, setManageProject] = useState<Project | null>(null);
  const [showTags, setShowTags] = useState(false);
  const [spawnToast, setSpawnToast] = useState<{ id: string; title: string; dueAt: number | null } | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = Number(localStorage.getItem("pmp:sidebarWidth"));
    return Number.isFinite(saved) && saved >= 180 && saved <= 460 ? saved : 236;
  });
  const [resizing, setResizing] = useState(false);
  const dragging = useRef(false);
  const reminders = useReminders();

  useEffect(() => {
    let alive = true;
    ensureInit()
      .then(() => {
        if (alive) setReady(true);
      })
      .catch((error: unknown) => {
        if (alive) setFailed(error instanceof Error ? error.message : String(error));
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    return repo.onTaskSpawned((task) => {
      setSpawnToast({ id: task.id, title: task.title, dueAt: task.dueAt });
    });
  }, []);

  useEffect(() => {
    if (!spawnToast) return;
    const timer = window.setTimeout(() => setSpawnToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [spawnToast]);

  const tasks = useMemo(
    () => sortTasks(applyFilters(filterTasks(snap, nav), filters), sort),
    [snap, nav, filters, sort]
  );
  const counts = useMemo(() => badgeCounts(snap), [snap]);
  const publishDirty = useMemo(() => {
    const last = Number(settingValue(snap, "lastPublishedAt", "0"));
    return latestChangeAt(snap) > last;
  }, [snap]);
  const openTask = useMemo(
    () => (openTaskId ? liveTasks(snap).find((task) => task.id === openTaskId) ?? null : null),
    [snap, openTaskId]
  );
  const currentProject = nav.kind === "project" ? projectById(snap).get(nav.projectId) : undefined;

  const createTask = () => {
    const projectId = nav.kind === "project" ? nav.projectId : null;
    const task = repo.createTask({ title: "未命名任务", projectId });
    setFocusTitle(true);
    setOpenTaskId(task.id);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filterCount =
    filters.statuses.length + filters.priorities.length + filters.tagIds.length + (filters.due !== "any" ? 1 : 0) + (filters.text.trim() ? 1 : 0);

  const applyView = (view: SavedView) => {
    setNav(view.nav);
    setMode(view.mode as ViewMode);
    setFilters({ ...EMPTY_FILTERS, ...view.filters });
    setSort(view.sort);
  };

  if (failed) {
    return (
      <div className="grid h-full place-items-center px-6 text-center">
        <div>
          <p className="font-medium">本地数据载入失败</p>
          <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
            {failed}
          </p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="grid h-full place-items-center text-sm" style={{ color: "var(--muted)" }}>
        正在载入本地数据…
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <Sidebar
        width={sidebarWidth}
        snapshot={snap}
        nav={nav}
        counts={counts}
        onNavigate={setNav}
        onNewProject={() => setCreatingProject(true)}
        onOpenSettings={() => setShowSettings(true)}
        onOpenSearch={() => setSearchOpen(true)}
        onApplyView={applyView}
        onDeleteView={(id) => repo.deleteView(id)}
        onUseTemplate={(id) => {
          const created = repo.createTaskFromTemplate(id);
          if (created) {
            setFocusTitle(false);
            setOpenTaskId(created.id);
          }
        }}
        onDeleteTemplate={(id) => repo.deleteTemplate(id)}
        onManageProject={setManageProject}
        onManageTags={() => setShowTags(true)}
      />

      <div
        className="resizer hidden md:block"
        role="separator"
        aria-orientation="vertical"
        aria-label="调整侧栏宽度"
        data-dragging={resizing}
        onDoubleClick={() => {
          setSidebarWidth(236);
          localStorage.setItem("pmp:sidebarWidth", "236");
        }}
        onPointerDown={(event) => {
          dragging.current = true;
          setResizing(true);
          event.currentTarget.setPointerCapture(event.pointerId);
          event.preventDefault();
        }}
        onPointerMove={(event) => {
          if (!dragging.current) return;
          setSidebarWidth(Math.min(460, Math.max(180, event.clientX)));
        }}
        onPointerUp={(event) => {
          if (!dragging.current) return;
          dragging.current = false;
          setResizing(false);
          const next = Math.min(460, Math.max(180, event.clientX));
          setSidebarWidth(next);
          localStorage.setItem("pmp:sidebarWidth", String(next));
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          dragging.current = false;
          setResizing(false);
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          snapshot={snap}
          nav={nav}
          mode={mode}
          onMode={setMode}
          onNewTask={createTask}
          filterCount={filterCount}
          filterOpen={filterOpen}
          onToggleFilter={() => setFilterOpen((prev) => !prev)}
          publishDirty={publishDirty}
          onPublish={() => setPublishOpen(true)}
        />

        {filterOpen ? (
          <FilterPanel
            snapshot={snap}
            filters={filters}
            sort={sort}
            onFilters={setFilters}
            onSort={setSort}
            onSaveView={(name) => repo.createView({ name, nav, mode, filters, sort })}
          />
        ) : hasActiveFilters(filters) ? (
          <div
            className="flex flex-wrap items-center gap-2 px-4 py-1.5 text-[11px]"
            style={{ borderBottom: "1px solid var(--border)", background: "var(--side)", color: "var(--muted)" }}
          >
            筛选生效中 · {tasks.length} 条
            {filters.text.trim() ? <span className="chip">关键字：{filters.text.trim()}</span> : null}
            {filters.statuses.length > 0 ? <span className="chip">{filters.statuses.length} 个状态</span> : null}
            {filters.priorities.length > 0 ? <span className="chip">{filters.priorities.length} 个优先级</span> : null}
            {filters.tagIds.length > 0 ? <span className="chip">{filters.tagIds.length} 个标签</span> : null}
            {filters.due !== "any" ? <span className="chip">截止条件</span> : null}
            <button className="btn" style={{ height: 22, fontSize: 11 }} onClick={() => setFilters({ ...EMPTY_FILTERS })}>
              清除
            </button>
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {mode === "list" && nav.kind === "today" ? (
            <TodayView
              snapshot={snap}
              onOpenTask={(id) => {
                setFocusTitle(false);
                setOpenTaskId(id);
              }}
            />
          ) : mode === "list" ? (
            <ListView
              snapshot={snap}
              nav={nav}
              tasks={tasks}
              project={currentProject}
              onOpenTask={(id) => {
                setFocusTitle(false);
                setOpenTaskId(id);
              }}
            />
          ) : mode === "board" ? (
            <BoardView
              snapshot={snap}
              tasks={tasks}
              currentProjectId={nav.kind === "project" ? nav.projectId : null}
              onOpenTask={(id) => {
                setFocusTitle(false);
                setOpenTaskId(id);
              }}
            />
          ) : (
            <TimelineView
              snapshot={snap}
              tasks={tasks}
              highlightTaskId={openTaskId}
              onOpenTask={(id) => {
                setFocusTitle(false);
                setOpenTaskId(id);
              }}
            />
          )}
        </div>
      </div>

      {openTask && (
        <TaskDrawer
          key={openTask.id}
          snapshot={snap}
          task={openTask}
          focusTitle={focusTitle}
          onOpenTask={(id) => {
            setFocusTitle(false);
            setOpenTaskId(id);
          }}
          onClose={() => setOpenTaskId(null)}
        />
      )}

      {creatingProject && <ProjectDialog onClose={() => setCreatingProject(false)} />}

      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}

      {publishOpen && <PublishDialog snapshot={snap} onClose={() => setPublishOpen(false)} />}

      {manageProject && (
        <ProjectMenuDialog
          project={manageProject}
          snapshot={snap}
          onClose={() => {
            setManageProject(null);
            if (
              nav.kind === "project" &&
              !snap.projects.some(
                (project) => project.id === nav.projectId && project.deletedAt === null && project.status !== "done"
              )
            ) {
              setNav({ kind: "all" });
            }
          }}
        />
      )}

      {showTags && <TagDialog snapshot={snap} onClose={() => setShowTags(false)} />}

      {spawnToast ? (
        <div
          className="fixed bottom-4 left-4 z-50 flex max-w-[320px] items-start gap-2.5 rounded-xl p-3"
          style={{ background: "var(--bg)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}
          role="status"
        >
          <span
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            <RefreshCw size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px]">这是重复任务，已生成下一次</div>
            <div className="truncate text-[11px]" style={{ color: "var(--muted)" }}>
              {spawnToast.title} · {formatShort(spawnToast.dueAt)}
            </div>
            <button
              className="btn mt-1.5"
              style={{ height: 22, fontSize: 11 }}
              onClick={() => {
                repo.deleteTask(spawnToast.id);
                setSpawnToast(null);
              }}
            >
              撤销生成
            </button>
          </div>
          <button className="icon-btn h-5 w-5" aria-label="关闭提示" onClick={() => setSpawnToast(null)}>
            <X size={12} />
          </button>
        </div>
      ) : null}

      <ReminderToasts
        alerts={reminders.alerts}
        onOpen={(id) => {
          setFocusTitle(false);
          setOpenTaskId(id);
        }}
        onSnooze={reminders.snooze}
        onDismiss={reminders.dismiss}
      />

      {searchOpen && (
        <SearchOverlay
          snapshot={snap}
          onOpenTask={(id) => {
            setFocusTitle(false);
            setOpenTaskId(id);
          }}
          onOpenProject={(id) => {
            setNav({ kind: "project", projectId: id });
            setMode("list");
          }}
          onPickTag={(id) => setFilters({ ...EMPTY_FILTERS, tagIds: [id] })}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
  );
}
