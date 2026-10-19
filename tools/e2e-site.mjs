// 端到端：只读站点的解锁流程。
// 用法：node tools/e2e-site.mjs http://localhost:5182/
import { chromium } from "file:///C:/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const URL = process.argv[2] ?? "http://localhost:5182/";
const PASS = "correct horse battery staple";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: "light" });

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("favicon")) errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

const out = {};

await page.goto(URL, { waitUntil: "load" });
await page.waitForTimeout(800);
out.lockedOnLoad = (await page.locator("text=这份内容已加密").count()) > 0;
out.rowsBeforeUnlock = await page.locator(".site-row").count();

await page.locator('input[type="password"]').fill("wrong password");
await page.locator("button", { hasText: "解锁" }).click();
await page.waitForTimeout(900);
out.wrongRejected = (await page.locator("text=密码不对").count()) > 0;

await page.locator('input[type="password"]').fill(PASS);
await page.locator("button", { hasText: "解锁" }).click();
await page.waitForTimeout(1200);
out.rowsAfterUnlock = await page.locator(".site-row").count();
out.projectName = await page.locator("header .font-medium").first().innerText();
out.unlockGone = (await page.locator("text=这份内容已加密").count()) === 0;

// 记住密码后刷新应自动解锁
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(1400);
out.autoUnlockAfterReload = (await page.locator(".site-row").count()) > 0;
out.lockScreenAfterReload = (await page.locator("text=这份内容已加密").count()) > 0;

// 手机上也要能用
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: "light" });
await mobile.goto(URL, { waitUntil: "load" });
await mobile.waitForTimeout(800);
out.mobileLocked = (await mobile.locator("text=这份内容已加密").count()) > 0;
await mobile.locator('input[type="password"]').fill(PASS);
await mobile.locator("button", { hasText: "解锁" }).click();
await mobile.waitForTimeout(1200);
out.mobileRows = await mobile.locator(".site-row").count();
out.mobileSelect = await mobile.locator('select[aria-label="切换项目"]').isVisible();
await mobile.close();

out.consoleErrors = errors;
console.log(JSON.stringify(out, null, 2));
await browser.close();
