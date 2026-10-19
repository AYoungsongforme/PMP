import { useMemo, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Sun } from "lucide-react";
import { repo } from "../state/store";
import { todayBuckets } from "../data/select";
import type { Snapshot, Task } from "../data/types";
import TaskRow from "./TaskRow";

interface Props {
  snapshot: Snapshot;
  onOpenTask: (id: string) => void;
}

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export default function TodayView({ snapshot, onOpenTask }: Props) {
  const buckets = useMemo(() => todayBuckets(snapshot), [snapshot]);
  const now = new Date();
  const openCount = buckets.overdue.length + buckets.today.length + buckets.doing.length;
  const total = openCount + buckets.doneToday.length;
  const progress = total === 0 ? 0 : Math.round((buckets.doneToday.length / total) * 100);

  return (
    <div className="mx-auto max-w-4xl px-5 py-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-[17px] font-medium">
            {now.getMonth() + 1}月{now.getDate()}日 · {WEEKDAYS[now.getDay()]}
          </h1>
          <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
            待处理 {openCount} 条
            {buckets.overdue.length > 0 ? `，其中逾期 ${buckets.overdue.length} 条` : ""}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px]" style={{ color: "var(--faint)" }}>
            今日完成
          </span>
          <span className="h-1.5 w-24 overflow-hidden rounded-full" style={{ background: "var(--gray-soft)" }}>
            <span className="block h-full rounded-full" style={{ width: `${progress}%`, background: "var(--accent)" }} />
          </span>
          <span className="text-[11px] tabular-nums" style={{ color: "var(--muted)" }}>
            {buckets.doneToday.length}/{total}
          </span>
        </div>
      </div>

      {buckets.overdue.length > 0 ? (
        <Section
          icon={<AlertTriangle size={14} />}
          color="var(--red)"
          title="逾期"
          count={buckets.overdue.length}
          tasks={buckets.overdue}
          snapshot={snapshot}
          onOpenTask={onOpenTask}
        />
      ) : null}

      <Section
        icon={<Sun size={14} />}
        color="var(--amber)"
        title="今天到期"
        count={buckets.today.length}
        tasks={buckets.today}
        snapshot={snapshot}
        onOpenTask={onOpenTask}
      />

      <Section
        icon={<Sun size={14} />}
        color="var(--accent)"
        title="进行中 · 未排期"
        count={buckets.doing.length}
        tasks={buckets.doing}
        snapshot={snapshot}
        onOpenTask={onOpenTask}
      />

      {buckets.doneToday.length > 0 ? (
        <Section
          icon={<CheckCircle2 size={14} />}
          color="var(--green)"
          title="今天完成"
          count={buckets.doneToday.length}
          tasks={buckets.doneToday}
          snapshot={snapshot}
          onOpenTask={onOpenTask}
        />
      ) : null}

      {openCount === 0 && buckets.doneToday.length === 0 ? (
        <p className="py-12 text-center text-xs" style={{ color: "var(--muted)" }}>
          今天没有待办。从左侧「全部任务」里挑几条排到今天吧。
        </p>
      ) : null}

      {buckets.doing.length > 0 ? (
        <div className="mt-4 flex justify-end">
          <button
            className="btn"
            onClick={() => {
              const stamp = Date.now();
              for (const task of buckets.doing) repo.updateTask(task.id, { startAt: stamp, dueAt: stamp });
            }}
          >
            把「进行中」全部排到今天
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Section({
  icon,
  color,
  title,
  count,
  tasks,
  snapshot,
  onOpenTask
}: {
  icon: ReactNode;
  color: string;
  title: string;
  count: number;
  tasks: Task[];
  snapshot: Snapshot;
  onOpenTask: (id: string) => void;
}) {
  return (
    <section className="mt-5">
      <div className="flex items-center gap-1.5 px-2.5 pb-1 text-xs font-medium" style={{ color }}>
        {icon}
        {title}
        <span style={{ color: "var(--faint)" }}>· {count}</span>
      </div>
      {tasks.length === 0 ? (
        <p className="px-2.5 py-2 text-[11px]" style={{ color: "var(--faint)" }}>
          空
        </p>
      ) : (
        tasks.map((task) => <TaskRow key={task.id} task={task} snapshot={snapshot} onOpen={() => onOpenTask(task.id)} />)
      )}
    </section>
  );
}
