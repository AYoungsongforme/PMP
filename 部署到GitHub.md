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

## 五、以后怎么更新

改完数据后：

```powershell
git add .
git commit -m "更新数据"
git push
```

等 Actions 跑完，手机上刷新即可。

## 常见问题

| 现象 | 原因 |
| --- | --- |
| Actions 报 `ERR_PNPM_IGNORED_BUILDS` | 仓库里少了 `pnpm-workspace.yaml`，检查它是否被提交 |
| 页面 404 | Pages 的 Source 还没选 GitHub Actions，或 Actions 还没跑完 |
| 页面空白、控制台报 `published.json 404` | `public/data/published.json` 没提交 |
| 手机打开是旧内容 | 浏览器缓存，下拉刷新或等一分钟 |

## 关于公开

仓库是公开的，所以 `public/data/published.json` 里的内容任何人都能下载。阶段 1 会把它换成加密后的密文，只有输入密码才能看。
