// 文档模块：新建、编辑、加粗、插图、自动保存、刷新保留。
// 用法：node tools/smoke-docs.mjs http://localhost:5181/
import { chromium } from "file:///C:/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const URL = process.argv[2] ?? "http://localhost:5181/";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("favicon")) errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

const out = {};

const openDocs = async () => {
  await page.locator("aside button.nav-item", { hasText: "产品改版 v2.0" }).first().click();
  await page.waitForTimeout(300);
  await page.locator("header .seg-item", { hasText: "文档" }).click();
  await page.waitForTimeout(400);
};

await page.goto(URL, { waitUntil: "load" });
await page.waitForTimeout(900);
await openDocs();

out.docsEmpty = (await page.locator("text=这个项目还没有文档").count()) > 0;

await page.locator("button", { hasText: "新建文档" }).first().click();
await page.waitForTimeout(500);
out.editorReady = (await page.locator(".ProseMirror").count()) > 0;

await page.locator('input[aria-label="文档标题"]').fill("部署手册");
await page.locator(".ProseMirror").click();
await page.keyboard.type("这是第一段正文。");
await page.locator('button[aria-label="粗体"]').click();
await page.keyboard.type("重要内容");
await page.waitForTimeout(300);

// 插入一张图
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
await page.locator('input[type="file"]').first().setInputFiles({ name: "shot.png", mimeType: "image/png", buffer: png });
await page.waitForTimeout(800);

out.hasBold = (await page.locator(".ProseMirror strong").count()) > 0;
out.hasImage = (await page.locator(".ProseMirror img").count()) > 0;
out.treeHasDoc = (await page.locator("aside button.nav-item", { hasText: "部署手册" }).count()) > 0;

// 全局搜索能搜到文档
await page.keyboard.press("Control+k");
await page.waitForTimeout(300);
await page.locator('input[placeholder*="搜索任务"]').fill("部署手册");
await page.waitForTimeout(300);
out.docSearchHit = (await page.locator(".fixed button", { hasText: "部署手册" }).count()) > 0;
await page.keyboard.press("Escape");
await page.waitForTimeout(250);

// 新建文件夹
await page.locator('button[aria-label="新建文件夹"]').click();
await page.waitForTimeout(300);
out.folderCreated = (await page.locator("aside button.nav-item", { hasText: "新建文件夹" }).count()) > 0;

// 等自动保存，再刷新
await page.waitForTimeout(900);
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(900);
await openDocs();
out.docAfterReload = (await page.locator("aside button.nav-item", { hasText: "部署手册" }).count()) > 0;
await page.locator("aside button.nav-item", { hasText: "部署手册" }).first().click();
await page.waitForTimeout(500);
out.titleAfterReload = await page.locator('input[aria-label="文档标题"]').inputValue();
out.boldAfterReload = (await page.locator(".ProseMirror strong").count()) > 0;
out.imageAfterReload = (await page.locator(".ProseMirror img").count()) > 0;
out.textAfterReload = (await page.locator(".ProseMirror").innerText()).includes("这是第一段正文");

out.consoleErrors = errors;
console.log(JSON.stringify(out, null, 2));
await browser.close();
