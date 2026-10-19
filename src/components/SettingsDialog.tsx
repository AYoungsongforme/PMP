import { useRef, useState } from "react";
import { Bell, Download, HardDrive, Upload, X } from "lucide-react";
import { repo, useSnapshot } from "../state/store";
import { settingValue } from "../data/select";
import { DEFAULT_REMINDER_TIME } from "../data/types";
import { notificationPermission, requestNotificationPermission } from "../lib/notify";

export default function SettingsDialog({ onClose }: { onClose: () => void }) {
  const snapshot = useSnapshot();
  const reminderTime = settingValue(snapshot, "reminderTime", DEFAULT_REMINDER_TIME);
  const [permission, setPermission] = useState(notificationPermission());
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const exportBackup = () => {
    const blob = new Blob([repo.exportLog()], { type: "application/x-ndjson" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pmp-backup-${new Date().toISOString().slice(0, 10)}.jsonl`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("已导出变更日志，换电脑时用它导入即可。");
  };

  const importBackup = async (file: File) => {
    const text = await file.text();
    const added = repo.importLog(text);
    setMessage(added > 0 ? `已合并 ${added} 条变更记录。` : "没有新记录，这个备份已经导入过了。");
  };

  const permissionText =
    permission === "granted"
      ? "已开启"
      : permission === "denied"
        ? "已被浏览器拒绝，需要在地址栏左侧重新允许"
        : permission === "unsupported"
          ? "当前环境不支持（需要 https 或 localhost）"
          : "未开启";

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center px-4"
      style={{ background: "rgba(15,15,15,0.35)" }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-[460px] flex-col overflow-y-auto rounded-xl p-4"
        style={{ background: "var(--bg)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center">
          <h2 className="text-sm font-medium">设置</h2>
          <button className="icon-btn ml-auto" aria-label="关闭" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-5">
          <section>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium">
              <Bell size={13} />
              提醒
            </div>
            <div className="grid items-center gap-2" style={{ gridTemplateColumns: "84px minmax(0,1fr)" }}>
              <span className="field-label">提醒时刻</span>
              <input
                type="time"
                className="input"
                value={reminderTime}
                onChange={(event) => repo.setSetting("reminderTime", event.target.value || DEFAULT_REMINDER_TIME)}
              />
            </div>
            <p className="mt-1.5 text-[11px]" style={{ color: "var(--faint)" }}>
              在截止日当天的这个时刻提醒；「提前 1 天」这类设置会在此基础上往前推。
            </p>
            <div className="mt-2 grid items-center gap-2" style={{ gridTemplateColumns: "84px minmax(0,1fr)" }}>
              <span className="field-label">桌面通知</span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  {permissionText}
                </span>
                {permission === "default" ? (
                  <button
                    className="btn"
                    style={{ height: 24, fontSize: 11.5 }}
                    onClick={async () => setPermission(await requestNotificationPermission())}
                  >
                    开启
                  </button>
                ) : null}
              </div>
            </div>
            <p className="mt-1.5 text-[11px]" style={{ color: "var(--faint)" }}>
              网页通知只在页面打开时有效。页面关掉期间错过的提醒，会在下次打开时补弹出来。
            </p>
          </section>

          <section>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium">
              <HardDrive size={13} />
              数据
            </div>
            <div className="flex flex-col gap-1 text-[11px]" style={{ color: "var(--muted)" }}>
              <span>存储方式：{repo.backend}</span>
              <span>设备标识：{repo.deviceId.slice(0, 8)}</span>
              <span>
                当前数据：{snapshot.projects.length} 个项目 / {snapshot.tasks.length} 条任务
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn" onClick={exportBackup}>
                <Download size={13} />
                导出备份
              </button>
              <button className="btn" onClick={() => fileRef.current?.click()}>
                <Upload size={13} />
                导入备份
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".jsonl,.txt,application/x-ndjson"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importBackup(file);
                  event.target.value = "";
                }}
              />
            </div>
            {message ? (
              <p className="mt-2 text-[11px]" style={{ color: "var(--accent)" }}>
                {message}
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
