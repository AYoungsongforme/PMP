import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { repo } from "../state/store";
import { projectById, type NavView } from "../data/select";
import { TASK_STATUS_LABEL, type Project, type Snapshot, type Task, type TaskStatus } from "../data/types";
import TaskRow from "./TaskRow";
import ProjectNotes from "./ProjectNotes";

interface Props {
  snapshot: Snapshot;
  nav: NavView;
  tasks: Task[];
  onOpenTask: (id: string) => void;
  project?: Project;
}

const GROUP_ORDER: TaskStatus[] = ["upcoming", "doing", "done", "cancelled"];

export default function ListView({ snapshot, nav, tasks, onOpenTask, project }: Props) {
  const [collapsed, setCollapsed] = useState<Set<TaskStatus>>(() => new Set(["done", "cancelled"]));
  const [draft, setDraft] = useState("");
  const [confirmCleanup, setConfirmCleanup] = useState(false);

  const projects = useMemo(() => projectById(snapshot), [snapshot]);

  const groups = useMemo(
    () =>
      GROUP_ORDER.map((status) => ({ status, items: tasks.filter((task) => task.status === status) })).filter(
        (group) => group.items.length > 0
      ),
    [tasks]
  );

  const currentProjectId = nav.kind === "project" ? nav.projectId : null;

  const toggleGroup = (status: TaskStatus) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const submitDraft = () => {
    const title = draft.trim();
    if (!title) return;
    repo.createTask({ title, projectId: currentProjectId, status: "upcoming" });
    setDraft("");
  };

  const quickAdd = (
    <div className="flex items-center gap-2">
      <Plus size={15} style={{ color: "var(--faint)" }} />
      <input
        className="input"
        placeholder="随手加一条任务，回车创建"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") submitDraft();
        }}
      />
    </div>
  );

  if (tasks.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-4">
        {project ? <ProjectNotes key={project.id} project={project} /> : null}
        {quickAdd}
        <p className="mt-6 text-center text-xs" style={{ color: "var(--muted)" }}>
          这里暂时没有任务。上面输入框敲一句话再回车就能建一条。
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-4">
      {project ? <ProjectNotes key={project.id} project={project} /> : null}
      {quickAdd}

      <div className="list-head mt-4">
        <span />
        <span>任务</span>
        <span>状态</span>
        <span className="col-pri">优先级</span>
        <span className="col-tags">项目 / 标签</span>
        <span>截止</span>
      </div>

      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.status);
        return (
          <section key={group.status}>
            <div className="flex items-center gap-2">
              <button className="group-head flex-1" onClick={() => toggleGroup(group.status)}>
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                {TASK_STATUS_LABEL[group.status]} · {group.items.length}
              </button>
              {group.status === "done" ? (
                <button
                  className="shrink-0 pr-2 text-[10.5px]"
                  style={{ color: confirmCleanup ? "var(--red)" : "var(--faint)" }}
                  onMouseLeave={() => setConfirmCleanup(false)}
                  onClick={() => {
                    if (!confirmCleanup) {
                      setConfirmCleanup(true);
                      return;
                    }
                    repo.deleteTasks(group.items.map((task) => task.id));
                    setConfirmCleanup(false);
                  }}
                >
                  {confirmCleanup ? `确认删除 ${group.items.length} 条` : "清理"}
                </button>
              ) : null}
            </div>

            {!isCollapsed &&
              group.items.map((task) => (
                <TaskRow key={task.id} task={task} snapshot={snapshot} onOpen={() => onOpenTask(task.id)} />
              ))}
          </section>
        );
      })}

      {nav.kind === "project" && projects.get(nav.projectId) === undefined ? (
        <p className="mt-4 text-xs" style={{ color: "var(--muted)" }}>
          这个项目已被删除。
        </p>
      ) : null}
    </div>
  );
}
