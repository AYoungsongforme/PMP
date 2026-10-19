# 部署到 GitHub Pages（阶段 0）

目标：让手机、平板、任何电脑打开一个网址就能看到你的项目（只读）。

> 这一步只打通链路，站点里现在是示例数据。真实数据的「发布 + 加密」在阶段 1。

## 一、建仓库

1. 打开 https://github.com/new
2. 仓库名随意，比如 `pmp`
3. 可见性选 **Public**（免费的 GitHub Pages 只支持公开仓库）
4. **不要**勾选 "Add a README file"
5. 点 Create repository

## 二、把本地代码推上去

在项目目录（`E:\codex project\PMP`）打开 PowerShell，按顺序执行。把 `<用户名>` 和 `<仓库名>` 换成你自己的：

```powershell
git config user.name "你的名字"
git config user.email "你的邮箱"

git add .
git commit -m "初始提交"
git branch -M main
git remote add origin https://github.com/<用户名>/<仓库名>.git
git push -u origin main
```

第一次 push 会弹出浏览器让你登录 GitHub，登录一次即可。

## 三、开启 Pages

1. 进入仓库的 **Settings → Pages**
2. **Build and deployment → Source** 选择 **GitHub Actions**
3. 回到仓库的 **Actions** 标签，等「部署只读站点」跑完（约 1–2 分钟）

## 四、访问

地址是：

```
https://<用户名>.github.io/<仓库名>/
```

手机浏览器打开这个网址就能看。想加在主屏幕上，iPhone 用 Safari 的「共享 → 添加到主屏幕」。

## 五、日常发布（加密）

代码推送过一次之后，日常更新只走这三步：

1. 本地打开 http://localhost:5180 ，点顶栏的 **发布**
2. 设一个密码（至少 8 位，建议一句话），确认后再点 **加密并写入文件**
   - 第一次会让你选保存位置，选 `E:\codex project\PMP\public\data\published.json`
   - 选过一次之后会记住，下次直接写
3. 回到项目文件夹，双击 **`发布.cmd`**

等 Actions 跑完（约 1 分钟），手机上刷新并输入同一个密码即可。

如果浏览器不支持直接写文件，对话框里还有 **下载 JSON**，把文件手动放到 `public\data\published.json` 也一样。

> 密码只在你的设备上使用，仓库里只有密文。**忘记密码无法找回**，手机端也解不开已发布的内容。

## 常见问题

| 现象 | 原因 |
| --- | --- |
| Actions 报 `ERR_PNPM_IGNORED_BUILDS` | 仓库里少了 `pnpm-workspace.yaml`，检查它是否被提交 |
| 页面 404 | Pages 的 Source 还没选 GitHub Actions，或 Actions 还没跑完 |
| 页面空白、控制台报 `published.json 404` | `public/data/published.json` 没提交 |
| 手机打开是旧内容 | 浏览器缓存，下拉刷新或等一分钟 |
| 手机打开要求输入密码 | 正常，输入发布时设的密码 |
| 提示「密码不对」 | 和发布时用的不是同一个；在电脑上重新发布一次并设新密码 |

## 关于公开

仓库是公开的，所以源码和文件任何人都能下载。但 `public/data/published.json` 现在是**加密后的密文**，没有密码读不出内容。仓库里现有的示例文件只是占位数据，你第一次发布后就会被覆盖。
