/**
 * 极简 Markdown 渲染：标题、列表、勾选框、粗体、行内代码、链接。
 * 先转义 HTML 再套用规则，避免内容里的尖括号被当成标签。
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_match, alt: string, src: string) =>
      /^(data:image\/(png|jpe?g|webp|gif);base64,|https?:\/\/)/i.test(src)
        ? `<img src="${src}" alt="${alt}" style="max-width:100%;border-radius:6px;margin:6px 0" />`
        : ""
    )
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

export function renderMarkdown(source: string): string {
  const lines = escapeHtml(source).split("\n");
  const html: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");

    if (!line.trim()) {
      closeList();
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1].length + 1;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      const item = bullet[1];
      const checkbox = /^\[( |x|X)\]\s*(.*)$/.exec(item);
      if (checkbox) {
        const checked = checkbox[1].toLowerCase() === "x";
        html.push(
          `<li style="list-style:none;margin-left:-18px">${checked ? "☑" : "☐"} ${
            checked ? `<span style="text-decoration:line-through;opacity:.6">${inline(checkbox[2])}</span>` : inline(checkbox[2])
          }</li>`
        );
      } else {
        html.push(`<li>${inline(item)}</li>`);
      }
      continue;
    }

    closeList();
    html.push(`<p>${inline(line)}</p>`);
  }

  closeList();
  return html.join("\n");
}
