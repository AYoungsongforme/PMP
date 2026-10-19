export const DAY = 86_400_000;

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function today(): number {
  return startOfDay(Date.now());
}

export function addDays(ts: number, days: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/** b 相对 a 差几天，用自然日计算。 */
export function dayDiff(a: number, b: number): number {
  return Math.round((startOfDay(a) - startOfDay(b)) / DAY);
}

export function formatShort(ts: number | null): string {
  if (!ts) return "";
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(ts);
}

export function formatFull(ts: number | null): string {
  if (!ts) return "";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" }).format(ts);
}

export function formatDueLabel(ts: number | null): { text: string; tone: "over" | "soon" | "normal" } {
  if (!ts) return { text: "", tone: "normal" };
  const diff = dayDiff(ts, Date.now());
  if (diff < 0) return { text: `已逾期 ${Math.abs(diff)} 天`, tone: "over" };
  if (diff === 0) return { text: "今天", tone: "soon" };
  if (diff === 1) return { text: "明天", tone: "soon" };
  return { text: formatShort(ts), tone: "normal" };
}

/** <input type="date"> 用本地日期字符串，不能直接 toISOString（会因时区偏移一天）。 */
export function toDateInput(ts: number | null): string {
  if (!ts) return "";
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fromDateInput(value: string): number | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).getTime();
}

/** "09:30" → 当天零点起的毫秒数 */
export function parseTimeOfDay(value: string): number {
  const [h, m] = value.split(":").map(Number);
  const hours = Number.isFinite(h) ? h : 9;
  const minutes = Number.isFinite(m) ? m : 30;
  return (hours * 60 + minutes) * 60_000;
}

export function formatDateTime(ts: number | null): string {
  if (!ts) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(ts);
}
