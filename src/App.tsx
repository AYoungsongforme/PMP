import { useEffect, useMemo, useState } from "react";
import { ensureInit, repo, useSnapshot } from "./state/store";
import { useReminders } from "./state/useReminders";
import { applyFilters, badgeCounts, filterTasks, liveTasks, sortTasks } from "./data/select";
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
import type { Id } from "./data/types";

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
