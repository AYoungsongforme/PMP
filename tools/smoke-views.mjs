// 看板 / 时间轴 的交互冒烟测试。
// 用法：vite preview --port 5181 之后 node tools/smoke-views.mjs http://localhost:5181/
import { chromium } from "file:///C:/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const URL = process.argv[2] ?? "http://localhost:5181/";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const DAY_WIDTH = 30; // 时间轴默认「两周」缩放

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("favicon")) errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

const out = {};

const label = () => page.locator("button.flex.w-full.items-center.gap-2");
const bars = () => page.locator("div.absolute.flex.items-center.rounded");
const drawer = () => page.locator(".fixed").first();
const column = (name) => page.locator("div.flex.w-\\[248px\\]", { hasText: name });

async function goTo(view) {
  await page.locator("header .seg-item", { hasText: view }).click();
  await page.waitForTimeout(350);
}

async function indexOfTitle(title) {
  return label().evaluateAll((els, wanted) => els.findIndex((el) => (el.textContent ?? "").trim() === wanted), title);
}

async function dragBy(from, dx, dy, steps = 12) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(from.x + (dx * i) / steps, from.y + (dy * i) / steps);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(400);
}

async function openByTitle(title) {
  if ((await page.locator(".fixed").count()) > 0) await closeDrawer();
  const index = await indexOfTitle(title);
  if (index < 0) return { index, start: "", due: "" };
  await label().nth(index).click();
  await page.waitForTimeout(300);
  const start = await drawer().locator('input[type="date"]').nth(0).inputValue();
  const due = await drawer().locator('input[type="date"]').nth(1).inputValue();
  return { index, start, due };
}

async function closeDrawer() {
  await drawer().locator('button[aria-label="关闭"]').first().click();
  await page.waitForTimeout(250);
}

await page.goto(URL, { waitUntil: "load" });
await page.waitForTimeout(900);

// ---------- 看板：拖拽改状态 ----------
await goTo("看板");
out.boardColumns = (await page.locator("div.flex.w-\\[248px\\] > div:first-child").allInnerTexts()).map((t) =>
  t.replace(/\n/g, " ")
);

const firstTodoCard = column("即将开始").locator("span.text-\\[13px\\]").first();
out.boardSubject = await firstTodoCard.innerText();
const cardBox = await firstTodoCard.boundingBox();
const dropZone = await column("进行中").locator("div.rounded-lg").first().boundingBox();
const doingBefore = await column("进行中").locator("span.text-\\[13px\\]").count();

if (cardBox && dropZone) {
  await dragBy(
    { x: cardBox.x + cardBox.width / 2, y: cardBox.y + cardBox.height / 2 },
    dropZone.x + dropZone.width / 2 - (cardBox.x + cardBox.width / 2),
    dropZone.y + 40 - (cardBox.y + cardBox.height / 2)
  );
}
const doingAfter = await column("进行中").locator("span.text-\\[13px\\]").count();
out.boardMoved = doingAfter === doingBefore + 1;

// ---------- 时间轴：拖动改期 ----------
await goTo("时间轴");
out.timelineBars = await bars().count();

const MOVE_TITLE = "梳理 v2.0 需求范围";
const before = await openByTitle(MOVE_TITLE);
out.moveBefore = { index: before.index, start: before.start, due: before.due };
await closeDrawer();

const moveBox = await bars().nth(before.index).boundingBox();
if (moveBox) {
  await dragBy({ x: moveBox.x + moveBox.width / 2, y: moveBox.y + moveBox.height / 2 }, DAY_WIDTH * 2, 0);
}
const after = await openByTitle(MOVE_TITLE);
out.moveAfter = { start: after.start, due: after.due };
out.moveShiftedBothDates =
  Boolean(before.start && before.due && after.start && after.due) &&
  new Date(after.start).getTime() - new Date(before.start).getTime() === 2 * 86_400_000 &&
  new Date(after.due).getTime() - new Date(before.due).getTime() === 2 * 86_400_000;

// ---------- 时间轴：拖左端改工期 ----------
await closeDrawer();
const resizeIndex = await indexOfTitle(MOVE_TITLE);
const resizeBox = await bars().nth(resizeIndex).boundingBox();
if (resizeBox) {
  await dragBy({ x: resizeBox.x + 3, y: resizeBox.y + resizeBox.height / 2 }, -DAY_WIDTH, 0);
}
const resized = await openByTitle(MOVE_TITLE);
out.resizeAfter = { start: resized.start, due: resized.due };
out.resizeKeptDue = resized.due === after.due;
out.resizeMovedStart =
  Boolean(resized.start && after.start) &&
  new Date(after.start).getTime() - new Date(resized.start).getTime() === 86_400_000;

// ---------- 依赖 ----------
const depSubject = await openByTitle("竞品交互对比");
out.depSubject = { index: depSubject.index, start: depSubject.start, due: depSubject.due };
const depSelect = drawer().locator("select.input").filter({ hasText: "添加前置任务" });
out.depOptions = await depSelect.locator("option").count();
await depSelect.selectOption({ label: MOVE_TITLE });
await page.waitForTimeout(300);
out.blockerRows = await drawer().locator(".pill").count();
await closeDrawer();

out.depLines = await page.locator("svg path[marker-end]").count();
out.svgCount = await page.locator("svg").count();
out.svgPathCount = await page.locator("svg path").count();

await page.reload({ waitUntil: "load" });
await page.waitForTimeout(900);
await goTo("时间轴");
out.depLinesAfterReload = await page.locator("svg path[marker-end]").count();
out.barsAfterReload = await bars().count();
const reopened = await openByTitle("竞品交互对比");
out.blockerRowsAfterReload = await drawer().locator(".pill").count();
out.depSubjectAfterReload = reopened.index >= 0;

out.consoleErrors = errors;
console.log(JSON.stringify(out, null, 2));
await browser.close();
