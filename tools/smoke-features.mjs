// 项目重命名 / 标签管理 / 新状态 / 项目说明 的冒烟测试。
// 用法：node tools/smoke-features.mjs http://localhost:5181/
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
const dialog = () => page.locator(".fixed").first();

await page.goto(URL, { waitUntil: "load" });
await page.waitForTimeout(900);

// ---------- 项目说明 ----------
await page.locator("aside button.nav-item", { hasText: "产品改版 v2.0" }).first().click();
await page.waitForTimeout(400);
await page.locator("text=给这个项目写点说明").first().click();
await page.waitForTimeout(300);
const notesBox = page.locator("textarea.input").first();
await notesBox.fill("## 项目说明\n这是**测试**内容");

// 插入一张 1×1 的图片，验证压缩与 Markdown 图片渲染
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
await page.locator('input[type="file"]').first().setInputFiles({ name: "test.png", mimeType: "image/png", buffer: png });
await page.waitForTimeout(600);
out.imageInserted = (await notesBox.inputValue()).includes("data:image/jpeg");

await page.locator("button", { hasText: "保存" }).first().click();
await page.waitForTimeout(400);
out.notesRendered = (await page.locator(".markdown", { hasText: "项目说明" }).count()) > 0;
out.noteImageRendered = (await page.locator(".markdown img").count()) > 0;

// ---------- 标签管理 ----------
await page.locator("aside button", { hasText: "管理" }).first().click();
await page.waitForTimeout(300);
await page.locator('input[placeholder="新标签名称"]').fill("测试标签");
await page.locator("button", { hasText: "添加" }).click();
await page.waitForTimeout(400);
out.tagAdded = (await page.locator('input[aria-label="标签名称 测试标签"]').count()) > 0;
await dialog().locator('button[aria-label="关闭"]').first().click();
await page.waitForTimeout(250);

// ---------- 任务里快速选标签 + 新状态 ----------
await page.locator(".list-row", { hasText: "梳理 v2.0 需求范围" }).first().click();
await page.waitForTimeout(350);
out.quickTagPick = (await page.locator("button.chip", { hasText: "测试标签" }).count()) > 0;
await page.locator("button.chip", { hasText: "测试标签" }).first().click();
await page.waitForTimeout(300);
out.tagAttached = (await dialog().locator(".chip", { hasText: "测试标签" }).count()) > 0;

// 标签改名
await dialog().locator('button[aria-label="关闭"]').first().click();
await page.waitForTimeout(250);
await page.locator("aside button", { hasText: "管理" }).first().click();
await page.waitForTimeout(300);
await page.locator('input[aria-label="标签名称 测试标签"]').fill("测试标签-改");
await page.locator('input[aria-label="标签名称 测试标签"]').blur();
await page.waitForTimeout(300);
out.tagRenamed = (await page.locator("aside .chip", { hasText: "测试标签-改" }).count()) > 0;

// 标签删除（会从任务上摘掉）
await page.locator('button[aria-label="删除标签 测试标签-改"]').click();
await page.waitForTimeout(200);
await page.locator('button[aria-label="确认删除标签 测试标签-改"]').click();
await page.waitForTimeout(400);
out.tagDeleted = (await page.locator("aside .chip", { hasText: "测试标签-改" }).count()) === 0;
await dialog().locator('button[aria-label="关闭"]').first().click();
await page.waitForTimeout(250);

await page.locator(".list-row", { hasText: "梳理 v2.0 需求范围" }).first().click();
await page.waitForTimeout(350);
out.tagRemovedFromTask = (await dialog().locator(".chip", { hasText: "测试标签" }).count()) === 0;

const statusLabels = await dialog().locator(".seg-item").allInnerTexts();
out.statusLabels = statusLabels;
await dialog().locator(".seg-item", { hasText: "中途取消" }).click();
await page.waitForTimeout(300);
out.cancelledPill = (await dialog().locator(".pill", { hasText: "中途取消" }).count()) > 0;
await dialog().locator('button[aria-label="关闭"]').first().click();
await page.waitForTimeout(250);

// ---------- 看板列 ----------
await page.locator("header .seg-item", { hasText: "看板" }).click();
await page.waitForTimeout(400);
out.boardColumns = await page.locator("div.flex.w-\\[248px\\] > div:first-child").allInnerTexts();

// ---------- 重命名项目 ----------
await page.locator("header .seg-item", { hasText: "列表" }).click();
await page.waitForTimeout(300);
await page.locator("aside button.nav-item", { hasText: "产品改版 v2.0" }).first().hover();
await page.locator('button[aria-label="管理项目 产品改版 v2.0"]').click();
await page.waitForTimeout(300);
await page.locator('input[aria-label="项目名称"]').fill("产品改版 v3.0");
await page.locator("button", { hasText: "保存" }).first().click();
await page.waitForTimeout(400);
await dialog().locator('button[aria-label="关闭"]').first().click();
await page.waitForTimeout(300);
out.renamedInSidebar = (await page.locator("aside button.nav-item", { hasText: "产品改版 v3.0" }).count()) > 0;

// ---------- 刷新后仍在 ----------
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(900);
out.renamedAfterReload = (await page.locator("aside button.nav-item", { hasText: "产品改版 v3.0" }).count()) > 0;
await page.locator("aside button.nav-item", { hasText: "产品改版 v3.0" }).first().click();
await page.waitForTimeout(400);
out.notesAfterReload = (await page.locator(".markdown", { hasText: "项目说明" }).count()) > 0;

out.consoleErrors = errors;
console.log(JSON.stringify(out, null, 2));
await browser.close();
