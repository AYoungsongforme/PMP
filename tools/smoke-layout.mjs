// 长项目名不压到「截止」列 + 侧栏可拖拽 的布局测试。
// 用法：node tools/smoke-layout.mjs http://localhost:5181/
import { chromium } from "file:///C:/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const URL = process.argv[2] ?? "http://localhost:5181/";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const LONG = "南方电网R&D统计复核工作日长名称测试项目";

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("favicon")) errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

const out = {};

await page.goto(URL, { waitUntil: "load" });
await page.waitForTimeout(900);

// 把第一个项目改成超长名字
const first = page.locator("aside button.nav-item", { hasText: "产品改版 v2.0" }).first();
await first.hover();
await page.locator('button[aria-label="管理项目 产品改版 v2.0"]').click();
await page.waitForTimeout(300);
await page.locator('input[aria-label="项目名称"]').fill(LONG);
await page.locator("button", { hasText: "保存" }).first().click();
await page.waitForTimeout(300);
await page.locator('.fixed button[aria-label="关闭"]').first().click();
await page.waitForTimeout(400);

// 在项目里加一条任务
await page.locator("aside button.nav-item", { hasText: LONG }).first().click();
await page.waitForTimeout(400);
await page.locator('input[placeholder*="随手加一条"]').fill("长名称测试任务");
await page.locator('input[placeholder*="随手加一条"]').press("Enter");
await page.waitForTimeout(400);

// 检查「项目/标签」列与「截止」列不重叠
const row = page.locator(".list-row", { hasText: "长名称测试任务" }).first();
const geo = await row.evaluate((el) => {
  const kids = [...el.children].map((child) => {
    const box = child.getBoundingClientRect();
    return { left: box.left, right: box.right, width: box.width };
  });
  const chip = el.querySelector(".col-tags .chip");
  const chipBox = chip?.getBoundingClientRect();
  return {
    tagsRight: kids[4]?.right ?? 0,
    dueLeft: kids[5]?.left ?? 0,
    chipRight: chipBox?.right ?? 0,
    rowRight: el.getBoundingClientRect().right
  };
});
out.noColumnOverlap = geo.tagsRight <= geo.dueLeft + 1;
out.chipInsideColumn = geo.chipRight <= geo.tagsRight + 1;
out.geo = geo;

// 侧栏拖拽
const aside = page.locator("aside").first();
out.sidebarBefore = Math.round((await aside.boundingBox()).width);
const handle = await page.locator(".resizer").boundingBox();
if (handle) {
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 200);
  await page.mouse.down();
  for (let i = 1; i <= 8; i += 1) {
    await page.mouse.move(handle.x + handle.width / 2 + i * 10, handle.y + 200);
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
}
await page.waitForTimeout(300);
out.sidebarAfter = Math.round((await aside.boundingBox()).width);

await page.reload({ waitUntil: "load" });
await page.waitForTimeout(900);
out.sidebarAfterReload = Math.round((await page.locator("aside").first().boundingBox()).width);

out.consoleErrors = errors;
console.log(JSON.stringify(out, null, 2));
await browser.close();
