import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import { CircleCheckBig, Link2, Plus, Repeat } from "lucide-react";
import { repo } from "../state/store";
import { blockedCount, projectById, tagById } from "../data/select";
import {
  TASK_PRIORITY_LABEL,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  type Snapshot,
  type Task,
  type TaskStatus
} from "../data/types";
import { formatDueLabel } from "../lib/date";

interface Props {
  snapshot: Snapshot;
  tasks: Task[];
  currentProjectId: string | null;
  onOpenTask: (id: string) => void;
}

const COLUMN_ORDER: TaskStatus[] = ["todo", "doing", "review", "done"];

export default function BoardView({ snapshot, tasks, currentProjectId, onOpenTask }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byStatus = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>();
    for (const status of TASK_STATUSES) map.set(status, []);
    for (const task of tasks) map.get(task.status)?.push(task);
    return map;
  }, [tasks]);

  const activeTask = activeId ? tasks.find((task) => task.id === activeId) ?? null : null;

  const onDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id));

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const overId = event.over?.id;
    if (!overId) return;
    const status = String(overId) as TaskStatus;
    if (!TASK_STATUSES.includes(status)) return;
    const taskId = String(event.active.id);
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.status === status) return;
    repo.setTaskStatus(taskId, status);
  };

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="flex gap-3 overflow-x-auto px-5 py-4">
        {COLUMN_ORDER.map((status) => (
          <Column
            key={status}
            status={status}
            tasks={byStatus.get(status) ?? []}
            snapshot={snapshot}
            currentProjectId={currentProjectId}
            onOpenTask={onOpenTask}
            draggingId={activeId}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? <CardBody task={activeTask} snapshot={snapshot} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

const DOT_COLOR: Record<TaskStatus, string> = {
  todo: "var(--faint)",
  doing: "var(--accent)",
  review: "var(--amber)",
  done: "var(--green)"
};

function Column({
  status,
  tasks,
  snapshot,
  currentProjectId,
  onOpenTask,
  draggingId
}: {
  status: TaskStatus;
  tasks: Task[];
  snapshot: Snapshot;
  currentProjectId: string | null;
  onOpenTask: (id: string) => void;
  draggingId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex w-[248px] shrink-0 flex-col gap-2">
      <div className="flex items-center gap-2 px-0.5 text-xs" style={{ color: "var(--muted)" }}>
        <span className="dot" style={{ background: DOT_COLOR[status] }} />
        <b className="font-medium" style={{ color: "var(--fg)" }}>
          {TASK_STATUS_LABEL[status]}
        </b>
        <span>{tasks.length}</span>
        <button
          className="icon-btn ml-auto h-6 w-6"
          aria-label={`在${TASK_STATUS_LABEL[status]}中新建任务`}
          onClick={() => repo.createTask({ title: "未命名任务", projectId: currentProjectId, status })}
        >
          <Plus size={14} />
        </button>
      </div>

      <div
        ref={setNodeRef}
        className="flex min-h-[120px] flex-col gap-2 rounded-lg p-2"
        style={{
          background: isOver ? "var(--accent-soft)" : "var(--gray-soft)",
          outline: isOver ? "1px dashed var(--accent)" : "none"
        }}
      >
        {tasks.map((task) => (
          <DraggableCard
            key={task.id}
            task={task}
            snapshot={snapshot}
            hidden={draggingId === task.id}
            onOpen={() => onOpenTask(task.id)}
          />
        ))}
        {tasks.length === 0 ? (
          <p className="px-1 py-4 text-center text-[11px]" style={{ color: "var(--faint)" }}>
            拖到这里
          </p>
        ) : null}
      </div>
    </div>
  );
}

function DraggableCard({
  task,
  snapshot,
  hidden,
  onOpen
}: {
  task: Task;
  snapshot: Snapshot;
  hidden: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      style={{ opacity: hidden ? 0.4 : 1, touchAction: "none" }}
    >
      <CardBody task={task} snapshot={snapshot} />
    </div>
  );
}

function CardBody({ task, snapshot, dragging = false }: { task: Task; snapshot: Snapshot; dragging?: boolean }) {
  const tags = tagById(snapshot);
  const projects = projectById(snapshot);
  const project = task.projectId ? projects.get(task.projectId) : undefined;
  const waiting = blockedCount(snapshot, task.id);
  const due = formatDueLabel(task.dueAt);
  const overdue = due.tone === "over" && task.status !== "done";

  return (
    <div
      className="flex flex-col gap-2 rounded-lg p-2.5"
      style={{
        background: "var(--bg)",
        border: `1px solid ${dragging ? "var(--accent)" : "var(--border)"}`,
        boxShadow: dragging ? "var(--shadow)" : "none"
      }}
    >
      <span className="text-[13px] font-medium" style={task.status === "done" ? { color: "var(--muted)", textDecoration: "line-through" } : undefined}>
        {task.title}
      </span>

      <div className="flex flex-wrap items-center gap-2 text-[11px]" style={{ color: "var(--muted)" }}>
        <span className={`tone-${task.priority}`}>{TASK_PRIORITY_LABEL[task.priority]}</span>
        {due.text ? <span className={overdue ? "tone-over" : due.tone === "soon" ? "tone-soon" : undefined}>{due.text}</span> : null}
        {waiting > 0 ? (
          <span className="inline-flex items-center gap-1">
            <Link2 size={11} />
            依赖 {waiting}
          </span>
        ) : null}
        {task.repeat ? (
          <span className="inline-flex items-center gap-1" aria-label="重复任务">
            <Repeat size={11} />
          </span>
        ) : null}
        {task.status === "done" ? <CircleCheckBig size={11} /> : null}
      </div>

      <div className="flex flex-wrap gap-1">
        {project ? (
          <span className="chip">
            <span className="dot mr-1" style={{ background: project.color, width: 7, height: 7 }} />
            {project.name}
          </span>
        ) : null}
        {task.tagIds
          .map((id) => tags.get(id))
          .filter((tag) => tag !== undefined)
          .slice(0, 2)
          .map((tag) => (
            <span key={tag.id} className="chip">
              {tag.name}
            </span>
          ))}
      </div>
    </div>
  );
}
