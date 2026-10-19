// 今日视图 / 提醒 / 设置 的冒烟测试。
// 用法：vite preview --port 5181 之后 node tools/smoke-reminders.mjs http://localhost:5181/
import { chromium } from "file:///C:/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const URL = process.argv[2] ?? "http://localhost:5181/";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const SUBJECT = "随手记：周会提到的资源问题"; // 示例数据里截止日是今天的任务

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("favicon")) errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

const out = {};
const drawer = () => page.locator(".fixed").first();
const toasts = () => page.locator('[role="status"] div.rounded-xl');

async function nav(name) {
  await page.locator("aside .nav-item", { hasText: name }).first().click();
  await page.waitForTimeout(400);
}

async function openTaskByTitle(title) {
  await page.locator(".list-row", { hasText: title }).first().click();
  await page.waitForTimeout(350);
}

async function closeDrawer() {
  await drawer().locator('button[aria-label="关闭"]').first().click();
  await page.waitForTimeout(250);
}

await page.goto(URL, { waitUntil: "load" });
await page.waitForTimeout(900);

// ---------- 今日视图 ----------
await nav("今天");
out.todaySections = (await page.locator("section > div.font-medium").allInnerTexts()).map((t) => t.replace(/\n/g, " "));
out.todayHeader = (await page.locator("h1").first().innerText()).trim();
out.todayRows = await page.locator(".list-row").count();

// ---------- 设置 ----------
await page.locator("aside .nav-item", { hasText: "设置" }).first().click();
await page.waitForTimeout(300);
out.settingsOpen = (await page.locator("text=提醒时刻").count()) > 0;
out.reminderTimeBefore = await page.locator('input[type="time"]').inputValue();
out.storageLine = await page.locator("text=存储方式").first().innerText();

// 把提醒时刻改到 00:00，这样「准时」的提醒一定已经过点
await page.locator('input[type="time"]').fill("00:00");
await page.waitForTimeout(300);
out.reminderTimeAfter = await page.locator('input[type="time"]').inputValue();
await page.locator('button[aria-label="关闭"]').last().click();
await page.waitForTimeout(300);

// ---------- 设一个提醒 ----------
await nav("今天");
await openTaskByTitle(SUBJECT);
const reminderSelect = drawer().locator("select").filter({ hasText: "不提醒" });
out.reminderSelectVisible = await reminderSelect.count();
await reminderSelect.selectOption({ label: "准时" });
await page.waitForTimeout(1200);

out.toastCount = await toasts().count();
out.toastText = out.toastCount > 0 ? (await toasts().first().innerText()).replace(/\n/g, " | ") : "";
out.reminderFiredLabel = (await drawer().locator("text=已提醒").count()) > 0;

// ---------- 稍后提醒 ----------
await page.locator("button", { hasText: "稍后 10 分钟" }).first().click();
await page.waitForTimeout(600);
out.toastCountAfterSnooze = await toasts().count();
await closeDrawer();

// ---------- 刷新后仍在，且不会重复弹 ----------
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(1200);
out.toastAfterReload = await toasts().count();
await nav("今天");
await openTaskByTitle(SUBJECT);
out.reminderAfterReload = await drawer().locator("select").filter({ hasText: "不提醒" }).inputValue();

out.consoleErrors = errors;
console.log(JSON.stringify(out, null, 2));
await browser.close();
