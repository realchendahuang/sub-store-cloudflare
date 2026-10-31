# 故障排查

先判断你走的是哪条安装路径：

- Cloudflare 官方 Deploy Button。
- `pnpm run install:cloudflare`。
- 手动 Wrangler 部署。
- 本地开发。

不要在 issue 里贴订阅 URL、节点 URI、admin token、download token、私有 D1 database id 或生成的 seed SQL。

## 快速诊断

```bash
pnpm run install:doctor
pnpm run check:release
pnpm run deploy:dry-run
```

如果只想检查 Cloudflare 登录：

```bash
pnpm --dir cloudflare exec wrangler whoami
```

## Deploy Button 的 Secret 已经被填满

正常情况下，`SUB_STORE_ADMIN_TOKEN` 和 `SUB_STORE_PUBLIC_DOWNLOAD_TOKEN` 需要你自己填写两个不同的随机值。

如果输入框出现 `replace-with-...`、`example` 或其他公开固定字符串，不要点击部署。这通常表示部署源仍包含会被 Cloudflare 读取的根目录 `.dev.vars.example`。请确认使用仓库最新版本并提交 issue。

跨平台生成随机值：

```bash
node --input-type=module -e "import{randomBytes as r}from'node:crypto';console.log(r(32).toString('base64url'));console.log(r(32).toString('base64url'))"
```

## 没有 Cloudflare 账号

这个项目必须运行在 Cloudflare Workers + D1 上。可以先阅读文档和准备本地配置，但不能完成线上部署。

创建 Cloudflare 账号后运行：

```bash
pnpm --dir cloudflare exec wrangler login
pnpm run install:cloudflare
```

## Agent 不能连接 Cloudflare

如果 Codex、Claude Code 或其他本地 Agent 无法访问 Cloudflare，不要把部署状态写成成功。让 Agent 停在 handoff 状态，并给出恢复命令：

```bash
pnpm --dir cloudflare exec wrangler login
pnpm run install:cloudflare
```

## Wrangler 没登录

现象通常是 `wrangler whoami` 失败，或者创建 D1 / 写 secret / deploy 时要求认证。

处理：

```bash
pnpm --dir cloudflare exec wrangler login
pnpm --dir cloudflare exec wrangler whoami
```

然后重新运行安装：

```bash
pnpm run install:cloudflare
```

## D1 配置错误

现象可能是 migration 失败、Worker 访问 `DB` binding 失败，或 deploy config 检查失败。

处理：

```bash
pnpm run check:deploy-config -- --required
pnpm run deploy:config -- config/agent-setup.local.json cloudflare/wrangler.deploy.local.jsonc --database-id <database-id>
pnpm run migrate:remote
```

确认 `cloudflare/wrangler.deploy.local.jsonc` 是本地文件，不要提交。

## Secret 缺失

线上 Worker 至少需要：

- `SUB_STORE_ADMIN_TOKEN`
- `SUB_STORE_PUBLIC_DOWNLOAD_TOKEN`

重新写入：

```bash
pnpm --dir cloudflare exec wrangler secret put SUB_STORE_ADMIN_TOKEN --config wrangler.deploy.local.jsonc
pnpm --dir cloudflare exec wrangler secret put SUB_STORE_PUBLIC_DOWNLOAD_TOKEN --config wrangler.deploy.local.jsonc
```

## 部署按钮成功但没有订阅源

这是正常行为。Cloudflare Deploy Button 只负责让应用跑起来，不会读取你的本地 `config/agent-setup.local.json`，也不会把订阅源写进 GitHub。

部署完成后用管理界面添加订阅源，或在本地准备 seed 后运行：

```bash
pnpm run seed:validate
pnpm run seed:render
pnpm run seed:remote
```

也可以直接按管理端首次使用卡片完成 Source → Collection → 下载链接。

## CLI 第一次运行时没有 setup 文件

真实交互式终端会打开快速引导。非交互 Agent 环境会创建 `config/agent-setup.local.json` 示例并停止，这是为了避免把示例订阅 URL 部署到生产。

三种继续方式：

```bash
# 编辑真实 Sources / Collections 后继续
pnpm run install:cloudflare

# 明确部署空应用，之后在网页配置
pnpm run install:quick

# 只检查环境
pnpm run install:doctor
```

## 下载链接返回 401

检查链接里是否使用 download token，而不是 admin token：

```text
/download/collection/<collection-id>/mihomo?token=<download-token>
```

管理界面和 `/api/*` 使用 admin token。`/download/*` 使用 download token。

## 输出格式不对

显式指定 target：

```text
/download/collection/<collection-id>/mihomo?token=<download-token>
/download/collection/<collection-id>/sing-box?token=<download-token>
/download/collection/<collection-id>/uri?token=<download-token>
```

不带 target 时，Worker 会按客户端 User-Agent 自动判断，无法识别时默认 Mihomo。

## 节点被过滤掉

先移除 aggressive include filter，例如只保留地区的过滤器。保守起步建议只用：

- `clean-provider-nodes`
- `dedupe-by-endpoint`
- `sort-by-name`

再逐步增加区域过滤。
