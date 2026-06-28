# 部署说明

默认部署入口是 [cloudflare/](../cloudflare)。前端在 [frontend/](../frontend) 构建，产物由 Worker Static Assets 托管。

## 1. 准备环境

需要：

- Node.js 20+
- pnpm
- Cloudflare 账号
- 已登录 Wrangler

安装依赖：

```bash
pnpm run setup
```

如果还没有登录 Cloudflare：

```bash
pnpm --dir cloudflare exec wrangler login
```

## 2. 创建 D1 数据库

```bash
pnpm --dir cloudflare exec wrangler d1 create sub-store-cloudflare
```

用命令返回的 `database_id` 生成本地部署配置：

```bash
pnpm run deploy:config -- config/agent-setup.local.json cloudflare/wrangler.deploy.local.jsonc --database-id <database-id>
```

生成的 `cloudflare/wrangler.deploy.local.jsonc` 只用于本地部署。

## 3. 本地开发

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

## 4. 生产 Secrets

```bash
pnpm --dir cloudflare exec wrangler secret put SUB_STORE_ADMIN_TOKEN
pnpm --dir cloudflare exec wrangler secret put SUB_STORE_PUBLIC_DOWNLOAD_TOKEN
```

可选：用 Secret 写入一份初始本地订阅文本：

```bash
pnpm --dir cloudflare exec wrangler secret put SUB_STORE_BOOTSTRAP_SOURCE_CONTENT
```

部署后也可以直接在管理界面添加订阅源。

## 5. 应用迁移

远程 D1：

```bash
pnpm run migrate:remote
```

本地 D1：

```bash
pnpm run migrate:local
```

## 6. 部署

```bash
pnpm run deploy:dry-run
pnpm run deploy
```

`pnpm run deploy` 会先构建 `frontend/dist`，再部署 Worker。

默认配置会部署到 `workers.dev`。如果要绑定自己的域名，在 `config/agent-setup.local.json` 的 `deployment.adminHostname` 和 `deployment.downloadHostname` 中填写域名，然后重新生成本地部署配置。

生成后的本地配置会包含类似：

```jsonc
{
  "routes": [
    { "pattern": "substore.example.com", "custom_domain": true }
  ]
}
```

如果希望管理域名和下载域名分开，把下载域名写到 `deployment.downloadHostname`，生成器会写入 `SUB_STORE_PUBLIC_DOWNLOAD_HOSTS`。这些域名只开放 `/download/*`。

## 7. 使用

管理界面：

```text
https://substore.example.com/?token=<admin-token>
```

下载链接：

```text
https://substore.example.com/download/source/<source-id>?token=<download-token>
https://substore.example.com/download/collection/<collection-id>?token=<download-token>
https://substore.example.com/download/collection/<collection-id>/mihomo?token=<download-token>
https://substore.example.com/download/collection/<collection-id>/surge?token=<download-token>
https://substore.example.com/download/collection/<collection-id>/loon?token=<download-token>
https://substore.example.com/download/collection/<collection-id>/qx?token=<download-token>
https://substore.example.com/download/collection/<collection-id>/sing-box?token=<download-token>
https://substore.example.com/download/collection/<collection-id>/uri?token=<download-token>
```

不带输出格式的链接是通用订阅，Worker 会按客户端 User-Agent 自动选择格式。管理界面的复制按钮会读取 Worker Secret 里的下载 token，并生成可直接复制到客户端的链接。

临时转换链接：

```text
https://substore.example.com/download/source/<source-id>?token=<download-token>&url=https%3A%2F%2Fexample.com%2Fsub
https://substore.example.com/download/source/<source-id>/uri?token=<download-token>&content=<url-encoded-node-text>
```

`url`、`content` 和 `ua` 只影响本次请求，适合临时复用已有订阅源或组合订阅的过滤器、规则模板和输出格式。

## 8. 备份与恢复

管理界面的「我的」页面可以导出和恢复完整配置，包括订阅源、组合订阅、规则模板和请求设置。也可以直接访问：

```text
https://substore.example.com/api/storage?token=<admin-token>
```

恢复入口是 `POST /api/storage`，请求体可以是完整备份 JSON，也可以是 `{ "content": "<backup-json>" }`。

## 9. 导入初始配置

如果使用 AI Agent 准备订阅源和组合订阅，配置会写在：

```text
config/agent-setup.local.json
```

可以先复制示例：

```bash
cp config/agent-setup.example.json config/agent-setup.local.json
```

生成导入 SQL：

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

这条链路不需要浏览器操作。AI Agent 应该通过 `config/agent-setup.local.json`、`pnpm run seed:validate`、`pnpm run seed:render` 和 `pnpm run seed:remote` 完成初始配置导入。

如果要配置 Cloudflare Access，先写入 `config/agent-setup.local.json` 的 `access` 字段，再运行：

```bash
pnpm run access:render
```

确认生成的 `cloudflare/access.setup.local.json` 后再运行：

```bash
CLOUDFLARE_API_TOKEN=... pnpm run access:apply
```

## 10. 发布前检查

```bash
pnpm run check:release
```

它会执行：

- Worker TypeScript 检查。
- 前端生产构建。
- 当前文件发布风险扫描。
- `main` 历史发布风险扫描。
