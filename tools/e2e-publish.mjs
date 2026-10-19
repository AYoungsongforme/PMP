// 端到端：打开发布对话框 → 加密 → 下载 JSON → 用独立实现解回来验证。
// 用法：node tools/e2e-publish.mjs http://localhost:5181/ <输出路径>
import { chromium } from "file:///C:/Users/MR/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
import fs from "node:fs";

const URL = process.argv[2] ?? "http://localhost:5181/";
const OUT = process.argv[3] ?? "published-test.json";
const PASS = "correct horse battery staple";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: "light", acceptDownloads: true });

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("favicon")) errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(URL, { waitUntil: "load" });
await page.waitForTimeout(900);

await page.locator("header button", { hasText: "发布" }).click();
await page.waitForTimeout(300);

const passwords = page.locator('.fixed input[type="password"]');
const passwordFields = await passwords.count();
await passwords.nth(0).fill(PASS);
await passwords.nth(1).fill(PASS);

const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.locator("button", { hasText: "下载 JSON" }).click()
]);
await download.saveAs(OUT);
await page.waitForTimeout(400);

const doneVisible = (await page.locator("text=已生成加密文件").count()) > 0;

// 独立实现一遍解密，确认密文格式可被外部还原
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

let wrongPasswordRejected = false;
try {
  const badKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: Buffer.from(envelope.salt, "base64"), iterations: envelope.iterations, hash: "SHA-256" },
    await crypto.subtle.importKey("raw", encoder.encode("wrong password"), "PBKDF2", false, ["deriveKey"]),
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: Buffer.from(envelope.iv, "base64") },
    badKey,
    Buffer.from(envelope.data, "base64")
  );
} catch {
  wrongPasswordRejected = true;
}

console.log(
  JSON.stringify(
    {
      passwordFields,
      doneVisible,
      alg: envelope.alg,
      iterations: envelope.iterations,
      ciphertextLooksRandom: !/需求|产品改版/.test(JSON.stringify(envelope)),
      projects: payload.projects?.length,
      tasks: payload.tasks?.length,
      firstTask: payload.tasks?.[0]?.title,
      wrongPasswordRejected,
      consoleErrors: errors
    },
    null,
    2
  )
);

await browser.close();
