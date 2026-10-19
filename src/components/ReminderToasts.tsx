import { AlarmClock, Bell, X } from "lucide-react";
import type { ReminderAlert } from "../state/useReminders";
import { formatDateTime, formatShort } from "../lib/date";

interface Props {
  alerts: ReminderAlert[];
  onOpen: (taskId: string) => void;
  onSnooze: (alert: ReminderAlert) => void;
  onDismiss: (id: string) => void;
}

export default function ReminderToasts({ alerts, onOpen, onSnooze, onDismiss }: Props) {
  if (alerts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex w-[320px] max-w-[calc(100%-2rem)] flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {alerts.slice(-4).map((alert) => (
        <div
          key={alert.id}
          className="flex gap-2.5 rounded-xl p-3"
          style={{ background: "var(--bg)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}
        >
          <span
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            <Bell size={15} />
          </span>

          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex items-start gap-1.5">
              <b className="min-w-0 flex-1 text-[13px] font-medium">{alert.task.title}</b>
              <button className="icon-btn h-5 w-5" aria-label="关闭提醒" onClick={() => onDismiss(alert.id)}>
                <X size={13} />
              </button>
            </div>
            <span className="text-[11px]" style={{ color: "var(--muted)" }}>
              截止 {formatShort(alert.task.dueAt)} · 提醒时间 {formatDateTime(alert.at)}
            </span>
            <div className="mt-1.5 flex gap-1.5">
              <button
                className="btn"
                style={{ height: 24, fontSize: 11.5 }}
                onClick={() => {
                  onOpen(alert.task.id);
                  onDismiss(alert.id);
                }}
              >
                打开任务
              </button>
              <button className="btn" style={{ height: 24, fontSize: 11.5 }} onClick={() => onSnooze(alert)}>
                <AlarmClock size={12} />
                稍后 10 分钟
              </button>
            </div>
          </div>
        </div>
      ))}
      {alerts.length > 4 ? (
        <p className="text-center text-[11px]" style={{ color: "var(--muted)" }}>
          还有 {alerts.length - 4} 条提醒
        </p>
      ) : null}
    </div>
  );
}
