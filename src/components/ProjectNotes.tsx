import { useRef, useState } from "react";
import { ImagePlus, Pencil, X } from "lucide-react";
import { repo } from "../state/store";
import type { Project } from "../data/types";
import { renderMarkdown } from "../lib/markdown";

/** 把图片压到合适大小再存成 data URL，避免把几 MB 的原图塞进变更日志。 */
async function fileToDataUrl(file: File, maxSize = 1400): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法处理图片");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export default function ProjectNotes({ project }: { project: Project }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.description);
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const startEditing = () => {
    setDraft(project.description);
    setEditing(true);
  };

  const save = () => {
    repo.updateProject(project.id, { description: draft });
    setEditing(false);
  };

  const insertImage = async (file: File) => {
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const snippet = `\n![${file.name.replace(/\.[^.]+$/, "")}](${dataUrl})\n`;
      const textarea = textareaRef.current;
      const start = textarea?.selectionStart ?? draft.length;
      const next = draft.slice(0, start) + snippet + draft.slice(textarea?.selectionEnd ?? draft.length);
      setDraft(next);
      window.setTimeout(() => textarea?.focus(), 0);
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <section className="mb-2">
        {project.description.trim() ? (
          <div className="group relative rounded-lg px-2.5 py-1.5">
            <div
              className="markdown"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(project.description) }}
            />
            <button
              className="btn absolute right-2 top-2 opacity-0 group-hover:opacity-100"
              style={{ height: 24, fontSize: 11 }}
              onClick={startEditing}
            >
              <Pencil size={12} />
              编辑
            </button>
          </div>
        ) : (
          <button
            className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-2 text-left text-[11.5px]"
            style={{ color: "var(--faint)" }}
            onClick={startEditing}
          >
            <Pencil size={12} />
            给这个项目写点说明，或者插入一张图…
          </button>
        )}
      </section>
    );
  }

  return (
    <section
      className="mb-3 flex flex-col gap-2 rounded-lg p-2.5"
      style={{ background: "var(--side)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-2">
        <span className="field-label">项目说明 · Markdown</span>
        <button
          className="btn ml-auto"
          style={{ height: 24, fontSize: 11.5 }}
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus size={12} />
          {busy ? "处理中…" : "插入图片"}
        </button>
        <button className="btn" style={{ height: 24, fontSize: 11.5 }} onClick={() => setEditing(false)}>
          <X size={12} />
          取消
        </button>
        <button className="btn btn-primary" style={{ height: 24, fontSize: 11.5 }} onClick={save}>
          保存
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void insertImage(file);
            event.target.value = "";
          }}
        />
      </div>
      <textarea
        ref={textareaRef}
        className="input"
        rows={5}
        autoFocus
        placeholder="支持 Markdown：**粗体**、- 列表、## 小标题，也可以点「插入图片」"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
    </section>
  );
}
