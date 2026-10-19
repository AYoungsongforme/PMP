import { useCallback, useEffect, useRef, useState } from "react";
import { repo, useSnapshot } from "./store";
import { dueReminders, settingValue } from "../data/select";
import { DEFAULT_REMINDER_TIME, type Task } from "../data/types";
import { parseTimeOfDay } from "../lib/date";
import { sendDesktopNotification } from "../lib/notify";

export interface ReminderAlert {
  id: string;
  reminderId: string;
  task: Task;
  at: number;
}

const TICK_MS = 20_000;

/**
 * 提醒调度器。
 * 浏览器里做不到「关掉页面还能弹」，所以每 20 秒对一次表；
 * 重新打开页面时，期间到点的提醒会在第一次 tick 补弹出来。
 */
export function useReminders() {
  const snap = useSnapshot();
  const snapRef = useRef(snap);
  snapRef.current = snap;

  const [alerts, setAlerts] = useState<ReminderAlert[]>([]);
  const seen = useRef(new Set<string>());

  const tick = useCallback(() => {
    const current = snapRef.current;
    const timeOfDay = parseTimeOfDay(settingValue(current, "reminderTime", DEFAULT_REMINDER_TIME));
    const due = dueReminders(current, Date.now(), timeOfDay);
    if (due.length === 0) return;

    const fresh: ReminderAlert[] = [];
    for (const item of due) {
      const id = `${item.reminder.id}:${item.at}`;
      if (seen.current.has(id)) continue;
      seen.current.add(id);
      repo.markReminderFired(item.reminder.id);
      fresh.push({ id, reminderId: item.reminder.id, task: item.task, at: item.at });
    }
    if (fresh.length === 0) return;

    setAlerts((prev) => [...prev, ...fresh]);
    for (const alert of fresh.slice(0, 3)) {
      const due = alert.task.dueAt === null ? "" : new Date(alert.task.dueAt).toLocaleDateString("zh-CN");
      sendDesktopNotification("任务提醒", due ? `${alert.task.title} · 截止 ${due}` : alert.task.title);
    }
  }, []);

  // 数据一变就立刻对一次表，这样刚设的提醒不用等下一个 20 秒
  useEffect(() => {
    tick();
  }, [snap, tick]);

  useEffect(() => {
    const timer = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(timer);
  }, [tick]);

  return {
    alerts,
    dismiss: (id: string) => setAlerts((prev) => prev.filter((alert) => alert.id !== id)),
    snooze: (alert: ReminderAlert, minutes = 10) => {
      repo.snoozeReminder(alert.reminderId, Date.now() + minutes * 60_000);
      setAlerts((prev) => prev.filter((item) => item.id !== alert.id));
    }
  };
}
