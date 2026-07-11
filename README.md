# Sub-Store Cloudflare

[![Release](https://img.shields.io/github/v/release/realchendahuang/sub-store-cloudflare?include_prereleases&sort=semver)](https://github.com/realchendahuang/sub-store-cloudflare/releases)
[![License: AGPL-3.0](https://img.shields.io/github/license/realchendahuang/sub-store-cloudflare)](LICENSE)
[![Stars](https://img.shields.io/github/stars/realchendahuang/sub-store-cloudflare?style=flat)](https://github.com/realchendahuang/sub-store-cloudflare/stargazers)
[![Forks](https://img.shields.io/github/forks/realchendahuang/sub-store-cloudflare?style=flat)](https://github.com/realchendahuang/sub-store-cloudflare/forks)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/workers/)
[![D1](https://img.shields.io/badge/Storage-D1-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/d1/)
[![Node.js >=22](https://img.shields.io/badge/Node.js-%3E%3D22-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-11.7.0-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/realchendahuang/sub-store-cloudflare)

一个部署在 Cloudflare Workers 上的订阅聚合与规则配置工具。它把订阅源、节点处理、组合订阅和分流规则模板放在云端，客户端只需要订阅最终生成的链接。

English: [README.en.md](README.en.md)

## 文档

- [部署说明](docs/deployment.md)
- [AI Agent 安装](docs/ai-agent-install.md)
- [产品边界](docs/product-scope.md)
- [架构说明](docs/architecture.md)
- [原版兼容矩阵](docs/upstream-compatibility.md)
- [测试与发布检查](docs/testing.md)
- [故障排查](docs/troubleshooting.md)
- [发布流程](docs/release.md)
- [路线图](ROADMAP.md)
- [治理说明](GOVERNANCE.md)
- [贡献指南](CONTRIBUTING.md)
- [支持说明](SUPPORT.md)
- [安全策略](SECURITY.md)
- [变更记录](CHANGELOG.md)

## 最快部署

### 方式一：Cloudflare 官方一键部署

点上面的 **Deploy to Cloudflare** 按钮。Cloudflare 会把仓库复制到你的 GitHub/GitLab 账号，自动创建 Worker、D1 数据库并部署。

部署页会要求填写两个 secret：

- `SUB_STORE_ADMIN_TOKEN`：管理界面和 `/api/*` token。
- `SUB_STORE_PUBLIC_DOWNLOAD_TOKEN`：订阅下载链接 token。

可以用下面的命令生成随机 token：

```bash
openssl rand -base64 32
```

部署完成后打开：

```text
https://<your-worker>.<your-subdomain>.workers.dev/?token=<admin-token>
```

然后在网页里添加订阅源、组合订阅和规则模板。这是最适合普通开源用户的路径。

说明：这是 Cloudflare 官方的模板导入流程。Cloudflare 可能会在你的账号里配置 Workers Builds，用于后续从你自己的副本仓库部署；本上游仓库不使用 GitHub Actions、Dependabot 或 GitHub CI/CD。

### 方式二：Agent / CLI 一键安装

如果你希望 Codex、Claude Code 或本地命令直接帮你导入订阅源、创建组合订阅并返回可复制链接，用：

```bash
pnpm run install:cloudflare
```

这个命令会校验本地配置、检查 Cloudflare 登录、创建或复用 D1、生成部署配置、写入 Worker secrets、迁移 D1、部署 Worker、导入 `config/agent-setup.local.json`，最后验证并打印管理链接和下载链接。没有填写 token 时，安装器会生成并保存到被 Git 忽略的本地配置中，失败后重跑不会自动轮换。

如果还没有 Cloudflare 账号或没有登录 Wrangler，它会停下来并提示：

```bash
pnpm --dir cloudflare exec wrangler login
pnpm run install:cloudflare
```

让 AI Agent 处理时，可以直接复制 [agent/install.prompt.md](agent/install.prompt.md)。

## 适合谁

- 有多个机场订阅、VPS 自建节点或本地节点文本，希望统一输出一个订阅链接。
- 希望把分流规则、节点筛选和组合逻辑放在服务端维护，而不是在每个客户端重复配置。
- 希望用 Cloudflare 的轻量部署方式运行，不想维护服务器、数据库服务和复杂后台任务。

## 项目做什么

- 管理远程订阅 URL 和本地节点文本。
- 把多个订阅源组合成一个云端组合订阅。
- 对节点做区域/类型/正则过滤、重命名、正则删除、去重、正则排序、域名解析、旗帜处理和常用属性设置。
- 支持随 Worker 编译的 JavaScript Filter / Operator；内置脚本可在网页选择，个人脚本通过 CLI 重新部署。
- 内置常用 Mihomo 分流模板，也支持导入自己的 JSON/YAML 模板。
- 在网页里预览处理前后的节点列表，并校验本地节点内容。
- 支持订阅流量信息、配置备份/恢复、远程订阅请求超时、User-Agent、透传 User-Agent 和并发参数。
- 下载链接支持临时传入 `url`、`content` 和 `ua`，可以复用已有过滤器和模板做一次性格式转换。
- 管理端“工具”页面支持不落库的节点/订阅转换和 Mihomo、Surge、Loon、Quantumult X 规则转换。
- 支持独立、限时、可撤销、可限制输出格式的分享链接，以及最多 50 条的配置回收站。
- 远程订阅支持安全元数据透传、可配置的 Workers Cache API 边缘缓存和失败回退。
- 预览页支持可配置 HTTPS 服务的节点 IP、地区、组织和 ASN 查询。
- 输出 Mihomo、Stash、Surge、Surge Mac、Surfboard、Loon、Egern、Shadowrocket、Quantumult X、sing-box、v2ray、URI 和 JSON。
- 使用 Worker Secrets 保护管理端和下载链接。

这个项目聚焦“云端聚合 + 云端节点处理 + 云端规则模板 + 最终订阅输出”。v1.0.0 兼容了原版中能在 Cloudflare 免费版稳定运行的解析、转换、分享和删除恢复工作流，但不会用空路由冒充完整 Node.js 平台兼容。

详细边界见 [docs/product-scope.md](docs/product-scope.md)，脚本用法见 [docs/script-plugins.md](docs/script-plugins.md)。

## 架构

```text
Cloudflare Worker
  |-- Static Assets       Vue 管理界面
  |-- /api/*              配置 API
  |-- /download/source/*  单订阅源输出
  |-- /download/collection/* 组合订阅输出
  |
  |-- D1                  配置 / 独立下载授权 / 有上限的回收站
  |-- Cache API           可选远程订阅边缘缓存
  |-- Worker Secrets      admin token / download token
```

只需要 Cloudflare Workers + D1；Cache API 是 Worker 内置的可选优化。KV、R2、Durable Objects、Queue、Cron 都不是核心路径。

## 本地开发

需要 Node.js 22 和 pnpm 11。仓库带有 `.node-version` 和 `packageManager` 字段。

```bash
pnpm run setup
cp cloudflare/.dev.vars.example cloudflare/.dev.vars
pnpm run build:frontend
pnpm run dev
```

访问：

```text
http://localhost:8787/?token=dev-admin-token
```

## 手动部署

如果不用按钮，也不用 agent installer：

```bash
pnpm run setup
pnpm --dir cloudflare exec wrangler login
pnpm --dir cloudflare exec wrangler d1 create sub-store-cloudflare
cp config/agent-setup.example.json config/agent-setup.local.json
pnpm run deploy:config -- config/agent-setup.local.json cloudflare/wrangler.deploy.local.jsonc --database-id <database-id>
pnpm --dir cloudflare exec wrangler secret put SUB_STORE_ADMIN_TOKEN --config wrangler.deploy.local.jsonc
pnpm --dir cloudflare exec wrangler secret put SUB_STORE_PUBLIC_DOWNLOAD_TOKEN --config wrangler.deploy.local.jsonc
pnpm run migrate:remote
pnpm run deploy:local
```

详细说明见 [docs/deployment.md](docs/deployment.md)。Agent 导入配置见 [docs/ai-agent-install.md](docs/ai-agent-install.md)。

## 下载链接

```text
https://substore.example.com/download/source/<source-id>?token=<download-token>
https://substore.example.com/download/collection/<collection-id>?token=<download-token>
https://substore.example.com/download/collection/<collection-id>/mihomo?token=<download-token>
https://substore.example.com/download/collection/<collection-id>/sing-box?token=<download-token>
```

不带输出格式的链接是通用订阅，Worker 会按客户端 User-Agent 自动选择格式；也可以显式指定 `mihomo`、`stash`、`surge`、`surge-mac`、`loon`、`qx`、`sing-box`、`uri`、`json` 等输出格式。

临时转换：

```text
https://substore.example.com/download/source/<source-id>?token=<download-token>&url=https%3A%2F%2Fexample.com%2Fsub
https://substore.example.com/download/source/<source-id>/sing-box?token=<download-token>&content=<url-encoded-node-text>
```

`url` 会临时替换该订阅源的远程订阅地址，`content` 会临时按本地节点文本解析，`ua` 会临时覆盖拉取远程订阅时使用的 User-Agent。临时参数只影响本次请求，不会写入 D1。

## 配置模型

| 概念 | 作用 |
| --- | --- |
| Sources | 远程订阅 URL 或本地节点文本。 |
| Collections | 多个 Sources 的组合订阅。 |
| Filters | 节点包含、排除、正则删除、重命名、去重、排序、域名解析、旗帜和常用属性设置。 |
| Templates | Mihomo / Stash 的代理组、规则提供者和规则列表。 |

Source、Collection 和自定义 Template 的 ID 只能使用 1–64 位小写字母、数字、下划线或连字符。Collection 的 `sourceIds` 为空时表示包含全部已启用 Sources；如果只想包含指定来源，请显式列出 ID。

输入格式：

- 远程订阅：每行一个 `http(s)` URL，多个 URL 会合并。
- 本地节点：支持单行 URI、Mihomo YAML、JSON/JSON5 代理数组、常见 Surge/Loon/Quantumult X 单行节点，也支持完整 Base64 内容。
- 常用 URI：`ss`、`ssr`、`vmess`、`vless`、`trojan`、`hysteria`、`hysteria2`、`tuic`、`anytls`、`http`、`socks5`、`wireguard`。

输出格式：

- Mihomo / Stash：YAML 输出，支持模板里的代理组、规则提供者和规则列表。
- Surge / Surge Mac / Surfboard / Loon / Quantumult X：常见文本节点格式输出。
- Shadowrocket / URI：通用 URI 列表。
- sing-box：基础 JSON 配置。
- v2ray：Base64 URI 列表。
- JSON：处理后的节点数组，适合调试和二次处理。

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
pnpm run deploy:dry-run
```

这两个命令是本仓库的本地发布 gate：检查 Worker 和测试类型、运行 Workers/D1 集成测试、构建前端、审计生产依赖、启动真实本地 Worker、验证 agent seed / deploy config / Worker contract，并扫描当前文件和 `main` 历史里的常见发布风险。仓库不使用 GitHub Actions 或 Dependabot。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=realchendahuang/sub-store-cloudflare&type=Date)](https://www.star-history.com/#realchendahuang/sub-store-cloudflare&Date)

## 致谢

本项目的前端交互和订阅管理思路参考并致敬 [sub-store-org/Sub-Store](https://github.com/sub-store-org/Sub-Store)。原版 Sub-Store 是功能完整的订阅管理项目，覆盖了更广的运行环境和客户端生态；这个仓库选择更小的 Cloudflare-native 形态，方便直接部署和二次修改。

## License

见 [LICENSE](LICENSE) 和 [NOTICE](NOTICE)。
