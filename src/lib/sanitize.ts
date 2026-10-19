/**
 * 只读站渲染文档 HTML 前的白名单清洗。
 * 内容是自己写的，但发布出去之后任何脚本都可能被放进公开页面，所以统一过一遍。
 */

const ALLOWED = new Set([
  "P",
  "H1",
  "H2",
  "H3",
  "UL",
  "OL",
  "LI",
  "BLOCKQUOTE",
  "PRE",
  "CODE",
  "STRONG",
  "EM",
  "U",
  "S",
  "A",
  "IMG",
  "BR",
  "HR"
]);

export function sanitizeHtml(html: string): string {
  if (typeof document === "undefined") return "";

  const template = document.createElement("template");
  template.innerHTML = html;

  const walk = (parent: ParentNode) => {
    for (const element of [...parent.children]) {
      if (!ALLOWED.has(element.tagName)) {
        element.replaceWith(...element.childNodes);
        continue;
      }

      for (const attribute of [...element.attributes]) {
        const name = attribute.name.toLowerCase();
        const isLinkAttr = element.tagName === "A" && (name === "href" || name === "target" || name === "rel");
        const isImageAttr = element.tagName === "IMG" && (name === "src" || name === "alt");
        if (!isLinkAttr && !isImageAttr) element.removeAttribute(attribute.name);
      }

      if (element.tagName === "A") {
        const href = element.getAttribute("href") ?? "";
        if (!/^(https?:\/\/|mailto:)/i.test(href)) element.removeAttribute("href");
        element.setAttribute("rel", "noreferrer noopener");
      }

      if (element.tagName === "IMG") {
        const src = element.getAttribute("src") ?? "";
        if (!/^(data:image\/(png|jpe?g|webp|gif);base64,|https?:\/\/)/i.test(src)) element.removeAttribute("src");
      }

      walk(element);
    }
  };

  walk(template.content);
  return template.innerHTML;
}
