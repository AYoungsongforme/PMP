import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link2 } from "lucide-react";
import { repo } from "../state/store";
import { liveDependencies, timelineRange } from "../data/select";
import { TASK_STATUS_LABEL, type Snapshot, type Task, type TaskStatus } from "../data/types";
import { DAY, addDays, dayDiff, startOfDay, today } from "../lib/date";

interface Props {
  snapshot: Snapshot;
  tasks: Task[];
  highlightTaskId: string | null;
  onOpenTask: (id: string) => void;
}

const ROW_H = 34;
const LABEL_W = 190;
const ZOOM = { month: 18, fortnight: 30, week: 46 } as const;
type ZoomKey = keyof typeof ZOOM;

const ZOOM_LABEL: Record<ZoomKey, string> = { month: "月", fortnight: "两周", week: "周" };

const BAR_STYLE: Record<TaskStatus, { bg: string; fg: string }> = {
  todo: { bg: "var(--gray-soft)", fg: "var(--muted)" },
  doing: { bg: "var(--accent-soft)", fg: "var(--accent)" },
  review: { bg: "var(--amber-soft)", fg: "var(--amber)" },
  done: { bg: "var(--green-soft)", fg: "var(--green)" }
};

interface DragState {
  taskId: string;
  mode: "move" | "start" | "end";
  startX: number;
  deltaDays: number;
  originStart: number | null;
  originEnd: number | null;
  originLeft: number;
  originWidth: number;
}

export default function TimelineView({ snapshot, tasks, highlightTaskId, onOpenTask }: Props) {
  const [zoom, setZoom] = useState<ZoomKey>("fortnight");
  const [showDeps, setShowDeps] = useState(true);
  const [drag, setDrag] = useState<DragState | null>(null);
  /** 真的拖动过就不再当成点击，避免松手后弹出详情 */
  const movedRef = useRef(false);

  const dayWidth = ZOOM[zoom];
  const range = useMemo(() => timelineRange(tasks), [tasks]);
  const days = useMemo(
    () => Array.from({ length: range.days }, (_, index) => addDays(range.start, index)),
    [range.start, range.days]
  );
  const gridWidth = range.days * dayWidth;

  const { scheduled, unscheduled, rowIndex, taskMap } = useMemo(() => {
    const withDates = tasks.filter((task) => task.startAt !== null || task.dueAt !== null);
    const without = tasks.filter((task) => task.startAt === null && task.dueAt === null);
    return {
      scheduled: withDates,
      unscheduled: without,
      rowIndex: new Map(withDates.map((task, index) => [task.id, index])),
      taskMap: new Map(withDates.map((task) => [task.id, task]))
    };
  }, [tasks]);

  const trackHeight = Math.max(scheduled.length, 1) * ROW_H;

  const geometry = (task: Task) => {
    const anchorStart = task.startAt ?? task.dueAt ?? range.start;
    const anchorEnd = task.dueAt ?? task.startAt ?? range.start;
    const startIndex = Math.max(0, Math.min(range.days - 1, dayDiff(anchorStart, range.start)));
    const endIndex = Math.max(0, Math.min(range.days - 1, dayDiff(anchorEnd, range.start)));
    const left = startIndex * dayWidth;
    const width = Math.max(dayWidth, (Math.max(endIndex, startIndex) - startIndex + 1) * dayWidth);
    return { left, width };
  };

  const previewGeometry = (task: Task) => {
    const base = geometry(task);
    if (!drag || drag.taskId !== task.id) return base;
    const shift = drag.deltaDays * dayWidth;
    if (drag.mode === "move") return { left: drag.originLeft + shift, width: drag.originWidth };
    if (drag.mode === "start") {
      const left = Math.min(drag.originLeft + shift, drag.originLeft + drag.originWidth - dayWidth);
      return { left, width: Math.max(dayWidth, drag.originWidth - (left - drag.originLeft)) };
    }
    return { left: drag.originLeft, width: Math.max(dayWidth, drag.originWidth + shift) };
  };

  const beginDrag = (event: ReactPointerEvent<HTMLElement>, task: Task, mode: DragState["mode"]) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    movedRef.current = false;
    const geom = geometry(task);
    setDrag({
      taskId: task.id,
      mode,
      startX: event.clientX,
      deltaDays: 0,
      originStart: task.startAt,
      originEnd: task.dueAt,
      originLeft: geom.left,
      originWidth: geom.width
    });
  };

  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag) return;
    const deltaDays = Math.round((event.clientX - drag.startX) / dayWidth);
    if (deltaDays !== 0) movedRef.current = true;
    if (deltaDays !== drag.deltaDays) setDrag({ ...drag, deltaDays });
  };

  const finishDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag) return;
    // 用指针的最终位置直接算位移，避免读到还没提交的状态
    const deltaDays = Math.round((event.clientX - drag.startX) / dayWidth);
    const { taskId, mode, originStart, originEnd } = drag;
    setDrag(null);
    if (deltaDays === 0) return;
    const shift = deltaDays * DAY;

    if (mode === "move") {
      repo.updateTask(taskId, {
        startAt: originStart === null ? null : originStart + shift,
        dueAt: originEnd === null ? null : originEnd + shift
      });
      return;
    }
    if (mode === "start" && originStart !== null) {
      const limit = originEnd ?? originStart;
      repo.updateTask(taskId, { startAt: Math.min(originStart + shift, limit) });
      return;
    }
    if (mode === "end" && originEnd !== null) {
      const limit = originStart ?? originEnd;
      repo.updateTask(taskId, { dueAt: Math.max(originEnd + shift, limit) });
    }
  };

  const edges = useMemo(() => {
    if (!showDeps) return [];
    return liveDependencies(snapshot)
      .map((dep) => {
        const fromIndex = rowIndex.get(dep.dependsOnId);
        const toIndex = rowIndex.get(dep.taskId);
        const predecessor = taskMap.get(dep.dependsOnId);
        const successor = taskMap.get(dep.taskId);
        if (fromIndex === undefined || toIndex === undefined || !predecessor || !successor) return null;

        const from = geometry(predecessor);
        const to = geometry(successor);
        const x1 = from.left + from.width;
        const y1 = fromIndex * ROW_H + ROW_H / 2;
        const x2 = to.left;
        const y2 = toIndex * ROW_H + ROW_H / 2;

        const violated =
          predecessor.status !== "done" &&
          successor.startAt !== null &&
          predecessor.dueAt !== null &&
          startOfDay(successor.startAt) < startOfDay(predecessor.dueAt);
        const resolved = predecessor.status === "done";
        const highlighted =
          highlightTaskId !== null && (highlightTaskId === dep.taskId || highlightTaskId === dep.dependsOnId);

        const path =
          x2 > x1 + 14
            ? `M ${x1} ${y1} H ${x1 + 8} V ${y2} H ${x2 - 5}`
            : `M ${x1} ${y1} H ${x1 + 10} V ${(y1 + y2) / 2} H ${x2 - 12} V ${y2} H ${x2 - 5}`;

        return { id: dep.id, path, violated, resolved, highlighted, x2, y2 };
      })
      .filter((edge): edge is NonNullable<typeof edge> => edge !== null);
  }, [snapshot, showDeps, rowIndex, taskMap, highlightTaskId, dayWidth, range.start, range.days]);

  const months = useMemo(() => {
    const out: { label: string; days: number }[] = [];
    for (const ts of days) {
      const date = new Date(ts);
      const label = `${date.getFullYear()}年${date.getMonth() + 1}月`;
      const last = out[out.length - 1];
      if (last && last.label === label) last.days += 1;
      else out.push({ label, days: 1 });
    }
    return out;
  }, [days]);

  const todayTs = today();

  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="seg">
          {(Object.keys(ZOOM) as ZoomKey[]).map((key) => (
            <button key={key} className="seg-item" aria-pressed={zoom === key} onClick={() => setZoom(key)}>
              {ZOOM_LABEL[key]}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>
          <input type="checkbox" checked={showDeps} onChange={(event) => setShowDeps(event.target.checked)} />
          依赖连线
        </label>
        <span className="text-[11px]" style={{ color: "var(--faint)" }}>
          拖动色条改期 · 拖两端改工期 · 手动模式：依赖只提示，不自动顺延
        </span>
      </div>

      <div className="overflow-auto rounded-lg" style={{ border: "1px solid var(--border)", maxHeight: "calc(100vh - 190px)" }}>
        <div style={{ width: LABEL_W + gridWidth, minWidth: "100%" }}>
          <div className="sticky top-0 z-20 flex" style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
            <div
              className="sticky left-0 z-10 shrink-0 px-2 py-1.5 text-[11px]"
              style={{ width: LABEL_W, background: "var(--bg)", borderRight: "1px solid var(--border)", color: "var(--faint)" }}
            >
              任务
            </div>
            <div className="flex flex-col">
              <div className="flex" style={{ height: 22 }}>
                {months.map((month) => (
                  <div
                    key={month.label + month.days}
                    className="truncate px-1.5 text-[11px]"
                    style={{ width: month.days * dayWidth, borderRight: "1px solid var(--border)", color: "var(--muted)", lineHeight: "22px" }}
                  >
                    {month.label}
                  </div>
                ))}
              </div>
              <div className="flex" style={{ height: 22 }}>
                {days.map((ts) => {
                  const date = new Date(ts);
                  const weekend = date.getDay() === 0 || date.getDay() === 6;
                  const isToday = ts === todayTs;
                  const showNumber = dayWidth >= 26 || date.getDay() === 1;
                  return (
                    <div
                      key={ts}
                      className="text-center text-[10px]"
                      style={{
                        width: dayWidth,
                        lineHeight: "22px",
                        color: isToday ? "var(--red)" : weekend ? "var(--faint)" : "var(--muted)",
                        fontWeight: isToday ? 500 : 400,
                        borderRight: date.getDay() === 0 ? "1px solid var(--border)" : "none"
                      }}
                    >
                      {showNumber ? date.getDate() : ""}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex">
            <div className="sticky left-0 z-10 shrink-0" style={{ width: LABEL_W, background: "var(--bg)", borderRight: "1px solid var(--border)" }}>
              {scheduled.map((task) => (
                <button
                  key={task.id}
                  className="flex w-full items-center gap-2 px-2 text-left text-xs"
                  style={{
                    height: ROW_H,
                    borderBottom: "1px solid var(--border-soft)",
                    background: highlightTaskId === task.id ? "var(--hover)" : undefined,
                    color: task.status === "done" ? "var(--muted)" : "var(--fg)"
                  }}
                  onClick={() => onOpenTask(task.id)}
                >
                  <span className="dot" style={{ background: BAR_STYLE[task.status].fg, width: 7, height: 7 }} />
                  <span className="truncate">{task.title}</span>
                </button>
              ))}
              {scheduled.length === 0 ? (
                <div className="px-2 py-3 text-[11px]" style={{ color: "var(--faint)", height: ROW_H }}>
                  没有已排期任务
                </div>
              ) : null}
            </div>

            <div
              className="relative"
              style={{
                width: gridWidth,
                height: trackHeight,
                backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${dayWidth - 1}px, var(--border-soft) ${dayWidth - 1}px, var(--border-soft) ${dayWidth}px), repeating-linear-gradient(to right, transparent 0, transparent ${dayWidth * 7 - 1}px, var(--border) ${dayWidth * 7 - 1}px, var(--border) ${dayWidth * 7}px), repeating-linear-gradient(to bottom, transparent 0, transparent ${ROW_H - 1}px, var(--border-soft) ${ROW_H - 1}px, var(--border-soft) ${ROW_H}px)`
              }}
            >
              {days.map((ts, index) => {
                const date = new Date(ts);
                const weekend = date.getDay() === 0 || date.getDay() === 6;
                if (!weekend) return null;
                return (
                  <div
                    key={ts}
                    className="absolute top-0"
                    style={{ left: index * dayWidth, width: dayWidth, height: trackHeight, background: "var(--gray-soft)", opacity: 0.45 }}
                  />
                );
              })}

              {days.some((ts) => ts === todayTs) ? (
                <div
                  className="absolute top-0"
                  style={{
                    left: dayDiff(todayTs, range.start) * dayWidth + dayWidth / 2,
                    width: 2,
                    height: trackHeight,
                    background: "var(--red)",
                    opacity: 0.7
                  }}
                />
              ) : null}

              <svg className="pointer-events-none absolute left-0 top-0" width={gridWidth} height={trackHeight}>
                <defs>
                  <marker id="pmp-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                    <path d="M0 0 L8 4 L0 8 z" fill="var(--muted)" />
                  </marker>
                  <marker id="pmp-arrow-bad" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                    <path d="M0 0 L8 4 L0 8 z" fill="var(--red)" />
                  </marker>
                  <marker id="pmp-arrow-hi" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                    <path d="M0 0 L8 4 L0 8 z" fill="var(--accent)" />
                  </marker>
                </defs>
                {edges.map((edge) => {
                  const stroke = edge.highlighted ? "var(--accent)" : edge.violated ? "var(--red)" : edge.resolved ? "var(--faint)" : "var(--muted)";
                  const marker = edge.highlighted ? "pmp-arrow-hi" : edge.violated ? "pmp-arrow-bad" : "pmp-arrow";
                  return (
                    <path
                      key={edge.id}
                      d={edge.path}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={edge.highlighted ? 2 : 1.4}
                      strokeDasharray={edge.violated ? "4 3" : undefined}
                      markerEnd={`url(#${marker})`}
                    />
                  );
                })}
              </svg>

              {scheduled.map((task, index) => {
                const geom = previewGeometry(task);
                const style = BAR_STYLE[task.status];
                const dragging = drag?.taskId === task.id;
                return (
                  <div
                    key={task.id}
                    className="absolute flex items-center rounded"
                    style={{
                      left: geom.left,
                      width: geom.width,
                      top: index * ROW_H + 5,
                      height: ROW_H - 10,
                      background: style.bg,
                      color: style.fg,
                      outline: dragging ? "2px solid var(--accent)" : "none",
                      zIndex: dragging ? 5 : 1,
                      touchAction: "none",
                      cursor: "grab"
                    }}
                    onPointerDown={(event) => beginDrag(event, task, "move")}
                    onPointerMove={moveDrag}
                    onPointerUp={finishDrag}
                    onPointerCancel={finishDrag}
                    onClick={() => {
                      if (movedRef.current) {
                        movedRef.current = false;
                        return;
                      }
                      onOpenTask(task.id);
                    }}
                  >
                    <span
                      className="h-full shrink-0"
                      style={{ width: 6, cursor: "ew-resize" }}
                      onPointerDown={(event) => beginDrag(event, task, "start")}
                      onPointerMove={moveDrag}
                      onPointerUp={finishDrag}
                      onPointerCancel={finishDrag}
                    />
                    <span className="truncate px-1 text-[11px]">{geom.width > 46 ? task.title : ""}</span>
                    <span
                      className="ml-auto h-full shrink-0"
                      style={{ width: 6, cursor: "ew-resize" }}
                      onPointerDown={(event) => beginDrag(event, task, "end")}
                      onPointerMove={moveDrag}
                      onPointerUp={finishDrag}
                      onPointerCancel={finishDrag}
                    />
                  </div>
                );
              })}

              {drag && drag.deltaDays !== 0 ? (
                <div
                  className="absolute rounded px-1.5 py-0.5 text-[11px]"
                  style={{
                    left: Math.max(0, (drag.originLeft ?? 0) + drag.deltaDays * dayWidth),
                    top: Math.max(0, (rowIndex.get(drag.taskId) ?? 0) * ROW_H - 18),
                    background: "var(--fg)",
                    color: "var(--bg)",
                    pointerEvents: "none",
                    zIndex: 6
                  }}
                >
                  {drag.deltaDays > 0 ? `+${drag.deltaDays}` : drag.deltaDays} 天
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {unscheduled.length > 0 ? (
        <div className="rounded-lg p-3" style={{ border: "1px dashed var(--border)" }}>
          <div className="mb-2 flex items-center gap-1.5 text-[11px]" style={{ color: "var(--faint)" }}>
            <Link2 size={12} />
            未排期 · {unscheduled.length}
          </div>
          <div className="flex flex-wrap gap-2">
            {unscheduled.map((task) => (
              <span key={task.id} className="chip gap-1.5 py-1">
                <button onClick={() => onOpenTask(task.id)}>{task.title}</button>
                <button
                  style={{ color: "var(--accent)" }}
                  onClick={() => repo.updateTask(task.id, { startAt: todayTs, dueAt: todayTs })}
                >
                  排到今天
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-4 text-[11px]" style={{ color: "var(--muted)" }}>
        {(Object.keys(BAR_STYLE) as TaskStatus[]).map((status) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            <i style={{ background: BAR_STYLE[status].bg, width: 12, height: 10, borderRadius: 3, display: "inline-block" }} />
            {TASK_STATUS_LABEL[status]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <i style={{ background: "var(--red)", width: 2, height: 12, display: "inline-block" }} />
          今天
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="26" height="10">
            <path d="M0 5 H20" stroke="var(--red)" strokeWidth="1.4" strokeDasharray="4 3" />
          </svg>
          依赖冲突（前置任务还没完就开始了）
        </span>
      </div>
    </div>
  );
}
