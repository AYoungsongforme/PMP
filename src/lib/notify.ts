/** 桌面通知的薄封装。不可用时静默失败，界面里还有应用内提醒兜底。 */

export function notificationsSupported(): boolean {
  return typeof Notification !== "undefined";
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function sendDesktopNotification(title: string, body: string): void {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, tag: "pmp-reminder" });
  } catch {
    // 某些环境（例如非安全上下文）构造通知会抛错，忽略即可
  }
}
