// 重复任务 / 任务模板 / 本地启动服务 的冒烟测试。
// 用法：node tools/serve.mjs（另开一个窗口），然后
//   node tools/smoke-templates.mjs http://localhost:5180/
import { chromium } from "file:///C:/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const URL = process.argv[2] ?? "http://localhost:5180/";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const REPEATING = "每日站会纪要";

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("favicon")) errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

const out = {};
const drawer = () => page.locator(".fixed").first();
const rows = () => page.locator(".list-row");

async function closeDrawer() {
  await drawer().locator('button[aria-label="关闭"]').first().click();
  await page.waitForTimeout(250);
}

async function searchCount(text) {
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(300);
  await page.locator('input[placeholder*="搜索任务"]').fill(text);
  await page.waitForTimeout(300);
  const count = await page.locator(".fixed button", { hasText: text }).count();
  return count;
}

await page.goto(URL, { waitUntil: "load" });
await page.waitForTimeout(900);

// ---------- 本地服务是否正常 ----------
out.servedTitle = await page.title();
out.appRendered = (await page.locator("aside").count()) > 0;
out.sidebarSections = (await page.locator("aside nav").count()) > 0;

// ---------- 重复任务 ----------
out.repeatRows = await rows().filter({ hasText: REPEATING }).count();
out.countBeforeDone = await searchCount(REPEATING);
await page.keyboard.press("Escape");
await page.waitForTimeout(250);

await rows().filter({ hasText: REPEATING }).first().click();
await page.waitForTimeout(350);
const repeatSelect = drawer().locator("select").filter({ hasText: "不重复" });
out.repeatValue = await repeatSelect.inputValue();
out.dueBefore = await drawer().locator('input[type="date"]').nth(1).inputValue();

// 勾完成，应该自动生成下一次
await drawer().locator(".seg-item", { hasText: "已完成" }).click();
await page.waitForTimeout(500);
await closeDrawer();

out.countAfterDone = await searchCount(REPEATING);
// 结果里挑「即将开始」那一条，也就是自动生成的下一次
await page.locator("button", { hasText: REPEATING }).filter({ hasText: "即将开始" }).first().click();
await page.waitForTimeout(500);
out.nextTitle = await drawer().locator("input.input").first().inputValue();
out.nextStatus = await drawer().locator(".pill").first().innerText();
out.nextDue = await drawer().locator('input[type="date"]').nth(1).inputValue();
out.nextDueIsFuture = out.nextDue !== "" && new Date(out.nextDue).getTime() > Date.now();
await closeDrawer();

// ---------- 任务模板 ----------
out.templateItems = await page.locator("aside button", { hasText: "会议纪要" }).count();
await page.locator("aside button", { hasText: "会议纪要" }).first().click();
await page.waitForTimeout(500);
out.fromTemplateTitle = await drawer().locator("input.input").first().inputValue();
out.fromTemplateDue = await drawer().locator('input[type="date"]').nth(1).inputValue();

// ---------- 存为模板 ----------
await drawer().locator("button", { hasText: "存为模板" }).click();
await page.waitForTimeout(300);
await page.locator('input[aria-label="模板名称"]').fill("测试模板");
await page.locator('input[aria-label="到期偏移天数"]').fill("3");
await page.locator("button", { hasText: "保存模板" }).click();
await page.waitForTimeout(400);
out.savedTemplate = await page.locator("aside button", { hasText: "测试模板" }).count();

// 用新存的模板建任务，检查到期偏移生效
await closeDrawer();
await page.locator("aside button", { hasText: "测试模板" }).first().click();
await page.waitForTimeout(500);
out.offsetDue = await drawer().locator('input[type="date"]').nth(1).inputValue();
await closeDrawer();

// ---------- 删除模板 + 刷新后仍在 ----------
await page.locator('button[aria-label="删除模板 测试模板"]').click();
await page.waitForTimeout(400);
out.afterDelete = await page.locator("aside button", { hasText: "测试模板" }).count();

await page.reload({ waitUntil: "load" });
await page.waitForTimeout(900);
out.templatesAfterReload = await page.locator("aside button", { hasText: "会议纪要" }).count();
out.nextOccurrenceExists = (await searchCount(REPEATING)) === 2;
await page.keyboard.press("Escape");

out.consoleErrors = errors;
console.log(JSON.stringify(out, null, 2));
await browser.close();
