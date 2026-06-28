# 部署说明

这个仓库有三种部署路径：

1. Cloudflare 官方一键部署按钮：最适合普通开源用户。
2. Agent / CLI 一键安装器：适合需要导入订阅源、创建组合订阅和返回下载链接的用户。
3. 手动 Wrangler 部署：适合需要完全控制每一步的人。

默认架构保持 Cloudflare-native：Workers Static Assets + Worker API + D1 + Worker Secrets。

## 1. Cloudflare 官方一键部署

README 顶部的按钮：

```md
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/realchendahuang/sub-store-cloudflare)
```

Cloudflare 会读取根目录 [../wrangler.jsonc](../wrangler.jsonc)，自动 provision D1，并用根目录 `package.json` 的 `build` / `deploy` 脚本构建部署。

部署页会要求填写：

- `SUB_STORE_ADMIN_TOKEN`
- `SUB_STORE_PUBLIC_DOWNLOAD_TOKEN`

生成 token：

```bash
openssl rand -base64 32
```

部署后进入：

```text
https://<worker>.<workers-subdomain>.workers.dev/?token=<admin-token>
```

然后在网页管理界面里添加订阅源、组合订阅和模板。

按钮部署的定位是“最快跑起来”。它不会读取你的本地 `config/agent-setup.local.json`，也不会把订阅源写进 GitHub。

注意：Cloudflare 官方按钮会把仓库导入到用户自己的 GitHub/GitLab 账号，并可能为这个副本配置 Workers Builds。这个行为属于 Cloudflare 的模板部署体验，不代表本上游仓库使用 GitHub Actions、Dependabot 或 GitHub CI/CD。

## 2. Agent / CLI 一键安装

本地安装器入口：

```bash
pnpm run install:cloudflare
```

它会执行：

- 安装依赖。
- 检查 Wrangler 和 Cloudflare 登录。
- 创建或复用 D1。
- 生成 `cloudflare/wrangler.deploy.local.jsonc`。
- 生成或使用 `SUB_STORE_ADMIN_TOKEN` / `SUB_STORE_PUBLIC_DOWNLOAD_TOKEN`。
- 写入 Worker secrets。
- 运行检查、D1 migration、Worker deploy。
- 渲染并导入 `cloudflare/agent.seed.local.sql`。
- 验证 `/api/env`、`/api/templates`、`/api/sources`、`/api/collections` 和 collection 下载链接。
- 打印 admin URL 和 collection download URLs。

如果没有 Cloudflare 账号或还没登录：

```bash
pnpm --dir cloudflare exec wrangler login
pnpm run install:cloudflare
```

如果 agent 运行环境无法访问 Cloudflare，安装器会停止并给出 resume 命令，不会假装已经部署。

可以先做本地诊断：

```bash
pnpm run install:doctor
```

## 3. 准备 Agent Seed 配置

私有导入配置写在：

```text
config/agent-setup.local.json
```

第一次可以复制：

```bash
cp config/agent-setup.example.json config/agent-setup.local.json
```

然后按 [../config/agent-setup.schema.json](../config/agent-setup.schema.json) 填写 `sources`、`collections`、`templates`。

常用模板和过滤器预设见 [../config/rule-presets.json](../config/rule-presets.json)。

验证和渲染：

```bash
pnpm run seed:validate
pnpm run seed:render
```

导入远程 D1：

```bash
pnpm run seed:remote
```

本地开发导入：

```bash
pnpm run seed:local
```

这些本地文件都被 git ignore：

- `config/agent-setup.local.json`
- `cloudflare/agent.seed.local.sql`
- `cloudflare/wrangler.deploy.local.jsonc`

## 4. 手动 Wrangler 部署

安装依赖并登录：

```bash
pnpm run setup
pnpm --dir cloudflare exec wrangler login
```

创建 D1：

```bash
pnpm --dir cloudflare exec wrangler d1 create sub-store-cloudflare
```

用返回的 `database_id` 生成本地部署配置：

```bash
cp config/agent-setup.example.json config/agent-setup.local.json
pnpm run deploy:config -- config/agent-setup.local.json cloudflare/wrangler.deploy.local.jsonc --database-id <database-id>
```

设置 secrets：

```bash
pnpm --dir cloudflare exec wrangler secret put SUB_STORE_ADMIN_TOKEN --config wrangler.deploy.local.jsonc
pnpm --dir cloudflare exec wrangler secret put SUB_STORE_PUBLIC_DOWNLOAD_TOKEN --config wrangler.deploy.local.jsonc
```

迁移和部署：

```bash
pnpm run migrate:remote
pnpm run deploy:local
```

如果需要先 dry-run：

```bash
pnpm run deploy:local:dry-run
```

## 5. 自定义域名

默认部署到 `workers.dev`。

如果要绑定自己的管理域名，在 `config/agent-setup.local.json` 填：

```json
{
  "deployment": {
    "adminHostname": "substore.example.com",
    "downloadHostname": ""
  }
}
```

重新生成本地配置：

```bash
pnpm run deploy:config -- config/agent-setup.local.json cloudflare/wrangler.deploy.local.jsonc --database-id <database-id>
```

如果使用单独下载域名，填写 `downloadHostname`。生成器会写入 `SUB_STORE_PUBLIC_DOWNLOAD_HOSTS`，该域名只允许访问 `/download/*`。

## 6. 本地开发

需要 Node.js 22 和 pnpm 11。

```bash
cp cloudflare/.dev.vars.example cloudflare/.dev.vars
pnpm run build:frontend
pnpm run dev
```

本地 `.dev.vars` 至少包含：

```dotenv
SUB_STORE_ADMIN_TOKEN=dev-admin-token
SUB_STORE_PUBLIC_DOWNLOAD_TOKEN=dev-download-token
```

访问：

```text
http://localhost:8787/?token=dev-admin-token
```

## 7. 下载链接

管理界面：

```text
https://substore.example.com/?token=<admin-token>
```

下载链接：

```text
https://substore.example.com/download/source/<source-id>?token=<download-token>
https://substore.example.com/download/collection/<collection-id>?token=<download-token>
https://substore.example.com/download/collection/<collection-id>/mihomo?token=<download-token>
https://substore.example.com/download/collection/<collection-id>/sing-box?token=<download-token>
https://substore.example.com/download/collection/<collection-id>/uri?token=<download-token>
```

不带输出格式的链接是通用订阅，Worker 会按客户端 User-Agent 自动选择格式。

临时转换链接：

```text
https://substore.example.com/download/source/<source-id>?token=<download-token>&url=https%3A%2F%2Fexample.com%2Fsub
https://substore.example.com/download/source/<source-id>/uri?token=<download-token>&content=<url-encoded-node-text>
```

`url`、`content` 和 `ua` 只影响本次请求，不会写入 D1。

## 8. 备份与恢复

管理界面的「我的」页面可以导出和恢复完整配置，包括订阅源、组合订阅、规则模板和请求设置。

也可以直接访问：

```text
https://substore.example.com/api/storage?token=<admin-token>
```

恢复入口是 `POST /api/storage`，请求体可以是完整备份 JSON，也可以是 `{ "content": "<backup-json>" }`。

## 9. 发布前检查

```bash
pnpm run check:release
pnpm run deploy:dry-run
```

它会执行：

- Worker TypeScript 检查。
- 前端生产构建。
- Agent setup / seed / deploy config 检查。
- Worker contract 检查。
- 当前文件发布风险扫描。
- `main` 历史发布风险扫描。
- Wrangler dry-run 部署检查。
- 仓库没有 GitHub Actions 或 Dependabot 自动化；`.github` 只用于 issue / pull request 模板。
- 发布检查在本地完成。
