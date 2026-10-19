// 线上只读站的文档阅读。
// 用法：node tools/e2e-site-docs.mjs http://localhost:5182/
import { chromium } from "file:///C:/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const URL = process.argv[2] ?? "http://localhost:5182/";
const PASS = "correct horse battery staple";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: "light" });

const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

const out = {};
await page.goto(URL, { waitUntil: "load" });
await page.waitForTimeout(800);
await page.locator('input[type="password"]').fill(PASS);
await page.locator("button", { hasText: "解锁" }).click();
await page.waitForTimeout(1200);

out.unlocked = (await page.locator(".site-row").count()) > 0;
await page.locator("button.seg-item", { hasText: "文档" }).click();
await page.waitForTimeout(400);
out.docListed = (await page.locator("text=发布测试文档").count()) > 0;

await page.locator("button", { hasText: "发布测试文档" }).click();
await page.waitForTimeout(500);
out.articleText = (await page.locator(".ProseMirror").innerText()).includes("这是文档正文");
out.articleTitle = (await page.locator("article h1").innerText()).trim();

await page.locator("button", { hasText: "返回文档列表" }).click();
await page.waitForTimeout(300);
out.backToList = (await page.locator("text=发布测试文档").count()) > 0;

out.consoleErrors = errors;
console.log(JSON.stringify(out, null, 2));
await browser.close();
