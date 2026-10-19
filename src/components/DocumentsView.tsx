import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import {
  Bold,
  ChevronDown,
  ChevronRight,
  Code,
  FilePlus2,
  FileText,
  Folder,
  FolderPlus,
  Heading1,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Plus,
  Quote,
  Redo2,
  Strikethrough,
  Trash2,
  Underline as UnderlineIcon,
  Undo2
} from "lucide-react";
import { repo } from "../state/store";
import type { DocNode, Id, Project, Snapshot } from "../data/types";

interface Props {
  snapshot: Snapshot;
  project: Project | undefined;
  focusDocId?: string | null;
}

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

export default function DocumentsView({ snapshot, project, focusDocId }: Props) {
  const docs = useMemo(
    () => snapshot.docs.filter((doc) => doc.deletedAt === null && doc.projectId === project?.id).sort((a, b) => a.sortOrder - b.sortOrder),
    [snapshot.docs, project?.id]
  );

  const [selectedId, setSelectedId] = useState<Id | null>(null);
  const [expanded, setExpanded] = useState<Set<Id>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<Id | null>(null);
  const [tick, setTick] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<Id | null>(null);
  const saveTimer = useRef<number | null>(null);

  const active = docs.find((doc) => doc.id === selectedId) ?? null;

  useEffect(() => {
    activeRef.current = active?.kind === "doc" ? active.id : null;
  }, [active?.id, active?.kind]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Image.configure({ inline: false, allowBase64: true })
    ],
    content: "",
    editorProps: {
      attributes: { class: "pm-doc-content" }
    },
    onTransaction: () => setTick((value) => value + 1),
    onUpdate: ({ editor: instance }) => {
      const id = activeRef.current;
      if (!id) return;
      const html = instance.getHTML();
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => repo.updateDoc(id, { content: html }), 500);
    }
  });

  // 切换文档时把内容灌进编辑器（只依赖 id，避免每次自动保存都重置光标）
  useEffect(() => {
    if (!editor || active?.kind !== "doc") return;
    const html = active.content || "";
    if (editor.getHTML() !== html) editor.commands.setContent(html, { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, active?.id]);

  useEffect(() => {
    if (!project) setSelectedId(null);
  }, [project?.id]);

  useEffect(() => {
    if (focusDocId) setSelectedId(focusDocId);
  }, [focusDocId]);

  if (!project) {
    return (
      <div className="grid h-full place-items-center px-6 text-center">
        <div>
          <p className="text-sm font-medium">先选择一个项目</p>
          <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
            文档是挂在项目下面的，从左侧点一个项目再进来。
          </p>
        </div>
      </div>
    );
  }

  const children = (parentId: Id | null) => docs.filter((doc) => doc.parentId === parentId);

  const renderTree = (parentId: Id | null, depth: number): React.ReactNode =>
    children(parentId).map((doc) => {
      const isOpen = expanded.has(doc.id);
      const hasChildren = children(doc.id).length > 0;
      return (
        <div key={doc.id}>
          <div className="group flex items-center">
            <button
              className="nav-item min-w-0 flex-1"
              aria-current={selectedId === doc.id}
              style={{ paddingLeft: 6 + depth * 12 }}
              onClick={() => {
                if (doc.kind === "folder") {
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(doc.id)) next.delete(doc.id);
                    else next.add(doc.id);
                    return next;
                  });
                } else {
                  setSelectedId(doc.id);
                }
              }}
            >
              {doc.kind === "folder" ? (
                hasChildren ? (
                  isOpen ? (
                    <ChevronDown size={13} />
                  ) : (
                    <ChevronRight size={13} />
                  )
                ) : (
                  <ChevronRight size={13} style={{ opacity: 0.3 }} />
                )
              ) : null}
              {doc.kind === "folder" ? <Folder size={14} /> : <FileText size={14} />}
              <span className="flex-1 truncate">{doc.title}</span>
            </button>
            <button
              className="icon-btn h-5 w-5 opacity-0 group-hover:opacity-100"
              aria-label={confirmDelete === doc.id ? `确认删除 ${doc.title}` : `删除 ${doc.title}`}
              style={confirmDelete === doc.id ? { color: "var(--red)" } : undefined}
              onMouseLeave={() => setConfirmDelete((current) => (current === doc.id ? null : current))}
              onClick={() => {
                if (confirmDelete !== doc.id) {
                  setConfirmDelete(doc.id);
                  return;
                }
                repo.deleteDoc(doc.id);
                setConfirmDelete(null);
                if (selectedId === doc.id) setSelectedId(null);
              }}
            >
              {confirmDelete === doc.id ? <span className="text-[9px]">确认</span> : <Trash2 size={12} />}
            </button>
          </div>
          {doc.kind === "folder" && isOpen ? renderTree(doc.id, depth + 1) : null}
        </div>
      );
    });

  const createDoc = (kind: DocNode["kind"], parentId: Id | null) => {
    const created = repo.createDoc(project.id, parentId, kind);
    if (kind === "folder" && parentId) {
      setExpanded((prev) => new Set(prev).add(parentId));
    }
    if (kind === "doc") setSelectedId(created.id);
  };

  return (
    <div className="flex h-full min-h-0">
      <aside className="hidden w-[224px] shrink-0 flex-col border-r p-2 md:flex" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-1 px-1 pb-2">
          <span className="text-[11px]" style={{ color: "var(--faint)" }}>
            文档
          </span>
          <button className="icon-btn ml-auto h-6 w-6" aria-label="新建文档" onClick={() => createDoc("doc", null)}>
            <FilePlus2 size={14} />
          </button>
          <button className="icon-btn h-6 w-6" aria-label="新建文件夹" onClick={() => createDoc("folder", null)}>
            <FolderPlus size={14} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {docs.length === 0 ? (
            <button
              className="mt-6 flex w-full flex-col items-center gap-1 text-[11px]"
              style={{ color: "var(--faint)" }}
              onClick={() => createDoc("doc", null)}
            >
              <Plus size={16} />
              新建第一篇文档
            </button>
          ) : (
            renderTree(null, 0)
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {active?.kind === "doc" ? (
          <>
            <div
              className="flex flex-wrap items-center gap-0.5 border-b px-3 py-1.5"
              style={{ borderColor: "var(--border)" }}
            >
              <ToolButton label="粗体" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}>
                <Bold size={14} />
              </ToolButton>
              <ToolButton label="斜体" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}>
                <Italic size={14} />
              </ToolButton>
              <ToolButton label="下划线" active={editor?.isActive("underline")} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
                <UnderlineIcon size={14} />
              </ToolButton>
              <ToolButton label="删除线" active={editor?.isActive("strike")} onClick={() => editor?.chain().focus().toggleStrike().run()}>
                <Strikethrough size={14} />
              </ToolButton>
              <span className="mx-1 h-4 w-px" style={{ background: "var(--border)" }} />
              <ToolButton label="一级标题" active={editor?.isActive("heading", { level: 1 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
                <Heading1 size={14} />
              </ToolButton>
              <ToolButton label="二级标题" active={editor?.isActive("heading", { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
                <Heading2 size={14} />
              </ToolButton>
              <ToolButton label="无序列表" active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
                <List size={14} />
              </ToolButton>
              <ToolButton label="有序列表" active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
                <ListOrdered size={14} />
              </ToolButton>
              <ToolButton label="引用" active={editor?.isActive("blockquote")} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
                <Quote size={14} />
              </ToolButton>
              <ToolButton label="代码块" active={editor?.isActive("codeBlock")} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}>
                <Code size={14} />
              </ToolButton>
              <span className="mx-1 h-4 w-px" style={{ background: "var(--border)" }} />
              <ToolButton label="插入图片" onClick={() => fileRef.current?.click()}>
                <ImagePlus size={14} />
              </ToolButton>
              <ToolButton
                label="链接"
                active={editor?.isActive("link")}
                onClick={() => {
                  const previous = editor?.getAttributes("link").href ?? "https://";
                  const href = window.prompt("链接地址", previous);
                  if (href === null) return;
                  if (!href.trim()) editor?.chain().focus().unsetLink().run();
                  else editor?.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
                }}
              >
                <Link2 size={14} />
              </ToolButton>
              <span className="mx-1 h-4 w-px" style={{ background: "var(--border)" }} />
              <ToolButton label="撤销" onClick={() => editor?.chain().focus().undo().run()}>
                <Undo2 size={14} />
              </ToolButton>
              <ToolButton label="重做" onClick={() => editor?.chain().focus().redo().run()}>
                <Redo2 size={14} />
              </ToolButton>
              <span className="ml-auto text-[10.5px]" style={{ color: "var(--faint)" }}>
                自动保存
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto max-w-[760px] px-6 py-5">
                <input
                  className="w-full border-0 bg-transparent text-[22px] font-medium outline-none"
                  style={{ color: "var(--fg)" }}
                  aria-label="文档标题"
                  value={active.title}
                  onChange={(event) => repo.updateDoc(active.id, { title: event.target.value })}
                />
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {active.tagIds
                    .map((id) => snapshot.tags.find((tag) => tag.id === id))
                    .filter((tag) => tag !== undefined)
                    .map((tag) => (
                      <span key={tag.id} className="chip">
                        {tag.name}
                      </span>
                    ))}
                  <select
                    className="text-[11px]"
                    style={{ background: "transparent", color: "var(--faint)", border: 0 }}
                    value=""
                    aria-label="给文档加标签"
                    onChange={(event) => {
                      const id = event.target.value;
                      if (id && !active.tagIds.includes(id)) repo.updateDoc(active.id, { tagIds: [...active.tagIds, id] });
                    }}
                  >
                    <option value="">＋ 标签</option>
                    {snapshot.tags
                      .filter((tag) => tag.deletedAt === null && !active.tagIds.includes(tag.id))
                      .map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="pm-doc mt-3" data-tick={tick}>
                  <EditorContent editor={editor} />
                </div>
              </div>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                const src = await fileToDataUrl(file);
                editor?.chain().focus().setImage({ src }).run();
              }}
            />
          </>
        ) : (
          <div className="grid h-full place-items-center px-6 text-center">
            <div>
              <FileText size={20} style={{ color: "var(--faint)" }} className="mx-auto" />
              <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                {docs.some((doc) => doc.kind === "doc") ? "从左侧选一篇文档开始编辑" : "这个项目还没有文档"}
              </p>
              <button className="btn mt-3" onClick={() => createDoc("doc", null)}>
                <FilePlus2 size={14} />
                新建文档
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolButton({
  label,
  active,
  onClick,
  children
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className="grid h-7 w-7 place-items-center rounded"
      style={{ background: active ? "var(--gray-soft)" : "transparent", color: active ? "var(--fg)" : "var(--muted)" }}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
