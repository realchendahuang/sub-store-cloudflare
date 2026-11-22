# 交接文档（2026-10-31）

这份文档写给接手 Sub-Store Cloudflare 后续优化的人。先读第 1、2 节：本机有一批**还没提交的前端改动**，换一台机器拉代码是看不到的。

## 1. 现状一览

| 项 | 状态 |
| --- | --- |
| 线上版本 | `origin/main` 的 `4673e19`，Worker 已部署，线上 HTTP 验证通过 |
| 后端修复 | 已完成、已上线、有回归测试 |
| 回归测试 | 72 个用例，`pnpm run check:tests` 全部通过 |
| 真实客户端校验 | 线上三个 collection 和一份人工样例，`mihomo -t`（1.19.33）和 `sing-box check`（1.14.4）都通过；只校验格式，没有实际连接节点 |
| 前端打磨 | **做了一半，没提交、没部署、没目测验证**，见第 3 节 |

最近的提交：

```text
4673e19 test(worker): 为解析、输出、鉴权和存储修复补回归测试
29fb746 chore: 同步 lockfile，deploy 先构建前端，文档改用 #token= 和 ESM 命令
cea4996 feat(frontend): token 流程、初始化与打包优化
1efe3aa fix(worker): 修正订阅解析与输出，收紧下载和管理鉴权
```

## 2. 先做这件事：处理未提交的前端改动

一个子任务在执行前端打磨时被中途取消，留下 20 个文件的改动（约 +860/-390 行），只存在于原机器的工作区：

```bash
git status --short          # 查看改动
git diff --stat
```

已确认的情况：

- `pnpm --dir frontend run check:locales` 通过。
- `pnpm run build:frontend`（包含 `vue-tsc`）通过。
- `pnpm run check:open-source` **不通过**：WIP 改完后 `frontend/src/assets/icons/clash.png` 不再被引用。提交前要么删掉这个文件，要么确认它应该在哪里被使用。
- **没有在浏览器里看过效果**，第 3 节每一项都需要逐个目测确认。
- 子任务启动的本地 `wrangler dev`（端口 8799）已停掉。`cloudflare/.dev.vars` 是它为本地调试创建的，已被 git 忽略。

建议二选一：

1. 在原机器上把改动提交到一个分支并推送，例如 `git switch -c wip/frontend-polish && git add frontend && git commit -m "wip: 前端打磨（未验证）" && git push -u origin wip/frontend-polish`，接手的人从这个分支继续。
2. 放弃这批改动，按第 3 节清单从头做：`git restore frontend && git clean -fd frontend/src/utils`（会删掉未跟踪的 `formatDateTime.ts`，执行前先确认）。

## 3. 前端打磨清单

来源：在线上后台用桌面（1440×900）和手机（390×844）两种尺寸走查时发现的问题。“WIP 状态”指第 2 节未提交改动里的进度，全部未经目测。

| # | 问题 | WIP 状态 | 涉及文件 |
| --- | --- | --- | --- |
| 1 | 侧栏和底部导航的“工具”没有图标；桌面窄屏侧栏只显示图标时，这一格是空的 | 已改 | `components/SideBar.vue`、`components/TabBar.vue`、`plugin/awesomeIcon.ts` |
| 2 | 手机底部导航文字被截掉一半，没有留底部安全区 | 已改 | `components/TabBar.vue`、`layout/AppLayout.vue`；`index.html` 已有 `viewport-fit=cover` |
| 3 | 每次进页面都弹“Refresh Completed”，手机上盖住顶部栏 | 已改：只有 NavBar 和 Sub 页的手动刷新传 `needNotify=true` | `App.vue`、`utils/initApp.ts` |
| 4 | 卡片“更多操作”在桌面上滑开后只露出一个复制按钮，克隆/打开链接/删除被挤出可见区域，卡片左侧图标也被裁掉 | 已改（+203 行），**重点验证** | `components/SubListItem.vue` |
| 5 | 设置页的应用图标是 Node.js logo（上游遗留） | 已改：删除 `assets/icons/node.svg` 和未使用的 `hooks/useBackend.ts` | `views/My.vue` |
| 6 | 工具页创建分享链接要手填资源 ID；类型选项显示原始值 `source`/`auto`；有效期输入框没有标签 | 已改 | `views/Tools.vue` |
| 7 | 回收站里分享记录显示为 `share/<uuid>`，日期格式不统一 | 已改：新增 `utils/formatDateTime.ts` | `views/Tools.vue` |
| 8 | 设置页“备份与恢复”分成两处；“请求设置”只能看不能改 | 已改：新增并发数、超时、UA、缓存 TTL、`subrequestLimit` 等表单 | `views/My.vue`、`store/settings.ts`、`types/store/settings.d.ts` |
| 9 | 桌面宽屏内容区固定约 880px，两侧大片空白 | 部分：加了 `limitContentWidth` 路由元信息和样式变量 | `assets/styles/*.scss`、`router/index.ts`、`App.vue` |
| 10 | 文案生硬，例如标签字段提示 “Click on the right icon, The tag(s)…”，工具页标题 “Compatibility Tools” | 部分 | `locales/zh.ts`、`locales/en.ts` |
| 11 | 默认语言应为：已保存的选择 > 浏览器语言是中文时用中文 > 英文 | 已改 | `locales/languages.ts` |

需要特别留意：

- 第 11 项改了兜底语言。原来 `DEFAULT_LOCALE` 是 `zh`，非中文浏览器也会落到中文；现在非中文浏览器默认英文。如果目标用户主要说中文，可以把兜底改回 `zh`。
- 第 8 项提交前要核对 `cloudflare/src/routes/api.ts` 的 `PATCH /settings`：只有 `backendRequestConcurrency` 会被校验并限制到 1~6，其他键原样合并保存。前端的校验范围要和后端运行时的限制一致，见 `cloudflare/src/lib/subscription.ts` 里的 `getRequestTimeout`、`numberSetting` 等。
- 第 4 项是唯一改动较大的交互，桌面和手机都要试：点“···”、手机上左滑、每个操作都点一遍。

验证方法：线上部署前，在本地起 Worker 截图对比。

```bash
pnpm run build:frontend
pnpm --dir cloudflare exec wrangler d1 migrations apply DB --local --config wrangler.jsonc
pnpm --dir cloudflare exec wrangler dev --config wrangler.jsonc --local --port 8799
# 打开 http://localhost:8799/#token=<cloudflare/.dev.vars 里的管理 token>
```

走查过的页面：订阅列表（`/subs`）、卡片更多操作、collection 编辑页（`/edit/collections/<id>`，含“内容”和“操作”两个标签）、工具页（`/tools`）、设置页（`/my`）。

## 4. 已完成并上线的工作（供参考）

### 后端（`1efe3aa`，测试在 `4673e19`）

- **订阅解析**
  - base64、vmess、ss 统一按 UTF-8 解码，修复中文名乱码。
  - vless/trojan 支持 ws/grpc/h2/httpupgrade 传输参数。
  - ss 支持 SIP002 插件和 IPv6，hysteria2 支持端口跳跃。
  - 远程源里残留的 `content` 不再导致它被当成本地源。
- **输出**
  - sing-box 改用 `transport` 字段和 1.11+ 的 `sniff` 路由动作，去掉了 `block` 出站。
  - `Content-Disposition` 改用 `filename*`；非 Latin-1 的响应头直接丢弃，不再导致 500。
- **安全**
  - 分享 token 不能使用 `?url=`、`?content=`、`?ua=`、`?refresh=`。
  - 管理 API 不再接受 `?token=`，错误日志里的 token 会被脱敏。
  - 删除源或 collection 时，同时删除它的分享授权。
- **Cloudflare 适配**
  - 远程缓存保留过期条目（7 天），用于重新验证和上游失败时兜底。
  - 并发上限 6。
  - `resolve` 过滤器按主机名去重。
  - 新增可选设置 `subrequestLimit`：不填时不做应用层限制；填了之后超出会明确报错，不会被 `ignoreFailed` 吞掉。
- **存储**
  - 文本超过 1.9MB 时返回 413。
  - 回收站恢复改为原子操作。
  - 导入时，规范化后 id 冲突返回 400；旧备份里大小写或带空格的 id 仍会被规范化后导入。

### 前端（`cea4996`）

- 支持 `#token=` 登录，新增退出登录；401 时清除 token、只提示一次。
- 初始化改为并行请求，去掉假的 `refreshCache` 和 env 缓存。
- 流量请求 60 秒节流；下载链接按会话缓存。
- 使用 Vue 运行时构建、`es2020` 目标；删除未使用的文件和 NutUI 组件注册。

### 已上线的行为变化

- vless 链接缺少 `security` 时按无 TLS 处理；但带 `sni`、`fp`、`alpn`、`allowInsecure` 或 `insecure` 时仍按 TLS 处理。
- sing-box 1.10 及更早的客户端读不了新输出。
- 删除资源后，它的分享链接不会随回收站恢复。
- 管理后台链接改为 `/#token=…`，旧的 `/?token=…` 仍可使用。

## 5. 剩余待办（按优先级）

1. 完成并验证第 3 节的前端清单，然后提交、部署。
2. Loon、Surge、QX 不支持 grpc/h2 节点，目前会输出一个连不上的节点。应在 `isTargetCompatible` 里把这类节点过滤掉。
3. 回收站恢复源或 collection 时，一起恢复它的分享授权（需要把授权写进快照）。
4. 升级 wrangler（当前 4.110，有 4.156 可用）和相关依赖，跑全量检查。
5. 把约 2400 行的 `cloudflare/src/lib/subscription.ts` 拆成 fetch、parse、filters、render 几个模块。
6. QX 输出里的 IPv6 地址没有加方括号（QX 的写法未确认）。
7. 可选、收益较小：
   - 把 `run_worker_first` 改成只对 `/api/*`、`/download/*` 生效，安全头改由 `_headers` 文件下发。
   - 加限流 binding 或 WAF 规则，防暴力猜 token。
   - 去掉 `nodejs_compat`，先确认 vitest-pool-workers 不依赖它。

## 6. 开发、验证与部署

日常检查：

```bash
pnpm run check            # Worker 类型检查 + 前端 locale 检查 + 构建
pnpm run check:tests      # Worker 与 D1 集成测试
pnpm run check:runtime    # 本地 wrangler dev 启动冒烟
```

发布前跑全量：`pnpm run check:release`。注意它最后一步 `check:history -- main` 会扫描每个提交里的每个文件，耗时很长；可以单独用 `pnpm run check:open-source` 检查当前文件。

部署这个已有实例时，**不要重新跑 `pnpm run install:cloudflare` 或 `seed:remote`**，它们会用本地 seed 覆盖用户在界面里改过的数据。只做迁移和部署：

```bash
pnpm run migrate:remote   # 没有新迁移时会提示 No migrations to apply
pnpm run deploy:local     # 构建前端并按 cloudflare/wrangler.deploy.local.jsonc 部署
```

部署后验证：`/api/env`、`/api/sources`、`/api/collections` 带 `Authorization: Bearer <管理 token>` 返回 200；各 collection 的 `/download/collection/<id>/mihomo?token=<下载 token>` 返回 200；错误 token 返回 403；下载专用域名的根路径返回 404。

客户端格式校验（本机已用 Homebrew 装好 `mihomo` 和 `sing-box`）：

```bash
mihomo -t -d /tmp/check -f config.yaml
sing-box check -c config.json
```

## 7. 隐私规则

- 订阅地址、节点、管理 token、下载 token、D1 id、seed SQL 都不能提交。
- 部署信息和 token 只在 `config/agent-setup.local.json` 和 `cloudflare/wrangler.deploy.local.jsonc` 里，两者都被 git 忽略。
- 提交前跑 `git status --short` 和 `pnpm run check:open-source`。
- 产品边界见仓库根目录的 `AGENTS.md`：不引入 R2、KV、Durable Objects、Queues、Cron，也不加 Gist 同步、运行时脚本等上游功能。

## 8. 关键文件

| 路径 | 作用 |
| --- | --- |
| `cloudflare/src/index.ts` | Worker 入口：安全头、下载专用域名限制、错误日志脱敏 |
| `cloudflare/src/routes/api.ts` | 管理 API |
| `cloudflare/src/routes/download.ts` | 下载路由与 token 判定（主 token 与分享 token） |
| `cloudflare/src/lib/subscription.ts` | 抓取、缓存、解析、过滤、渲染 |
| `cloudflare/src/lib/store.ts` | D1 读写、导入导出 |
| `cloudflare/src/lib/compatibility-resources.ts` | 分享授权与回收站 |
| `cloudflare/test/parsers.test.ts` | 解析与输出回归测试 |
| `cloudflare/test/worker.test.ts` | 路由、鉴权、存储集成测试 |
| `frontend/src/views/` | 页面：`Sub.vue` 列表、`SubEditor.vue` 编辑、`Tools.vue` 工具、`My.vue` 设置 |
| `frontend/src/utils/adminToken.ts`、`frontend/src/api/index.ts` | token 读写与 401 处理 |
