# Sub-Store Cloudflare

[![Release](https://img.shields.io/github/v/release/realchendahuang/sub-store-cloudflare?include_prereleases&sort=semver)](https://github.com/realchendahuang/sub-store-cloudflare/releases)
[![License: AGPL-3.0](https://img.shields.io/github/license/realchendahuang/sub-store-cloudflare)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/workers/)
[![D1](https://img.shields.io/badge/Storage-D1-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/d1/)
[![Workers Free](https://img.shields.io/badge/Designed_for-Workers_Free-2F7DFF)](docs/upstream-compatibility.md)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/realchendahuang/sub-store-cloudflare)

把机场订阅、自建节点、节点处理和分流模板放到你自己的 Cloudflare Worker 中，最终只给客户端一个订阅链接。

项目采用 Workers Static Assets + Worker API + D1 + Worker Secrets，按 Cloudflare 免费版边界设计并验证。无需自建服务器，也不需要 KV、R2、Durable Objects、Queues 或 Cron。

English: [README.en.md](README.en.md)

## 最快部署：三步完成

### 1. 准备两个不同的随机 Token

使用密码管理器生成，或者在安装了 Node.js 的电脑运行：

```bash
node --input-type=module -e "import{randomBytes as r}from'node:crypto';console.log(r(32).toString('base64url'));console.log(r(32).toString('base64url'))"
```

第一行用于 `SUB_STORE_ADMIN_TOKEN`，第二行用于 `SUB_STORE_PUBLIC_DOWNLOAD_TOKEN`。不要使用 README、截图或示例里的固定字符串。

### 2. 点击 Deploy to Cloudflare

点击上面的按钮。Cloudflare 会：

- 把仓库导入到你的 GitHub/GitLab 账号；
- 创建 Worker；
- 自动创建或选择 D1 数据库；
- 要求你填写两个 Token；
- 执行 `pnpm run build` 和 `pnpm run deploy`。

两个 Secret 输入框必须填写你刚生成的不同随机值。

### 3. 打开管理页面

部署成功后点击 Cloudflare 给出的 Worker 地址，并在地址后添加：

```text
/#token=<SUB_STORE_ADMIN_TOKEN>
```

首次进入会显示三步引导：添加 Source → 确认默认 Daily → 复制订阅链接。

完整图文步骤见 [五分钟快速开始](docs/quick-start.md)。

## 选择哪种安装方式

| 你的情况 | 推荐方式 | 入口 |
| --- | --- | --- |
| 只想最快跑起来，之后在网页配置 | Deploy to Cloudflare | README 顶部按钮 |
| 想在终端按提示完成部署 | 交互式 CLI | `pnpm run install:cloudflare` |
| 想先部署空应用，之后在网页配置 | CLI 快速模式 | `pnpm run install:quick` |
| 想让 Codex / Claude Code 导入订阅并返回链接 | Agent 安装 | [复制安装提示词](agent/install.prompt.md) |
| 想完全控制 D1、Secret 和域名 | 手动 Wrangler | [部署说明](docs/deployment.md) |

### 交互式 CLI

需要 Git、Node.js 22+ 和 Corepack：

```bash
git clone https://github.com/realchendahuang/sub-store-cloudflare.git
cd sub-store-cloudflare
corepack enable
pnpm run install:cloudflare
```

安装器会询问 Worker 名称、自定义域名和可选订阅 URL，然后自动安装依赖、登录检查、创建 D1、生成 Token、迁移、部署、导入并验证。

只想部署空应用：

```bash
pnpm run install:quick
```

需要单独生成两个跨平台 Token：

```bash
pnpm run tokens:generate
```

### AI Agent 安装

把 [agent/install.prompt.md](agent/install.prompt.md) 的提示词发给 Codex、Claude Code 或其他本地编程 Agent。Agent 会把私有配置写入被 Git 忽略的 `config/agent-setup.local.json`，再运行同一个安装器。

非交互环境缺少该配置时，安装器会停止而不是部署示例订阅 URL。

## 部署后的五分钟

1. 在“订阅”页添加远程订阅 URL 或本地节点文本。
2. 确认预置的 `Daily` Collection；需要其他组合时再新建，模板可选 `acl4ssr-mihomo`。
3. 保守起步只使用清理信息节点、端点去重和名称排序。
4. 在 Collection 卡片复制 Mihomo、sing-box、Surge 等链接。
5. 在“设置”页导出一次配置备份，并妥善保存两个 Token。

## 主要能力

- 远程订阅、本地节点、组合订阅和自定义模板。
- 区域、类型和正则过滤，重命名、删除、去重、排序、域名解析和旗帜处理。
- 构建时 JavaScript Filter / Operator；不使用运行时 `eval()`。
- JSON/JSON5、Mihomo YAML、URI、Surge/Loon/Quantumult X 等输入。
- Mihomo、Stash、Surge、Surge Mac、Surfboard、Loon、Egern、Shadowrocket、Quantumult X、sing-box、v2ray、URI 和 JSON 输出。
- 一次性节点/订阅转换和规则转换工具。
- 独立、限时、可撤销、可限制格式的下载授权。
- 最多 50 条的配置回收站。
- 订阅元数据透传、Workers Cache API 缓存和失败回退。
- 配置备份/恢复以及节点地区、组织和 ASN 查询。

原版兼容状态和明确排除项见 [兼容矩阵](docs/upstream-compatibility.md)。

## 升级

Deploy Button 会在你的账号中创建仓库副本，但不会自动合并本仓库的新版本。不要通过新建第二套 Worker/D1 来代替正常升级。

不同安装方式的升级、D1 migration、备份和回滚步骤见 [升级指南](docs/upgrading.md)。

## 常用文档

- [五分钟快速开始](docs/quick-start.md)
- [部署说明](docs/deployment.md)
- [升级指南](docs/upgrading.md)
- [AI Agent 安装](docs/ai-agent-install.md)
- [JavaScript Filter / Operator](docs/script-plugins.md)
- [原版兼容矩阵](docs/upstream-compatibility.md)
- [产品边界](docs/product-scope.md)
- [故障排查](docs/troubleshooting.md)
- [架构说明](docs/architecture.md)
- [测试与发布检查](docs/testing.md)
- [变更记录](CHANGELOG.md)

全部文档见 [docs/README.md](docs/README.md)。

## 本地开发

```bash
corepack enable
pnpm run setup
cp cloudflare/.dev.vars.example cloudflare/.dev.vars
pnpm run build:frontend
pnpm run dev
```

访问：

```text
http://localhost:8787/#token=dev-admin-token
```

## 隐私与安全

- 不要提交订阅 URL、节点 URI、Token、私有 D1 ID 或生成的 seed SQL。
- 管理端和 `/api/*` 使用 admin token；`/download/*` 使用 download token。
- 项目不会从网页、D1 或远程 URL 动态执行任意 JavaScript。
- 发布或提 issue 前请先看 [SECURITY.md](SECURITY.md) 和 [故障排查](docs/troubleshooting.md)。

## 致谢与许可

本项目参考并致敬 [sub-store-org/Sub-Store](https://github.com/sub-store-org/Sub-Store)。原版覆盖更广的运行环境和功能；本仓库专注可直接部署的 Cloudflare-native 兼容版本。

见 [LICENSE](LICENSE) 和 [NOTICE](NOTICE)。
