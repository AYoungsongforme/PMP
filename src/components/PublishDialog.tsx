import { useState } from "react";
import { CheckCircle2, CloudUpload, Download, KeyRound, ShieldAlert, X } from "lucide-react";
import { repo } from "../state/store";
import { createKv } from "../data/kv";
import { buildPayload } from "../data/publish";
import { settingValue } from "../data/select";
import { encryptJson } from "../lib/crypto";
import { formatDateTime } from "../lib/date";
import type { Snapshot } from "../data/types";

interface WritableFileHandle {
  name: string;
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
  queryPermission?(descriptor: { mode: "read" | "readwrite" }): Promise<PermissionState>;
  requestPermission?(descriptor: { mode: "read" | "readwrite" }): Promise<PermissionState>;
}

type SavePicker = (options: {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}) => Promise<WritableFileHandle>;

const kv = createKv();
const HANDLE_KEY = "publishHandle";
const PASS_KEY = "pmp:publishPassphrase";
const MIN_LENGTH = 8;

export default function PublishDialog({ snapshot, onClose }: { snapshot: Snapshot; onClose: () => void }) {
  const savedPass = typeof localStorage !== "undefined" ? localStorage.getItem(PASS_KEY) : null;
  const [password, setPassword] = useState(savedPass ?? "");
  const [confirm, setConfirm] = useState("");
  const [remember, setRemember] = useState(Boolean(savedPass));
  const [step, setStep] = useState<"form" | "working" | "done">("form");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState("");

  const lastPublished = Number(settingValue(snapshot, "lastPublishedAt", "0"));
  const liveProjects = snapshot.projects.filter((item) => item.deletedAt === null).length;
  const liveTasks = snapshot.tasks.filter((item) => item.deletedAt === null).length;
  const liveTags = snapshot.tags.filter((item) => item.deletedAt === null).length;
  const liveDocs = snapshot.docs.filter((item) => item.deletedAt === null && item.kind === "doc").length;

  const publish = async (mode: "file" | "download") => {
    if (password.length < MIN_LENGTH) {
      setMessage(`密码至少 ${MIN_LENGTH} 位，建议用一句短语`);
      return;
    }
    if (mode === "file" && password !== confirm) {
      setMessage("两次输入的密码不一致");
      return;
    }

    setMessage("");
    setStep("working");

    try {
      const payload = buildPayload(snapshot);
      const encrypted = await encryptJson(payload, password);
      const text = JSON.stringify(encrypted, null, 2);

      if (remember) localStorage.setItem(PASS_KEY, password);
      else localStorage.removeItem(PASS_KEY);

      if (mode === "download") {
        const blob = new Blob([text], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "published.json";
        link.click();
        URL.revokeObjectURL(url);
        setTarget("下载文件夹里的 published.json");
      } else {
        setTarget(await writeToRepoFile(text));
      }

      repo.setSetting("lastPublishedAt", String(payload.publishedAt));
      setStep("done");
    } catch (error) {
      setStep("form");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center px-4"
      style={{ background: "rgba(15,15,15,0.35)" }}
      onClick={step === "working" ? undefined : onClose}
    >
      <div
        className="w-full max-w-[520px] overflow-hidden rounded-xl"
        style={{ background: "var(--bg)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-2 px-4 py-3.5">
          <div>
            <h2 className="text-sm font-medium">发布到 GitHub Pages</h2>
            <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--faint)" }}>
              数据会先在本机加密，再写进仓库
            </p>
          </div>
          <button
            className="icon-btn ml-auto"
            aria-label="关闭"
            onClick={onClose}
            disabled={step === "working"}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-1.5 px-4 pb-3 text-[11px]" style={{ color: "var(--faint)" }}>
          <Step index={1} label="加密" state={step === "form" ? "now" : "done"} />
          <span className="h-px flex-1" style={{ background: "var(--border)" }} />
          <Step index={2} label="写入文件" state={step === "done" ? "done" : step === "working" ? "now" : "idle"} />
          <span className="h-px flex-1" style={{ background: "var(--border)" }} />
          <Step index={3} label="推送到 GitHub" state={step === "done" ? "now" : "idle"} />
        </div>

        {step === "done" ? (
          <div className="flex flex-col gap-3 px-4 pb-4">
            <div
              className="flex items-start gap-2 rounded-lg p-3"
              style={{ background: "var(--green-soft)", color: "var(--green)" }}
            >
              <CheckCircle2 size={16} className="mt-0.5" />
              <div className="text-xs">
                <div className="font-medium">已生成加密文件</div>
                <div className="mt-0.5" style={{ color: "var(--muted)" }}>
                  {target}
                </div>
              </div>
            </div>

            <ol className="flex flex-col gap-2 text-xs" style={{ color: "var(--muted)" }}>
              <li>
                <b style={{ color: "var(--fg)" }}>1.</b> 回到项目文件夹，双击 <code>发布.cmd</code>
              </li>
              <li>
                <b style={{ color: "var(--fg)" }}>2.</b> 等 GitHub Actions 跑完（约 1 分钟）
              </li>
              <li>
                <b style={{ color: "var(--fg)" }}>3.</b> 手机上打开站点，输入刚才那个密码
              </li>
            </ol>

            <div className="flex justify-end">
              <button className="btn btn-primary" onClick={onClose}>
                完成
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 px-4 pb-4">
              <div className="grid gap-2 text-xs" style={{ gridTemplateColumns: "74px minmax(0,1fr)" }}>
                <span className="field-label">发布内容</span>
                <span>
                  {liveProjects} 个项目 · {liveTasks} 条任务 · {liveDocs} 篇文档 · {liveTags} 个标签
                </span>
                <span className="field-label">上次发布</span>
                <span style={{ color: lastPublished ? "var(--fg)" : "var(--faint)" }}>
                  {lastPublished ? formatDateTime(lastPublished) : "还没有发布过"}
                </span>
              </div>

              <div className="grid items-center gap-2" style={{ gridTemplateColumns: "74px minmax(0,1fr)" }}>
                <span className="field-label">加密密码</span>
                <input
                  className="input"
                  type="password"
                  autoFocus
                  placeholder={`至少 ${MIN_LENGTH} 位，建议一句短语`}
                  value={password}
                  disabled={step === "working"}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <span />
                <input
                  className="input"
                  type="password"
                  placeholder="再输一次"
                  value={confirm}
                  disabled={step === "working"}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </div>

              <label className="flex items-center gap-2 text-[11.5px]" style={{ color: "var(--muted)" }}>
                <input
                  type="checkbox"
                  checked={remember}
                  disabled={step === "working"}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                在这台电脑上记住密码（方便下次发布）
              </label>

              <div
                className="flex items-start gap-2 rounded-lg p-2.5 text-[11.5px]"
                style={{ background: "var(--amber-soft)", color: "#8a5a17" }}
              >
                <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                <span>
                  密码只在本机使用，仓库里只有密文。**忘记密码无法找回**，手机端也解不开已发布的内容。
                </span>
              </div>

              {message ? (
                <p className="text-[11.5px]" style={{ color: "var(--red)" }}>
                  {message}
                </p>
              ) : null}
            </div>

            <div
              className="flex flex-wrap items-center gap-2 px-4 py-3"
              style={{ borderTop: "1px solid var(--border)", background: "var(--side)" }}
            >
              <button className="btn" onClick={onClose} disabled={step === "working"}>
                取消
              </button>
              <button className="btn ml-auto" onClick={() => void publish("download")} disabled={step === "working"}>
                <Download size={14} />
                下载 JSON
              </button>
              <button className="btn btn-primary" onClick={() => void publish("file")} disabled={step === "working"}>
                {step === "working" ? <KeyRound size={14} /> : <CloudUpload size={14} />}
                {step === "working" ? "正在加密…" : "加密并写入文件"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Step({ index, label, state }: { index: number; label: string; state: "idle" | "now" | "done" }) {
  const color =
    state === "done" ? "var(--green)" : state === "now" ? "var(--accent)" : "var(--faint)";
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap" style={{ color }}>
      <b
        className="grid h-4 w-4 place-items-center rounded-full text-[9px] font-medium"
        style={{
          background: state === "idle" ? "var(--gray-soft)" : state === "done" ? "var(--green-soft)" : "var(--accent)",
          color: state === "now" ? "#fff" : color
        }}
      >
        {index}
      </b>
      {label}
    </span>
  );
}

async function writeToRepoFile(text: string): Promise<string> {
  const picker = (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
  const stored = await kv.get<WritableFileHandle>(HANDLE_KEY);

  if (stored) {
    try {
      const permission = stored.queryPermission ? await stored.queryPermission({ mode: "readwrite" }) : "granted";
      if (permission !== "granted" && stored.requestPermission) {
        await stored.requestPermission({ mode: "readwrite" });
      }
      const writable = await stored.createWritable();
      await writable.write(text);
      await writable.close();
      return stored.name;
    } catch {
      // 文件被移动或权限被拒，退回重新选择
    }
  }

  if (!picker) {
    throw new Error("这个浏览器不支持直接写文件，请改用「下载 JSON」");
  }

  const handle = await picker({
    suggestedName: "published.json",
    types: [{ description: "JSON", accept: { "application/json": [".json"] } }]
  });
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
  await kv.set(HANDLE_KEY, handle);
  return handle.name;
}
