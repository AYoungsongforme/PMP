/**
 * 冒烟测试：用真实浏览器跑一遍核心流程。
 * 用法：先 npm run build && npx vite preview --port 5181，然后
 *   node tools/smoke.mjs http://localhost:5181/
 */
import { chromium } from "file:///C:/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const URL = process.argv[2] ?? "http://localhost:5181/";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, colorScheme: "light" });

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("favicon")) errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(URL, { waitUntil: "load" });
await page.waitForTimeout(900);

const result = {};
result.navItems = (await page.locator("aside .nav-item").allInnerTexts()).map((t) => t.replace(/\n/g, " "));
result.groupHeads = await page.locator(".group-head").allInnerTexts();
result.visibleRows = await page.locator(".list-row").count();

await page.locator(".list-row").first().click();
await page.waitForTimeout(300);
const drawer = page.locator(".fixed").first();
result.drawerTitle = await drawer.locator("input.input").first().inputValue();

await drawer.locator(".seg-item", { hasText: "已完成" }).click();
await page.waitForTimeout(300);
result.drawerStatus = await drawer.locator(".pill").first().innerText();

const note = drawer.locator("textarea.input");
await note.fill("# 冒烟测试\n- [x] 已完成项\n- 待办项");
await note.blur();
await page.waitForTimeout(300);
await drawer.locator("button", { hasText: "预览" }).click();
await page.waitForTimeout(200);
result.markdownRendered = (await drawer.locator(".markdown").innerText()).includes("已完成项");

await drawer.locator('button[aria-label="关闭"]').first().click();
await page.waitForTimeout(300);
result.drawerClosed = (await page.locator(".fixed").count()) === 0;

const quick = page.locator('input[placeholder*="随手加一条"]').first();
await quick.fill("冒烟测试：快速新增任务");
await quick.press("Enter");
await page.waitForTimeout(400);
result.newTaskVisible = (await page.locator("text=冒烟测试：快速新增任务").count()) > 0;

await page.reload({ waitUntil: "load" });
await page.waitForTimeout(900);
result.persistedAfterReload = (await page.locator("text=冒烟测试：快速新增任务").count()) > 0;

result.consoleErrors = errors;
console.log(JSON.stringify(result, null, 2));
await browser.close();
