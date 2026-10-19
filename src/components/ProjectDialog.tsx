import { useState } from "react";
import { X } from "lucide-react";
import { repo } from "../state/store";
import { PROJECT_COLORS } from "../data/types";

export default function ProjectDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]);

  const create = () => {
    if (!name.trim()) return;
    repo.createProject({ name, color });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center px-4"
      style={{ background: "rgba(15,15,15,0.35)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[380px] rounded-xl p-4"
        style={{ background: "var(--bg)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center">
          <h2 className="text-sm font-medium">新建项目</h2>
          <button className="icon-btn ml-auto" onClick={onClose} aria-label="关闭">
            <X size={16} />
          </button>
        </div>

        <input
          className="input"
          autoFocus
          placeholder="项目名称，例如：产品改版 v2.0"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") create();
          }}
        />

        <div className="mt-3">
          <span className="field-label">颜色</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {PROJECT_COLORS.map((item) => (
              <button
                key={item}
                onClick={() => setColor(item)}
                aria-label={`选择颜色 ${item}`}
                aria-pressed={color === item}
                className="h-6 w-6 rounded-md"
                style={{
                  background: item,
                  outline: color === item ? "2px solid var(--fg)" : "none",
                  outlineOffset: 2
                }}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" onClick={create} disabled={!name.trim()}>
            创建
          </button>
        </div>
      </div>
    </div>
  );
}
