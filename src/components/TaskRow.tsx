import { Repeat } from "lucide-react";
import { repo } from "../state/store";
import { isOverdue, projectById, tagById } from "../data/select";
import { TASK_PRIORITY_LABEL, TASK_STATUS_LABEL, type Snapshot, type Task } from "../data/types";
import { formatDueLabel } from "../lib/date";

interface Props {
  task: Task;
  snapshot: Snapshot;
  onOpen: () => void;
}

export default function TaskRow({ task, snapshot, onOpen }: Props) {
  const tags = tagById(snapshot);
  const projects = projectById(snapshot);
  const project = task.projectId ? projects.get(task.projectId) : undefined;
  const due = formatDueLabel(task.dueAt);
  const tone = task.status === "done" ? "normal" : due.tone;
  const overdue = isOverdue(task);

  return (
    <div
      className="list-row"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <span
        className="checkbox"
        role="checkbox"
        aria-checked={task.status === "done"}
        onClick={(event) => {
          event.stopPropagation();
          repo.setTaskStatus(task.id, task.status === "done" ? "upcoming" : "done");
        }}
      />

      <span className="flex min-w-0 items-center gap-2">
        <span
          className="truncate"
          style={
            task.status === "done"
              ? { color: "var(--muted)", textDecoration: "line-through" }
              : { borderLeft: overdue ? "2px solid var(--red)" : undefined, paddingLeft: overdue ? 6 : 2 }
          }
        >
          {task.title}
        </span>
        {task.note ? (
          <span className="text-[11px]" style={{ color: "var(--faint)" }} title="有备注">
            ✎
          </span>
        ) : null}
        {task.repeat ? <Repeat size={11} style={{ color: "var(--faint)" }} aria-label="重复任务" /> : null}
      </span>

      <span>
        <span className={`pill pill-${task.status}`}>{TASK_STATUS_LABEL[task.status]}</span>
      </span>

      <span className={`col-pri tone-${task.priority}`}>{TASK_PRIORITY_LABEL[task.priority]}</span>

      <span className="col-tags flex flex-wrap gap-1">
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
      </span>

      <span className="text-xs" style={{ color: "var(--muted)" }}>
        {due.text ? (
          <span className={tone === "over" ? "tone-over" : tone === "soon" ? "tone-soon" : undefined}>{due.text}</span>
        ) : (
          <span style={{ color: "var(--faint)" }}>无</span>
        )}
      </span>
    </div>
  );
}
