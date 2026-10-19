// 项目删除 / 已完成清理 / 重复任务提示 的冒烟测试。
// 用法：node tools/smoke-projects.mjs http://localhost:5181/
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

async function searchCount(text) {
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(300);
  await page.locator('input[placeholder*="搜索任务"]').fill(text);
  await page.waitForTimeout(300);
  const count = await page.locator(".fixed button", { hasText: text }).count();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  return count;
}

await page.goto(URL, { waitUntil: "load" });
await page.waitForTimeout(900);

// ---------- 重复任务：生成下一次 + 撤销 ----------
out.repeatBefore = await searchCount("每日站会纪要");
await page.locator(".list-row", { hasText: "每日站会纪要" }).first().locator(".checkbox").click();
await page.waitForTimeout(500);
out.spawnToastVisible = (await page.locator("text=这是重复任务，已生成下一次").count()) > 0;
out.repeatAfter = await searchCount("每日站会纪要");

await page.locator("button", { hasText: "撤销生成" }).click();
await page.waitForTimeout(400);
out.toastGone = (await page.locator("text=这是重复任务，已生成下一次").count()) === 0;
out.repeatAfterUndo = await searchCount("每日站会纪要");

// ---------- 清理已完成 ----------
await page.locator(".group-head", { hasText: "已完成" }).click();
await page.waitForTimeout(300);
const doneRows = await page.locator(".list-row").count();
await page.locator("button", { hasText: "清理" }).click();
await page.waitForTimeout(200);
out.confirmLabel = (await page.locator("button", { hasText: "确认删除" }).count()) > 0;
await page.locator("button", { hasText: "确认删除" }).click();
await page.waitForTimeout(500);
out.doneAfterCleanup = (await page.locator(".group-head", { hasText: "已完成" }).count()) > 0;
out.rowsBeforeCleanup = doneRows;

// ---------- 删除项目 ----------
const firstProject = page.locator("aside button.nav-item", { hasText: "产品改版 v2.0" }).first();
await firstProject.hover();
await page.locator('button[aria-label="管理项目 产品改版 v2.0"]').click();
await page.waitForTimeout(300);
out.dialogOpen = (await page.locator("text=条任务").count()) > 0;
await page.locator("button", { hasText: "删除项目" }).click();
await page.waitForTimeout(200);
out.deleteConfirm = (await page.locator("button", { hasText: "确认删除项目" }).count()) > 0;
await page.locator("button", { hasText: "确认删除项目" }).click();
await page.waitForTimeout(600);
out.projectGone = (await page.locator("aside button.nav-item", { hasText: "产品改版 v2.0" }).count()) === 0;

// 刷新后仍然是删除状态
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(900);
out.projectGoneAfterReload = (await page.locator("aside button.nav-item", { hasText: "产品改版 v2.0" }).count()) === 0;

out.consoleErrors = errors;
console.log(JSON.stringify(out, null, 2));
await browser.close();
