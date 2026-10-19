/**
 * 提交并推送加密后的发布文件。
 * 由 发布.cmd 调用；中文输出放在这里，避免批处理文件的编码问题。
 */
import { spawnSync } from "node:child_process";

function git(args, options = {}) {
  const result = spawnSync("git", args, { encoding: "utf8", ...options });
  if (result.error) {
    console.error("找不到 git 命令，请确认 Git 已安装并加入 PATH。");
    console.error(String(result.error.message));
    process.exit(1);
  }
  return result;
}

const inside = git(["rev-parse", "--is-inside-work-tree"], { stdio: "ignore" });
if (inside.status !== 0) {
  console.error("当前目录不是一个 git 仓库。");
  process.exit(1);
}

const add = git(["add", "public/data/published.json"], { stdio: "inherit" });
if (add.status !== 0) {
  console.error("");
  console.error("添加发布文件失败。");
  process.exit(1);
}

const diff = git(["diff", "--cached", "--quiet"], { stdio: "ignore" });
if (diff.status === 0) {
  console.log("");
  console.log("  发布文件没有变化，跳过。");
  console.log("");
  process.exit(0);
}

console.log("");
console.log("  正在提交并推送到 GitHub...");
console.log("");

const commit = git(["commit", "-m", "发布数据更新"], { stdio: "inherit" });
if (commit.status !== 0) {
  console.error("");
  console.error("提交失败，请把上面的报错发给我。");
  process.exit(1);
}

const push = git(["push"], { stdio: "inherit" });
if (push.status !== 0) {
  console.error("");
  console.error("推送失败，请把上面的报错发给我。");
  process.exit(1);
}

console.log("");
console.log("  已推送。GitHub Actions 大约 1 分钟后完成部署。");
console.log("");
