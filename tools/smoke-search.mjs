// 全局搜索 / 筛选 / 保存视图 的冒烟测试。
// 用法：vite preview --port 5181 之后 node tools/smoke-search.mjs http://localhost:5181/
import { chromium } from "file:///C:/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const URL = process.argv[2] ?? "http://localhost:5181/";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const VIEW_NAME = "我的进行中";

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("favicon")) errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

const out = {};
const rows = () => page.locator(".list-row");
const drawer = () => page.locator(".fixed").first();

await page.goto(URL, { waitUntil: "load" });
await page.waitForTimeout(900);
out.rowsBefore = await rows().count();

// ---------- 全局搜索（⌘K / Ctrl+K） ----------
await page.keyboard.press("Control+k");
await page.waitForTimeout(300);
const searchInput = page.locator('input[placeholder*="搜索任务"]');
out.searchOpen = (await searchInput.count()) > 0;
await searchInput.fill("埋点");
await page.waitForTimeout(300);
out.searchResults = await page.locator("button", { hasText: "输出数据埋点方案" }).count();
await searchInput.press("Enter");
await page.waitForTimeout(400);
out.openedFromSearch = await drawer().locator("input.input").first().inputValue();
await drawer().locator('button[aria-label="关闭"]').first().click();
await page.waitForTimeout(250);
out.searchClosed = (await page.locator('input[placeholder*="搜索任务"]').count()) === 0;

// ---------- 按标签搜索 ----------
await page.keyboard.press("Control+k");
await page.waitForTimeout(250);
await page.locator('input[placeholder*="搜索任务"]').fill("跨部门");
await page.waitForTimeout(300);
out.tagHit = await page.locator("button", { hasText: "跨部门" }).count();
await page.keyboard.press("Escape");
await page.waitForTimeout(250);

// ---------- 筛选 ----------
await page.locator("header button", { hasText: "筛选" }).click();
await page.waitForTimeout(300);
out.filterPanelOpen = (await page.locator('input[placeholder*="关键字"]').count()) > 0;
await page.locator(".seg-item", { hasText: "进行中" }).click();
await page.waitForTimeout(400);
out.rowsFiltered = await rows().count();

await page.locator("header button", { hasText: "筛选" }).click();
await page.waitForTimeout(300);
out.summaryVisible = (await page.locator("text=筛选生效中").count()) > 0;
out.filterChips = await page.locator("span.chip").count();

// ---------- 保存视图 ----------
await page.locator("header button", { hasText: "筛选" }).click();
await page.waitForTimeout(300);
await page.locator('input[aria-label="视图名称"]').fill(VIEW_NAME);
await page.locator("button", { hasText: "保存为视图" }).click();
await page.waitForTimeout(400);
out.savedInSidebar = await page.locator("aside button", { hasText: VIEW_NAME }).count();

// ---------- 清除筛选后再点保存的视图 ----------
await page.locator("button", { hasText: "清除筛选" }).click();
await page.waitForTimeout(400);
out.rowsAfterClear = await rows().count();
await page.locator("aside button", { hasText: VIEW_NAME }).click();
await page.waitForTimeout(400);
out.rowsAfterApplyView = await rows().count();

// ---------- 刷新后视图还在 ----------
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(900);
out.savedAfterReload = await page.locator("aside button", { hasText: VIEW_NAME }).count();

// ---------- 删除视图 ----------
await page.locator(`button[aria-label="删除视图 ${VIEW_NAME}"]`).click();
await page.waitForTimeout(400);
out.savedAfterDelete = await page.locator("aside button", { hasText: VIEW_NAME }).count();

out.consoleErrors = errors;
console.log(JSON.stringify(out, null, 2));
await browser.close();
