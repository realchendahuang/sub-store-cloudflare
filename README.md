# Sub-Store Cloudflare

一个部署在 Cloudflare Workers 上的订阅聚合与规则配置工具。它把订阅源、节点过滤、组合订阅和分流规则模板放在云端，客户端只需要订阅最终生成的链接。

English: [README.en.md](README.en.md)

## 适合谁

- 有多个机场订阅、VPS 自建节点或本地节点文本，希望统一输出一个订阅链接。
- 希望把分流规则、节点筛选和组合逻辑放在服务端维护，而不是在每个客户端重复配置。
- 希望用 Cloudflare 的轻量部署方式运行，不想维护服务器、数据库服务和复杂后台任务。

## 项目做什么

- 管理远程订阅 URL 和本地节点文本。
- 把多个订阅源组合成一个云端组合订阅。
- 对节点做区域/类型/正则过滤、重命名、正则删除、去重、正则排序、域名解析、旗帜处理和常用属性设置。
- 内置常用 Mihomo 分流模板，也支持导入自己的 JSON/YAML 模板。
- 在网页里预览处理前后的节点列表，并校验本地节点内容。
- 支持订阅流量信息、配置备份/恢复、远程订阅请求超时、User-Agent、透传 User-Agent 和并发参数。
- 下载链接支持临时传入 `url`、`content` 和 `ua`，可以复用已有过滤器和模板做一次性格式转换。
- 输出 Mihomo、Stash、Surge、Surge Mac、Surfboard、Loon、Egern、Shadowrocket、Quantumult X、sing-box、v2ray、URI 和 JSON。
- 使用 Worker Secrets 保护管理端和下载链接。

这个项目聚焦“云端聚合 + 云端节点处理 + 云端规则模板 + 最终订阅输出”。它保留日常维护订阅需要的核心链路：格式转换、订阅格式化、多订阅合并、常见客户端输出、规则模板、预览校验、流量信息和导入导出。不包含 Gist 同步、文件管理、分享、归档、脚本运行、日志面板、队列任务等额外系统。

## 致谢

本项目的前端交互和订阅管理思路参考并致敬 [sub-store-org/Sub-Store](https://github.com/sub-store-org/Sub-Store)。原版 Sub-Store 是功能完整的订阅管理项目，覆盖了更广的运行环境和客户端生态；这个仓库选择更小的 Cloudflare-native 形态，方便直接部署和二次修改。

## 架构

```text
Cloudflare Worker
  |-- Static Assets       Vue 管理界面
  |-- /api/*              配置 API
  |-- /download/source/*  单订阅源输出
  |-- /download/collection/* 组合订阅输出
  |
  |-- D1                  sources / collections / templates / settings
  |-- Worker Secrets      admin token / download token
```

只需要 Cloudflare Workers + D1。KV、R2、Durable Objects、Queue、Cron 都不是核心路径。

目录：

```text
.
├── frontend/      # Vue 管理界面，构建后由 Worker 静态资源托管
├── cloudflare/    # Worker、D1 schema、订阅生成逻辑
├── config/        # 初始配置示例，local 文件用于导入自己的订阅源
├── docs/          # 架构和部署说明
└── scripts/       # 开源检查和维护脚本
```

## 快速开始

需要：

- Node.js 20+
- pnpm
- Cloudflare 账号

安装依赖：

```bash
pnpm run setup
```

创建 D1 数据库：

```bash
pnpm --dir cloudflare exec wrangler d1 create sub-store-cloudflare
```

用返回的 `database_id` 生成本地部署配置：

```bash
cp config/agent-setup.example.json config/agent-setup.local.json
pnpm run deploy:config -- config/agent-setup.local.json cloudflare/wrangler.deploy.local.jsonc --database-id <database-id>
```

本地开发：

```bash
cp cloudflare/.dev.vars.example cloudflare/.dev.vars
pnpm run build:frontend
pnpm run dev
```

访问：

```text
http://localhost:8787/?token=<admin-token>
```

## 用 AI Agent 部署

如果你希望用 Codex、Claude Code 之类的 Agent 一路完成部署，可以让 Agent 读取 [AGENTS.md](AGENTS.md) 和 [agent/SKILL.md](agent/SKILL.md)，或者直接复制 [agent/install.prompt.md](agent/install.prompt.md) 里的提示词。

最短版本：

```text
Follow AGENTS.md and agent/SKILL.md in this repository. Help me deploy this Sub-Store Cloudflare project to my Cloudflare account. Ask me only for missing inputs, prepare my subscription sources and collections, generate the D1 seed SQL, deploy the Worker, import the seed, and give me the final admin URL plus collection download URLs.
```

Agent 会把订阅源和本地节点写入 `config/agent-setup.local.json`，再生成 `cloudflare/agent.seed.local.sql` 导入 D1。

规则模板和过滤器预设在 [config/rule-presets.json](config/rule-presets.json)，配置结构见 [config/agent-setup.schema.json](config/agent-setup.schema.json)。详细说明见 [docs/ai-agent-install.md](docs/ai-agent-install.md)。

## 部署

设置生产 Secrets：

```bash
pnpm --dir cloudflare exec wrangler secret put SUB_STORE_ADMIN_TOKEN
pnpm --dir cloudflare exec wrangler secret put SUB_STORE_PUBLIC_DOWNLOAD_TOKEN
```

应用 D1 迁移：

```bash
pnpm run migrate:remote
```

部署：

```bash
pnpm run deploy:dry-run
pnpm run deploy
```

导入 Agent 准备好的初始配置：

```bash
cp config/agent-setup.example.json config/agent-setup.local.json
# 编辑 config/agent-setup.local.json
pnpm run seed:render
pnpm run seed:remote
```

管理界面：

```text
https://substore.example.com/?token=<admin-token>
```

订阅链接：

```text
https://substore.example.com/download/source/<source-id>/mihomo?token=<download-token>
https://substore.example.com/download/collection/<collection-id>/mihomo?token=<download-token>
https://substore.example.com/download/collection/<collection-id>/surge?token=<download-token>
https://substore.example.com/download/collection/<collection-id>/loon?token=<download-token>
https://substore.example.com/download/collection/<collection-id>/qx?token=<download-token>
https://substore.example.com/download/collection/<collection-id>/sing-box?token=<download-token>
```

临时转换：

```text
https://substore.example.com/download/source/<source-id>/mihomo?token=<download-token>&url=https%3A%2F%2Fexample.com%2Fsub
https://substore.example.com/download/source/<source-id>/sing-box?token=<download-token>&content=<url-encoded-node-text>
```

`url` 会临时替换该订阅源的远程订阅地址，`content` 会临时按本地节点文本解析，`ua` 会临时覆盖拉取远程订阅时使用的 User-Agent。临时参数只影响本次请求，不会写入 D1。订阅源开启「透传 User-Agent」时，Worker 会把订阅客户端请求下载链接时的 User-Agent 继续用于拉取远程订阅。

如果配置了独立下载域名，把它写入 `SUB_STORE_PUBLIC_DOWNLOAD_HOSTS`。该域名只开放 `/download/*`。

完整部署步骤见 [docs/deployment.md](docs/deployment.md)。

## 配置模型

| 概念 | 作用 |
| --- | --- |
| Sources | 远程订阅 URL 或本地节点文本。 |
| Collections | 多个 Sources 的组合订阅。 |
| Filters | 节点包含、排除、正则删除、重命名、去重、排序、域名解析、旗帜和常用属性设置。 |
| Templates | Mihomo 的代理组、规则提供者和规则列表。 |

Worker API 保存的过滤器是这版自己的小型 JSON DSL，不暴露前端编辑器内部字段：

输入格式：

- 远程订阅：每行一个 `http(s)` URL，多个 URL 会合并。
- 本地节点：支持单行 URI、Mihomo YAML、JSON 代理数组、常见 Surge/Loon/Quantumult X 单行节点，也支持完整 Base64 内容。
- 常用 URI：`ss`、`ssr`、`vmess`、`vless`、`trojan`、`hysteria`、`hysteria2`、`tuic`、`anytls`、`http`、`socks5`、`wireguard`。
- 临时输入：下载链接可附加 `url`、`content`、`ua`，用于复用当前订阅源或组合订阅的过滤器、规则模板和输出格式。
- 流量信息：优先读取订阅响应头 `subscription-userinfo`，也可以手动填写 `upload=...; download=...; total=...`，或通过 `flowUrl` 指定独立查询地址。

输出格式：

- Mihomo / Stash / Surge Mac：YAML 输出，支持模板里的代理组、规则提供者和规则列表。
- Surge / Surfboard / Loon / Quantumult X：常见文本节点格式输出。
- Shadowrocket / URI：通用 URI 列表。
- sing-box：基础 JSON 配置。
- v2ray：Base64 URI 列表。
- JSON：处理后的节点数组，适合调试和二次处理。

过滤器示例：

```json
[
  { "type": "include", "field": "name", "pattern": "香港|HK|日本|JP" },
  { "type": "exclude", "field": "name", "pattern": "官网|剩余|倍率" },
  { "type": "delete-field", "field": "name", "patterns": ["倍率\\s*\\d+"] },
  { "type": "dedupe", "fields": ["server", "port"], "action": "rename", "link": "-" },
  { "type": "regex-sort", "expressions": ["香港|HK", "日本|JP", "新加坡|SG"], "direction": "asc" },
  { "type": "flag", "mode": "add" },
  { "type": "sort", "direction": "asc" }
]
```

规则模板只应用于 Mihomo、Stash 和 Surge Mac 这类 YAML 输出。自定义模板可以导入常见 Mihomo YAML，也可以使用 JSON；导入时会识别 `mixed-port`、`allow-lan`、`log-level`、`proxy-groups`、`rule-providers` 这些 Mihomo 键名，并转换为内部配置。

模板中的 `proxyGroups[].proxies` 或 `proxy-groups[].proxies` 可以写 `$all`，生成订阅时会展开为当前组合里的全部节点。

## 内置模板

- `acl4ssr-mihomo`：默认模板，使用 ACL4SSR 和常用媒体/AI 分流。
- `acl4ssr-mihomo-no-emoji`：同样使用 ACL4SSR，但分组名不带 emoji。
- `mihomo-basic`：小型基础模板。
- `loyalsoldier-whitelist`：Loyalsoldier 白名单思路。
- `loyalsoldier-blacklist`：Loyalsoldier 黑名单思路。
- `ai-streaming-mihomo`：AI、流媒体、Telegram、GitHub 常用规则。

## 发布前检查

```bash
pnpm run check:release
```

这个命令会检查 Worker、构建前端，并扫描当前文件和 `main` 历史里的常见发布风险。

## License

见 [LICENSE](LICENSE) 和 [NOTICE](NOTICE)。
