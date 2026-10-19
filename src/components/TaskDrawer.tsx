import { useState, type ReactNode } from "react";
import { Eye, FilePlus2, Pencil, Tag as TagIcon, Trash2, X } from "lucide-react";
import { repo } from "../state/store";
import { activeProjects, blockersOf, dependentsOf, liveTasks, remindAtMs, reminderOf, settingValue } from "../data/select";
import {
  DEFAULT_REMINDER_TIME,
  REMINDER_PRESETS,
  TASK_PRIORITY_LABEL,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  type Snapshot,
  type Task,
  type TaskPriority,
  type RepeatFreq
} from "../data/types";
import { dayDiff, formatDateTime, formatFull, fromDateInput, parseTimeOfDay, toDateInput } from "../lib/date";
import { renderMarkdown } from "../lib/markdown";
import { REPEAT_LABEL } from "../lib/repeat";

interface Props {
  snapshot: Snapshot;
  task: Task;
  focusTitle?: boolean;
  onOpenTask: (id: string) => void;
  onClose: () => void;
}

export default function TaskDrawer({ snapshot, task, focusTitle = false, onOpenTask, onClose }: Props) {
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note);
  const [preview, setPreview] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [depPick, setDepPick] = useState("");
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState(task.title);
  const [templateOffset, setTemplateOffset] = useState(() =>
    task.dueAt === null ? "" : String(Math.max(0, dayDiff(task.dueAt, Date.now())))
  );

  const projects = activeProjects(snapshot);
  const tags = snapshot.tags.filter((tag) => tag.deletedAt === null);
  const update = (patch: Partial<Task>) => repo.updateTask(task.id, patch);

  const blockers = blockersOf(snapshot, task);
  const blockedIds = new Set(blockers.map((item) => item.task.id));
  const dependents = dependentsOf(snapshot, task.id);
  const dependentIds = new Set(dependents.map((item) => item.id));
  const dependencyOptions = liveTasks(snapshot).filter(
    (item) =>
      item.id !== task.id &&
      !blockedIds.has(item.id) &&
      !dependentIds.has(item.id) &&
      (task.projectId === null || item.projectId === task.projectId)
  );

  const reminder = reminderOf(snapshot, task.id);
  const timeOfDayMs = parseTimeOfDay(settingValue(snapshot, "reminderTime", DEFAULT_REMINDER_TIME));
  const fireAt = remindAtMs(task.dueAt, reminder?.offsetMinutes ?? 0, timeOfDayMs);

  const commitTitle = () => {
    const next = title.trim();
    if (next && next !== task.title) update({ title: next });
    else setTitle(task.title);
  };

  const commitNote = () => {
    if (note !== task.note) update({ note });
  };

  const addTag = () => {
    const name = tagDraft.trim();
    if (!name) return;
    const tag = repo.ensureTag(name);
    if (!task.tagIds.includes(tag.id)) update({ tagIds: [...task.tagIds, tag.id] });
    setTagDraft("");
  };

  const removeTag = (id: string) => update({ tagIds: task.tagIds.filter((tagId) => tagId !== id) });

  return (
    <div className="fixed inset-0 z-30 flex justify-end" style={{ background: "rgba(15,15,15,0.28)" }} onClick={onClose}>
      <div
        className="flex h-full w-full max-w-[400px] flex-col overflow-y-auto"
        style={{ background: "var(--bg)", borderLeft: "1px solid var(--border)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
          <span className={`pill pill-${task.status}`}>{TASK_STATUS_LABEL[task.status]}</span>
          <span className="text-[11px]" style={{ color: "var(--faint)" }}>
            更新于 {formatFull(task.updatedAt)}
          </span>
          <button className="icon-btn ml-auto" onClick={onClose} aria-label="关闭">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-4 py-4">
          <input
            className="input"
            style={{ height: 38, fontSize: 16, fontWeight: 500 }}
            autoFocus={focusTitle}
            onFocus={(event) => {
              if (focusTitle) event.currentTarget.select();
            }}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={commitTitle}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />

          <div className="flex flex-col gap-2.5">
            <Row label="状态">
              <div className="seg flex-wrap">
                {TASK_STATUSES.map((status) => (
                  <button
                    key={status}
                    className="seg-item"
                    aria-pressed={task.status === status}
                    onClick={() => update({ status })}
                  >
                    {TASK_STATUS_LABEL[status]}
                  </button>
                ))}
              </div>
            </Row>

            <Row label="所属项目">
              <select
                className="input"
                value={task.projectId ?? ""}
                onChange={(event) => update({ projectId: event.target.value || null })}
              >
                <option value="">（无项目 · 收件箱）</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </Row>

            <Row label="优先级">
              <select
                className="input"
                value={task.priority}
                onChange={(event) => update({ priority: event.target.value as TaskPriority })}
              >
                {(["high", "mid", "low"] as TaskPriority[]).map((priority) => (
                  <option key={priority} value={priority}>
                    {TASK_PRIORITY_LABEL[priority]}
                  </option>
                ))}
              </select>
            </Row>

            <Row label="开始">
              <input
                type="date"
                className="input"
                value={toDateInput(task.startAt)}
                onChange={(event) => update({ startAt: fromDateInput(event.target.value) })}
              />
            </Row>

            <Row label="截止">
              <input
                type="date"
                className="input"
                value={toDateInput(task.dueAt)}
                onChange={(event) => update({ dueAt: fromDateInput(event.target.value) })}
              />
            </Row>

            <Row label="标签">
              <div className="flex flex-wrap gap-1.5">
                {task.tagIds
                  .map((id) => tags.find((tag) => tag.id === id))
                  .filter((tag) => tag !== undefined)
                  .map((tag) => (
                    <span key={tag.id} className="chip min-w-0 max-w-full">
                      <TagIcon size={10} className="mr-1" />
                      <span className="truncate">{tag.name}</span>
                      <button
                        className="ml-1 shrink-0"
                        style={{ color: "var(--faint)" }}
                        onClick={() => removeTag(tag.id)}
                        aria-label={`移除标签 ${tag.name}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                {tags
                  .filter((tag) => !task.tagIds.includes(tag.id))
                  .slice(0, 12)
                  .map((tag) => (
                    <button
                      key={`pick-${tag.id}`}
                      className="chip"
                      style={{ color: "var(--faint)" }}
                      onClick={() => update({ tagIds: [...task.tagIds, tag.id] })}
                    >
                      ＋{tag.name}
                    </button>
                  ))}
                <input
                  className="input"
                  style={{ width: 108, height: 24, fontSize: 12 }}
                  placeholder="新建标签"
                  value={tagDraft}
                  onChange={(event) => setTagDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addTag();
                  }}
                />
              </div>
            </Row>

            <Row label="提醒">
              {task.dueAt === null ? (
                <span className="text-[11px]" style={{ color: "var(--faint)" }}>
                  先设置截止时间
                </span>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="input"
                    style={{ width: 116, height: 26, fontSize: 12 }}
                    value={reminder ? String(reminder.offsetMinutes) : ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (!value) {
                        if (reminder) repo.removeReminder(reminder.id);
                        return;
                      }
                      repo.setReminder(task.id, Number(value));
                    }}
                  >
                    <option value="">不提醒</option>
                    {REMINDER_PRESETS.map((preset) => (
                      <option key={preset.minutes} value={preset.minutes}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                  {reminder && fireAt !== null ? (
                    <span className="text-[11px]" style={{ color: reminder.firedAt ? "var(--green)" : "var(--muted)" }}>
                      {formatDateTime(fireAt)} 弹窗{reminder.firedAt ? " · 已提醒" : ""}
                    </span>
                  ) : null}
                </div>
              )}
            </Row>

            <Row label="重复">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="input"
                  style={{ width: 116, height: 26, fontSize: 12 }}
                  value={task.repeat ?? ""}
                  onChange={(event) => repo.setTaskRepeat(task.id, (event.target.value || null) as RepeatFreq | null)}
                >
                  <option value="">不重复</option>
                  {(Object.keys(REPEAT_LABEL) as RepeatFreq[]).map((freq) => (
                    <option key={freq} value={freq}>
                      {REPEAT_LABEL[freq]}
                    </option>
                  ))}
                </select>
                {task.repeat ? (
                  <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                    完成后自动生成下一次
                  </span>
                ) : null}
              </div>
            </Row>
          </div>

          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="field-label">备注 · Markdown</span>
              <button className="btn ml-auto" style={{ height: 24, fontSize: 11.5 }} onClick={() => setPreview(!preview)}>
                {preview ? <Pencil size={12} /> : <Eye size={12} />}
                {preview ? "编辑" : "预览"}
              </button>
            </div>
            {preview ? (
              <div
                className="markdown rounded-lg px-3 py-2"
                style={{ background: "var(--gray-soft)" }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(note) }}
              />
            ) : (
              <textarea
                className="input"
                rows={7}
                placeholder={"支持 # 标题、- 列表、- [ ] 待办、**粗体**、`代码`"}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                onBlur={commitNote}
              />
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="field-label">前置依赖（要等它们完成）</span>
              {blockers.some((item) => item.violated) ? (
                <span className="pill" style={{ background: "var(--red-soft)", color: "var(--red)" }}>
                  排期冲突
                </span>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              {blockers.length === 0 ? (
                <span className="text-[11px]" style={{ color: "var(--faint)" }}>
                  暂无
                </span>
              ) : (
                blockers.map((item) => (
                  <div key={item.dep.id} className="flex items-center gap-2 text-xs">
                    <span className={`pill pill-${item.task.status}`}>{TASK_STATUS_LABEL[item.task.status]}</span>
                    <button className="min-w-0 flex-1 truncate text-left" onClick={() => onOpenTask(item.task.id)}>
                      {item.task.title}
                    </button>
                    {item.violated ? (
                      <span className="tone-over text-[11px]" title="前置任务还没完成，本任务已经开始">
                        冲突
                      </span>
                    ) : null}
                    <button
                      className="icon-btn h-5 w-5"
                      aria-label="移除依赖"
                      onClick={() => repo.removeDependency(item.dep.id)}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}

              <select
                className="input"
                style={{ height: 26, fontSize: 12 }}
                value={depPick}
                onChange={(event) => {
                  const value = event.target.value;
                  setDepPick("");
                  if (value) repo.addDependency(task.id, value);
                }}
              >
                <option value="">＋ 添加前置任务…</option>
                {dependencyOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>

              {dependents.length > 0 ? (
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]" style={{ color: "var(--faint)" }}>
                  被依赖：
                  {dependents.map((item) => (
                    <button key={item.id} className="chip" onClick={() => onOpenTask(item.id)}>
                      {item.title}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
            <button className="btn" onClick={() => setTemplateOpen((prev) => !prev)}>
              <FilePlus2 size={14} />
              存为模板
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                repo.deleteTask(task.id);
                onClose();
              }}
            >
              <Trash2 size={14} />
              删除任务
            </button>
            <span className="ml-auto text-[11px]" style={{ color: "var(--faint)" }}>
              改动即时保存
            </span>
          </div>

          {templateOpen ? (
            <div
              className="flex flex-col gap-2 rounded-lg p-3"
              style={{ background: "var(--gray-soft)" }}
            >
              <span className="field-label">把这个任务存成模板</span>
              <input
                className="input"
                aria-label="模板名称"
                placeholder="模板名称"
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
              />
              <div className="flex items-center gap-2">
                <span className="field-label" style={{ width: 88 }}>
                  几天后到期
                </span>
                <input
                  className="input"
                  aria-label="到期偏移天数"
                  style={{ width: 70 }}
                  inputMode="numeric"
                  placeholder="留空"
                  value={templateOffset}
                  onChange={(event) => setTemplateOffset(event.target.value.replace(/[^0-9]/g, ""))}
                />
                <button
                  className="btn btn-primary ml-auto"
                  onClick={() => {
                    repo.createTemplate({
                      name: templateName.trim() || task.title,
                      title: task.title,
                      note: task.note,
                      priority: task.priority,
                      projectId: task.projectId,
                      tagIds: task.tagIds,
                      dueOffsetDays: templateOffset === "" ? null : Number(templateOffset),
                      repeat: task.repeat
                    });
                    setTemplateOpen(false);
                  }}
                >
                  保存模板
                </button>
              </div>
              <span className="text-[11px]" style={{ color: "var(--faint)" }}>
                模板会记住标题、备注、优先级、项目、标签、默认到期天数和重复规则，之后在左侧「模板」里点一下就能建任务。
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid items-center gap-2" style={{ gridTemplateColumns: "64px minmax(0,1fr)" }}>
      <span className="field-label">{label}</span>
      <div>{children}</div>
    </div>
  );
}
