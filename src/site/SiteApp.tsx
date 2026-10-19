import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronDown, Lock, Search } from "lucide-react";
import { sortForList } from "../data/select";
import { TASK_PRIORITY_LABEL, TASK_STATUS_LABEL, type Project, type Tag, type Task, type TaskStatus } from "../data/types";
import { formatShort, startOfDay } from "../lib/date";
import { renderMarkdown } from "../lib/markdown";

interface PublishedData {
  version: number;
  publishedAt: number;
  projects: Project[];
  tasks: Task[];
  tags: Tag[];
}

const GROUP_ORDER: TaskStatus[] = ["doing", "review", "todo", "done"];

const STATUS_DOT: Record<TaskStatus, string> = {
  doing: "var(--accent)",
  review: "var(--amber)",
  todo: "var(--faint)",
  done: "var(--green)"
};

export default function SiteApp() {
  const [data, setData] = useState<PublishedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openTask, setOpenTask] = useState<string | null>(null);

  useEffect(() => {
    fetch("./data/published.json", { cache: "no-cache" })
      .then((response) => {
        if (!response.ok) throw new Error(`读取发布数据失败（HTTP ${response.status}）`);
        return response.json() as Promise<PublishedData>;
      })
      .then((json) => setData(json))
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)));
  }, []);

  const projects = useMemo(
    () => (data ? data.projects.filter((project) => project.deletedAt === null).sort((a, b) => a.sortOrder - b.sortOrder) : []),
    [data]
  );

  const current: Project | undefined = projects.find((project) => project.id === projectId) ?? projects[0];

  const tasks = useMemo(() => {
    if (!data || !current) return [];
    const needle = query.trim().toLowerCase();
    const list = data.tasks.filter((task) => task.deletedAt === null && task.projectId === current.id);
    const filtered = needle
      ? list.filter((task) => `${task.title}\n${task.note}`.toLowerCase().includes(needle))
      : list;
    return sortForList(filtered);
  }, [data, current, query]);

  const counts = useMemo(() => {
    const result: Record<TaskStatus, number> = { doing: 0, review: 0, todo: 0, done: 0 };
    for (const task of tasks) result[task.status] += 1;
    return result;
  }, [tasks]);

  if (error) {
    return (
      <div className="grid h-full place-items-center px-6 text-center">
        <div className="max-w-sm">
          <p className="font-medium">还没有可看的发布内容</p>
          <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
            {error}
          </p>
          <p className="mt-3 text-[11px]" style={{ color: "var(--faint)" }}>
            回到电脑上点一次「发布」，这里就会出现最新的快照。
          </p>
        </div>
      </div>
    );
  }

  if (!data || !current) {
    return (
      <div className="grid h-full place-items-center text-sm" style={{ color: "var(--muted)" }}>
        正在读取发布数据…
      </div>
    );
  }

  const total = tasks.length;
  const doneCount = counts.done;
  const progress = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  return (
    <div className="flex h-full">
      <aside
        className="hidden w-[236px] shrink-0 flex-col overflow-y-auto p-2 md:flex"
        style={{ background: "var(--side)", borderRight: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2 px-1.5 pb-2.5 pt-1 font-medium">
          <span
            className="grid h-5 w-5 place-items-center rounded text-[11px]"
            style={{ background: "var(--fg)", color: "var(--bg)" }}
          >
            工
          </span>
          <span className="flex-1">工作台</span>
          <span className="chip">只读</span>
        </div>

        <label className="mb-2 flex items-center gap-2 rounded-md px-2 py-1.5" style={{ background: "var(--hover)" }}>
          <Search size={14} style={{ color: "var(--muted)" }} />
          <input
            className="w-full bg-transparent text-xs outline-none"
            placeholder="搜索任务或备注"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="px-1.5 pb-1 pt-2 text-[11px]" style={{ color: "var(--faint)" }}>
          项目
        </div>
        <nav className="flex flex-col gap-0.5">
          {projects.map((project) => {
            const active = project.id === current.id;
            const count = data.tasks.filter((task) => task.deletedAt === null && task.projectId === project.id && task.status !== "done").length;
            return (
              <button
                key={project.id}
                className="nav-item"
                aria-current={active}
                onClick={() => {
                  setProjectId(project.id);
                  setOpenTask(null);
                }}
              >
                <span className="dot" style={{ background: project.color }} />
                <span className="flex-1 truncate">{project.name}</span>
                <span className="text-[11px]" style={{ color: "var(--faint)" }}>
                  {count || ""}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto border-t pt-2.5 text-[11px]" style={{ borderColor: "var(--border)", color: "var(--faint)" }}>
          <div className="flex items-center gap-1.5 px-1.5">
            <Lock size={11} />
            只读快照
          </div>
          <div className="px-1.5 pt-1">发布于 {formatShort(data.publishedAt)}</div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-2.5 px-4 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <span className="dot" style={{ background: current.color }} />
          <span className="font-medium">{current.name}</span>
          <span className="chip md:hidden">只读</span>
          <select
            className="input ml-auto w-auto md:hidden"
            style={{ height: 28, fontSize: 12 }}
            aria-label="切换项目"
            value={current.id}
            onChange={(event) => {
              setProjectId(event.target.value);
              setOpenTask(null);
            }}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <span className="ml-auto hidden items-center gap-1.5 text-[11px] md:flex" style={{ color: "var(--faint)" }}>
            <Lock size={11} /> 发布于 {formatShort(data.publishedAt)}
          </span>
        </header>

        <main className="site-scroll min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-5">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <h1 className="text-[18px] font-medium">{current.name}</h1>
                <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                  {current.description || "共 " + total + " 条任务"}
                  {doneCount > 0 ? `，已完成 ${doneCount} 条` : ""}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className="h-1.5 w-24 overflow-hidden rounded-full" style={{ background: "var(--gray-soft)" }}>
                  <span className="block h-full rounded-full" style={{ width: `${progress}%`, background: "var(--accent)" }} />
                </span>
                <span className="text-[11px] tabular-nums" style={{ color: "var(--muted)" }}>
                  {doneCount}/{total}
                </span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: "var(--muted)" }}>
              {GROUP_ORDER.map((status) => (
                <span key={status} className="inline-flex items-center gap-1.5">
                  <span className="dot" style={{ background: STATUS_DOT[status], width: 7, height: 7 }} />
                  {TASK_STATUS_LABEL[status]} {counts[status]}
                </span>
              ))}
            </div>

            {total === 0 ? (
              <p className="py-10 text-center text-xs" style={{ color: "var(--muted)" }}>
                {query ? "没有匹配的任务。" : "这个项目还没有任务。"}
              </p>
            ) : (
              GROUP_ORDER.map((status) => {
                const group = tasks.filter((task) => task.status === status);
                if (group.length === 0) return null;
                return (
                  <section key={status} className="mt-5">
                    <div className="flex items-center gap-1.5 pb-1 pl-1 text-[11px] font-medium" style={{ color: "var(--muted)" }}>
                      <ChevronDown size={12} />
                      {TASK_STATUS_LABEL[status]} · {group.length}
                    </div>
                    {group.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        tagNames={task.tagIds
                          .map((id) => data.tags.find((tag) => tag.id === id)?.name)
                          .filter((name): name is string => Boolean(name))}
                        open={openTask === task.id}
                        onToggle={() => setOpenTask(openTask === task.id ? null : task.id)}
                      />
                    ))}
                  </section>
                );
              })
            )}

            <footer className="mt-8 flex items-center gap-1.5 border-t pt-3 text-[11px]" style={{ borderColor: "var(--border)", color: "var(--faint)" }}>
              <BookOpen size={12} />
              这是电脑端发布的只读快照，手机上可以直接看，不能修改。
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

function TaskItem({
  task,
  tagNames,
  open,
  onToggle
}: {
  task: Task;
  tagNames: string[];
  open: boolean;
  onToggle: () => void;
}) {
  const overdue = task.status !== "done" && task.dueAt !== null && startOfDay(task.dueAt) < startOfDay(Date.now());

  return (
    <div>
      <button className="site-row" onClick={onToggle} aria-expanded={open}>
        <span className="dot" style={{ background: STATUS_DOT[task.status], width: 7, height: 7 }} />
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate" style={task.status === "done" ? { color: "var(--muted)", textDecoration: "line-through" } : undefined}>
            {task.title}
          </span>
          <span className={`tone-${task.priority} text-[11px]`}>{TASK_PRIORITY_LABEL[task.priority]}</span>
          {tagNames.slice(0, 2).map((name) => (
            <span key={name} className="chip hidden sm:inline-flex">
              {name}
            </span>
          ))}
        </span>
        <span>
          <span className={`pill pill-${task.status}`}>{TASK_STATUS_LABEL[task.status]}</span>
        </span>
        <span className="site-due text-[11px]" style={{ color: overdue ? "var(--red)" : "var(--muted)" }}>
          {task.dueAt ? formatShort(task.dueAt) : "—"}
        </span>
      </button>

      {open ? (
        <div className="site-note">
          {task.note ? (
            <div className="markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(task.note) }} />
          ) : (
            <span className="text-[11px]">这条任务没有备注。</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
