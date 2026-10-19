// 只读站点冒烟测试。
// 用法：npx vite preview --config vite.site.config.ts --port 5182
//       node tools/smoke-site.mjs http://localhost:5182/
import { chromium } from "file:///C:/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const URL = process.argv[2] ?? "http://localhost:5182/";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const out = {};
const errors = [];

async function check(width, tag) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: "light" });
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("favicon")) errors.push(`[${tag}] ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`[${tag}] pageerror: ${e.message}`));

  await page.goto(URL, { waitUntil: "load" });
  await page.waitForTimeout(700);

  const result = {
    title: await page.title(),
    rows: await page.locator(".site-row").count(),
    sidebarVisible: await page.locator("aside").isVisible(),
    selectVisible: await page.locator('select[aria-label="切换项目"]').isVisible()
  };

  if (tag === "desktop") {
    result.projects = await page.locator("aside .nav-item").count();
    await page.locator(".site-row", { hasText: "梳理 v2.0 需求范围" }).click();
    await page.waitForTimeout(250);
    result.noteOpens = (await page.locator(".site-note .markdown h2").count()) > 0;

    await page.locator('input[placeholder="搜索任务或备注"]').fill("埋点");
    await page.waitForTimeout(300);
    result.rowsAfterSearch = await page.locator(".site-row").count();
  }

  if (tag === "mobile") {
    await page.locator('select[aria-label="切换项目"]').selectOption({ label: "数据看板迁移" });
    await page.waitForTimeout(300);
    result.rowsAfterSwitch = await page.locator(".site-row").count();
  }

  out[tag] = result;
  await page.close();
}

await check(1280, "desktop");
await check(390, "mobile");

out.consoleErrors = errors;
console.log(JSON.stringify(out, null, 2));
await browser.close();
