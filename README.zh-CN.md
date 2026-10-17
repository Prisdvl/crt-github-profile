# CRT GitHub Profile

[English](README.md) | **简体中文**

> 可配置、本地生成的 CRT 风格 GitHub 个人资料，输出可复用的 SVG。

<p align="center">
  <picture>
    <source media="(prefers-reduced-motion: reduce)" srcset="assets/terminal-static-enhanced.svg">
    <img src="assets/terminal-enhanced.svg" alt="由本模板生成的 CRT 终端风格 GitHub 个人资料" width="1000">
  </picture>
</p>

[![Node.js >=22](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Refresh assets](https://github.com/Prisdvl/crt-github-profile/actions/workflows/refresh-profile.yml/badge.svg)](https://github.com/Prisdvl/crt-github-profile/actions/workflows/refresh-profile.yml)

本仓库既是一份可直接使用的个人资料示例，也是一台可复用的生成器。编辑一个 JSON 文件、运行一条命令，即可得到终端个人资料、ASCII 肖像、项目卡片、贡献热力图和一份可直接发布的 Profile README——全部在你的本机渲染，无需托管服务，无需注册账号。

## 为什么选择 CRT GitHub Profile

- **配置驱动。** `profile.config.json` 是身份、技能、项目、主题和终端内容的唯一数据源——常规定制无需改动任何 JavaScript。
- **一条命令。** `npm run generate` 会先校验配置，再渲染全部 SVG，最后写出 Profile README。
- **输出可复用。** 生成的 README 及其引用的资源可直接放进你的 `<username>/<username>` 仓库。
- **本地优先。** 仅在拉取可选的贡献与活动数据时访问 GitHub；失败时回退到缓存或明确标注的占位图——绝不伪造贡献数。
- **动效可选。** 动画终端自带 `prefers-reduced-motion` 静态变体，由浏览器自动选择。
- **依赖钉死。** `svg-terminal` 渲染器在 `devDependencies` 中钉死版本；不存在远程构建服务。

## 快速开始

前置条件：**Node.js 22 或更高版本**（`node -v`）与 npm。首次 `npm install` 需要访问 npm registry，之后生成全程在本机完成。

1. **创建你的副本。**[使用此模板](https://github.com/Prisdvl/crt-github-profile/generate)（新建个人资料推荐）或 [Fork 本仓库](https://github.com/Prisdvl/crt-github-profile/fork)。两者区别见「使用模板还是 Fork」一节。
2. **编辑 [`profile.config.json`](./profile.config.json)。** 至少修改 `username`，并把自带的身份、技能、项目和 `terminal` 内容替换为你自己的。
3. **安装并校验。**

   ```bash
   npm install
   npm run validate:config
   ```

4. **生成。**

   ```bash
   npm run generate
   ```

5. **发布。** 把生成的文件复制进你的个人资料仓库——详见「发布到你的 GitHub 个人资料」一节。

## 使用模板还是 Fork

- **使用此模板**（推荐）：创建一个完全独立的仓库，历史记录干净；上游变更不会影响你，你的个人资料也不依附于 fork 网络。
- **Fork**：创建一个可拉取上游更新的关联副本。仅当你希望跟随本仓库的更新时才选它。

两种方式的后续步骤完全相同。

## 生成产物

`npm run generate` 会写出：

| 产物 | 说明 |
| --- | --- |
| `assets/terminal-enhanced.svg` | 动画 CRT 终端：身份面板、ASCII 肖像、技能、项目与贡献区块合为一个窗口。 |
| `assets/terminal-static-enhanced.svg` | 供 `prefers-reduced-motion` 使用的静态变体。 |
| `assets/ascii-portrait.svg` | 独立的 ASCII 肖像卡片。 |
| `assets/projects.svg` | 独立的项目卡片。 |
| `assets/contribution.svg` | 终端风格的贡献热力图（仅在 `options.contributionHeatmap` 开启时生成）。 |
| `dist/PROFILE-README.md` | 待发布的 Profile README。 |

两张独立卡片（`ascii-portrait.svg`、`projects.svg`）只是便利产物，Profile README 并不引用它们。关闭某个选项（`animatedTerminal`、`contributionHeatmap`）会跳过对应产物及其引用；已生成的旧文件会保留在原位。旧的 `npm run build:all` 入口仍是完整兼容构建，可重新生成两个可选产物。

## 发布到你的 GitHub 个人资料

1. 如果还没有，先创建一个与 `<username>`（你的 GitHub 用户名）完全同名的公开仓库并初始化 README——那就是你的个人资料仓库。
2. 把 `dist/PROFILE-README.md` 复制到该仓库根目录，改名为 `README.md`。
3. 复制它引用的资源，并保持 `assets/` 目录与之同级：
   - 默认（`options.readmeStyle: "svg-only"`）：`assets/terminal-enhanced.svg`——若 `animatedTerminal` 为 `false` 则为 `assets/terminal-static-enhanced.svg`。
   - `options.readmeStyle: "full"`：额外复制 `assets/terminal-static-enhanced.svg`，热力图开启时再加 `assets/contribution.svg`。
4. 提交并推送该仓库。

本仓库根目录的 `README.md` 是项目介绍，不会被生成器覆盖。

可选：发布前用浏览器打开 `preview-crt.html`，在本地预览全部生成产物——包括约 420px 窄宽度下的渲染效果。

## 保持个人资料最新

已发布的个人资料是静态的：贡献数据和最近提交行在生成时就被固化进 SVG。有两种刷新方式。

### 方案 A —— 生成器独立放置（默认）

在本机重新生成，并重新复制发生变化的文件：

```bash
npm run generate
```

然后把 `dist/PROFILE-README.md` 及其引用的资源（清单同「发布到你的 GitHub 个人资料」一节）复制进个人资料仓库并提交。只有内容发生变化的文件需要重新复制。

### 方案 B —— 自包含个人资料仓库（自动化）

把生成器放进个人资料仓库，让 GitHub Actions 按计划、以及在你推送配置修改时自动重新生成一切。生成器所需的全部文件都会随副本一起迁移：`profile.config.json`、`terminal.yml`、`scripts/`、`templates/`、`assets/ascii-art.txt`，以及 `package.json` 与 `package-lock.json`（`npm ci` 会据此拉取钉死的 `svg-terminal`）。不需要额外服务、Secret 或运行时依赖——公开贡献数据无需鉴权即可获取，workflow 里的 `GITHUB_TOKEN` 由 GitHub 自动供给，仅用于提升限额。代价是：个人资料仓库会公开包含生成器代码。

1. 创建你的个人资料仓库（与 `<username>` 完全同名、公开、**不要**初始化 README），然后把本仓库的一份副本推进去：

   ```bash
   git clone https://github.com/Prisdvl/crt-github-profile.git <username>
   cd <username>
   git remote set-url origin https://github.com/<username>/<username>.git
   git push -u origin main
   ```

2. 编辑 `profile.config.json`（至少改 `username`），然后首次构建并发布：

   ```bash
   npm install
   npm run generate
   cp dist/PROFILE-README.md README.md
   git add -A
   git commit -m "Initial CRT profile"
   git push
   ```

3. 用下面的内容**替换** `.github/workflows/refresh-profile.yml`（它随副本从本仓库复制而来，但只负责刷新本仓库的演示资产），让个人资料自身被重新生成并发布：

   ```yaml
   name: Refresh profile
   on:
     workflow_dispatch:
     push:
       branches: [main]
     schedule:
       - cron: "17 3 * * 1"
   permissions:
     contents: write
   jobs:
     refresh:
       runs-on: ubuntu-latest
       if: github.event_name != 'push' || github.actor != 'github-actions[bot]'
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: "22"
             cache: npm
         - run: npm ci
         - run: npm run validate:config
         - name: Generate profile
           env:
             # Public contribution HTML works without auth; the token only
             # improves rate limits. Never echo the token.
             GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
           run: npm run generate
         - run: cp dist/PROFILE-README.md README.md
         - name: Commit if changed
           run: |
             git config user.name "github-actions[bot]"
             git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
             git add README.md assets/*.svg
             if git diff --cached --quiet; then
               echo "No changes"
               exit 0
             fi
             git commit -m "chore: refresh profile [skip ci]"
             git push
   ```

   该 workflow 会在每周一、每次向 `main` 推送配置修改时、以及你从 Actions 页面手动触发（`workflow_dispatch`）时重新生成个人资料，然后提交更新后的 `README.md` 与 SVG 资源。actor 守卫与 `[skip ci]` 可防止机器人自己的提交再次触发它。删除该 workflow 文件即可停止自动化——手动方案 A 始终可用。

## 配置说明

下面是一个使用现有字段的紧凑示例——theme 颜色逐项合并，而 `skills` 与 `projects` 会整表替换：

```json
{
  "theme": { "accent": "#ff5500", "background": "#101820" },
  "skills": [{ "name": "Rust", "level": 65 }],
  "projects": [
    {
      "name": "your-project",
      "stack": "Rust / Tauri",
      "description": "A concise project description",
      "url": "https://github.com/your-github-handle/your-project"
    }
  ],
  "options": {
    "animatedTerminal": false,
    "readmeStyle": "full"
  }
}
```

编辑后运行 `npm run validate:config`——它只校验文件，不生成任何资源。

`profile.config.json` 支持以下字段：

| 字段 | 说明 |
| --- | --- |
| `username` | GitHub 用户名，用于终端、链接与贡献数据拉取。 |
| `displayName` | 显示在标题、说明和生成 README 中的名字（默认取 `username`）。 |
| `headline` | 简短的技术定位行。 |
| `timezone` | 终端中显示的 IANA 时区（默认为 `UTC`）。 |
| `bio` | 显示在终端和 Profile README 中的简短简介。 |
| `availability` | 状态行，如 `Open to collaboration`。 |
| `theme` | `background`、`surface`、`text`、`muted`、`accent` 颜色，以及可选的 `heatmap`（恰好 5 个颜色，对应 0-4 级）。 |
| `skills` | `{ "name": "...", "level": 0-100 }` 数组。 |
| `projects` | 项目数组，每项含 `name`、`stack`、`description` 和 HTTP(S) `url`（至少一个）。 |
| `terminal` | 可选的身份面板行：`focus`、`runtime`、`async`、`topics`、`now`、`status`，以及 `interests` 与 `highlights`。省略的字段会渲染为 `not configured` 等中性占位——请编辑自带的整个代码块，而不是删除它。 |
| `options.animatedTerminal` | 是否生成并引用动画终端产物。 |
| `options.contributionHeatmap` | 是否生成并引用贡献热力图。 |
| `options.readmeStyle` | `full`（默认）或 `svg-only`——后者只在 Profile README 中输出配置的终端 SVG。 |

缺少 `username`、颜色格式错误、URL 无效、技能等级越界、时区非法、项目列表为空，都会以字段级错误被拒绝。`terminal.yml` 是视觉布局模板；`npm run generate` 会基于 `profile.config.json` 将其解析为 `.tmp/terminal.generated.yml`，因此常规定制不需要改动 JavaScript。

## GitHub 数据（可选）

贡献与活动数据来自 GitHub 的公开页面：`username` 的贡献日历 HTML，以及用于最近提交行的公开 events API。两者都会缓存在 `assets/` 下。请求失败时，生成器会使用上次缓存文件，或写出明确标注的占位图；绝不伪造实时贡献数。可设置 `GITHUB_TOKEN` 或 `GH_TOKEN` 提升活动请求的限额。

要直接从贡献生成器强制输出占位图：

```bash
node scripts/generate-contribution.mjs --placeholder
```

本仓库还包含一个可选的 GitHub Actions workflow（`.github/workflows/refresh-profile.yml`），每周重新生成这些资产并提交变更。保留它可自动刷新本仓库的资产，也可以删除该文件——它不会推送到你的个人资料仓库。要自动化你自己的个人资料，请见「保持个人资料最新」一节。

## 故障排查

| 现象 | 原因与解决 |
| --- | --- |
| `svg-terminal is not installed` | 依赖缺失。运行 `npm install` 后重试 `npm run generate`。 |
| `Configuration file not found` | 请在仓库根目录下运行命令，或检查文件名（`profile.config.json`）。 |
| 字段级错误，如 `theme.accent: must be a hex color` | 配置校验失败。修正指定字段；`npm run validate:config` 可免生成复检。 |
| `contrib fetch failed` / `Using cached contribution days` | GitHub 不可达（离线或网络受限）。已使用缓存数据或标注占位图；联网后重跑即可。 |
| 已发布的个人资料看起来过期（贡献数据旧） | 已发布的 SVG 是静态快照。重新生成并重新发布——见「保持个人资料最新」一节。 |
| 输出仍显示模板作者的数据 | 编辑 `profile.config.json`——身份、技能、项目和整个 `terminal` 代码块——然后重新生成。 |

## 贡献

欢迎在 [仓库](https://github.com/Prisdvl/crt-github-profile/issues) 中提交 issue 和 pull request。如果改动涉及生成行为，提交 PR 前请先运行 `npm run validate:config` 和 `npm run generate`。

## 许可证

基于 [MIT License](./LICENSE) 发布。
