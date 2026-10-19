import { startOfDay } from "./date";
import type { RepeatFreq } from "../data/types";

export const REPEAT_LABEL: Record<RepeatFreq, string> = {
  daily: "每天",
  weekdays: "每个工作日",
  weekly: "每周",
  monthly: "每月"
};

/** 从 base 往后推一个周期。weekdays 会跳过周末，monthly 会处理 31 号这类情况。 */
export function nextOccurrence(base: number, freq: RepeatFreq): number {
  const date = new Date(startOfDay(base));

  switch (freq) {
    case "daily":
      date.setDate(date.getDate() + 1);
      break;
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
    case "monthly": {
      const day = date.getDate();
      date.setDate(1);
      date.setMonth(date.getMonth() + 1);
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      date.setDate(Math.min(day, lastDay));
      break;
    }
    case "weekdays": {
      do {
        date.setDate(date.getDate() + 1);
      } while (date.getDay() === 0 || date.getDay() === 6);
      break;
    }
  }

  return date.getTime();
}

/**
 * 推到今天或之后。
 * 逾期很久的任务补完时，不应该一次补出十几条历史任务，直接对齐到未来那一次。
 */
export function nextFutureOccurrence(base: number, freq: RepeatFreq, now: number): number {
  const todayStart = startOfDay(now);
  let next = nextOccurrence(base, freq);
  let guard = 0;
  while (next < todayStart && guard < 600) {
    next = nextOccurrence(next, freq);
    guard += 1;
  }
  return next;
}
