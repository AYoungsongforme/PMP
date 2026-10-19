// 发布一份带文档的数据，并解密校验文档确实进了载荷。
// 用法：node tools/e2e-docs-publish.mjs http://localhost:5181/ out.json
import { chromium } from "file:///C:/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
import fs from "node:fs";

const URL = process.argv[2] ?? "http://localhost:5181/";
const OUT = process.argv[3] ?? "docs-payload.json";
const PASS = "correct horse battery staple";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: "light", acceptDownloads: true });

const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(URL, { waitUntil: "load" });
await page.waitForTimeout(900);

await page.locator("aside button.nav-item", { hasText: "产品改版 v2.0" }).first().click();
await page.waitForTimeout(300);
await page.locator("header .seg-item", { hasText: "文档" }).click();
await page.waitForTimeout(400);
await page.locator("button", { hasText: "新建文档" }).first().click();
await page.waitForTimeout(500);
await page.locator('input[aria-label="文档标题"]').fill("发布测试文档");
await page.locator(".ProseMirror").click();
await page.keyboard.type("这是文档正文，用来验证线上阅读。");
await page.waitForTimeout(900);

await page.locator("header button", { hasText: "发布" }).click();
await page.waitForTimeout(300);
const passwords = page.locator('.fixed input[type="password"]');
await passwords.nth(0).fill(PASS);
await passwords.nth(1).fill(PASS);
const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.locator("button", { hasText: "下载 JSON" }).click()
]);
await download.saveAs(OUT);

const envelope = JSON.parse(fs.readFileSync(OUT, "utf8"));
const encoder = new TextEncoder();
const base = await crypto.subtle.importKey("raw", encoder.encode(PASS), "PBKDF2", false, ["deriveKey"]);
const key = await crypto.subtle.deriveKey(
  { name: "PBKDF2", salt: Buffer.from(envelope.salt, "base64"), iterations: envelope.iterations, hash: "SHA-256" },
  base,
  { name: "AES-GCM", length: 256 },
  false,
  ["decrypt"]
);
const plain = await crypto.subtle.decrypt(
  { name: "AES-GCM", iv: Buffer.from(envelope.iv, "base64") },
  key,
  Buffer.from(envelope.data, "base64")
);
const payload = JSON.parse(new TextDecoder().decode(plain));

console.log(
  JSON.stringify(
    {
      docs: payload.docs?.length ?? 0,
      docTitle: payload.docs?.[0]?.title,
      docHasText: (payload.docs?.[0]?.content ?? "").includes("这是文档正文"),
      consoleErrors: errors
    },
    null,
    2
  )
);

await browser.close();
