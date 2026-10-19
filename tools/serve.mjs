/**
 * 零依赖的本地静态服务器，把 dist/ 跑在 http://localhost:5180。
 * 用本地服务而不是直接双击 html，是因为 file:// 下浏览器会禁用 IndexedDB 和桌面通知。
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const distDir = join(projectRoot, "dist");
const port = Number(process.env.PMP_PORT ?? 5180);
const url = `http://localhost:${port}/`;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8"
};

function openBrowser(target) {
  if (process.env.PMP_NO_OPEN === "1") return;
  try {
    if (process.platform === "win32") {
      spawn("cmd", ["/c", "start", "", target], { detached: true, stdio: "ignore" }).unref();
    } else if (process.platform === "darwin") {
      spawn("open", [target], { detached: true, stdio: "ignore" }).unref();
    } else {
      spawn("xdg-open", [target], { detached: true, stdio: "ignore" }).unref();
    }
  } catch {
    // 打不开浏览器就算了，用户自己点链接
  }
}

function resolvePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]);
  const target = normalize(join(distDir, clean));
  if (!target.startsWith(distDir + sep) && target !== distDir) return null;
  return target;
}

async function handle(request, response) {
  let filePath = resolvePath(request.url ?? "/");
  if (filePath === null) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = join(filePath, "index.html");
  } catch {
    // 单页应用：找不到的路径一律回落到 index.html
    filePath = join(distDir, "index.html");
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    response.end(body);
  } catch {
    response.writeHead(404).end("Not found");
  }
}

function banner() {
  console.log("");
  console.log("  项目工作台已启动");
  console.log(`  地址：${url}`);
  console.log("");
  console.log("  数据存在这个浏览器里，所以请一直用这个地址打开，别换端口或浏览器。");
  console.log("  这个窗口不要关，关掉服务就停了。用完按 Ctrl+C 退出。");
  console.log("");
  openBrowser(url);
}

/**
 * localhost 在 Windows 上通常先解析到 IPv6 的 ::1，再回退到 IPv4。
 * 只监听 127.0.0.1 的话，浏览器可能直接报「拒绝连接」，所以两个协议族都要听。
 */
const hosts = ["127.0.0.1", "::1"];
const servers = hosts.map(() => createServer(handle));
let started = 0;
let failed = 0;
let alreadyRunning = false;

servers.forEach((server, index) => {
  const host = hosts[index];

  server.once("error", (error) => {
    failed += 1;
    if (error.code === "EADDRINUSE") alreadyRunning = true;
    // 有些系统没有 IPv6，这种失败可以忽略，只要还有一个在听就行
    const tolerable = error.code === "EAFNOSUPPORT" || error.code === "EADDRNOTAVAIL";
    if (!tolerable && !alreadyRunning) {
      console.error(`监听 ${host} 失败：`, error.message);
    }

    if (alreadyRunning) {
      for (const item of servers) item.close();
      console.log(`端口 ${port} 已经在监听，说明应用正在运行，直接打开浏览器。`);
      openBrowser(url);
      process.exit(0);
    }
    if (failed === hosts.length) {
      console.error("启动失败：两个协议族都无法监听。");
      process.exit(1);
    }
  });

  server.listen(port, host, () => {
    started += 1;
    if (started === 1) banner();
  });
});
