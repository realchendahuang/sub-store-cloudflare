# 五分钟快速开始

目标：从一个空的 Cloudflare 账号部署 Sub-Store Cloudflare，创建第一个组合订阅，并复制到客户端。

## 准备

你需要：

- Cloudflare 账号；
- GitHub 或 GitLab 账号；
- 两个不同的随机 Token；
- 至少一个远程订阅 URL，或者一段本地节点文本。

这个项目按 Workers Free 使用边界设计，但 Cloudflare 账号的实际用量和计费状态仍以你的控制台为准。

## 第一步：生成两个 Token

使用密码管理器生成两个至少 32 字节的随机值，或者运行：

```bash
node --input-type=module -e "import{randomBytes as r}from'node:crypto';console.log(r(32).toString('base64url'));console.log(r(32).toString('base64url'))"
```

- 第一行：`SUB_STORE_ADMIN_TOKEN`
- 第二行：`SUB_STORE_PUBLIC_DOWNLOAD_TOKEN`

两个值必须不同。把它们保存到密码管理器，不要发到 issue、聊天群或截图里。

如果已经克隆仓库，也可以运行：

```bash
pnpm run tokens:generate
```

## 第二步：部署到 Cloudflare

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/realchendahuang/sub-store-cloudflare)

在 Cloudflare 部署页确认：

1. 项目名称可以使用默认的 `sub-store-cloudflare`。
2. D1 选择自动创建的新数据库；只有升级已有部署时才选择原数据库。
3. `SUB_STORE_ADMIN_TOKEN` 填管理 Token。
4. `SUB_STORE_PUBLIC_DOWNLOAD_TOKEN` 填下载 Token。
5. 构建命令是 `pnpm run build`。
6. 部署命令是 `pnpm run deploy`。

Secret 输入框不应该出现可直接使用的公开默认值。如果看到 `replace-with-...` 一类固定字符串，请不要部署，并到仓库 issue 反馈。

点击部署后，Cloudflare 会自动 provision D1、运行 migrations、构建前端并部署 Worker。

## 第三步：进入管理页面

部署成功后，Cloudflare 会显示 Worker 地址，例如：

```text
https://sub-store-cloudflare.<你的子域>.workers.dev
```

第一次进入使用：

```text
https://sub-store-cloudflare.<你的子域>.workers.dev/?token=<admin-token>
```

前端读取 Token 后会把它从地址栏移除，并保存在当前浏览器中用于后续管理请求。

如果页面显示“数据加载失败”，输入 `SUB_STORE_ADMIN_TOKEN`，不要输入下载 Token。

## 第四步：添加第一个 Source

在首次使用卡片点击“添加第一个订阅源”。

远程订阅：

1. ID 使用小写字母、数字、下划线或连字符，例如 `airport-a`。
2. 类型选择远程订阅。
3. 粘贴订阅 URL。
4. 可以先加入“清理信息节点”操作。
5. 保存后回到订阅列表。

本地节点：

1. 类型选择本地内容。
2. 粘贴 `vless://`、`trojan://`、`ss://`、Mihomo YAML、JSON/JSON5 或其他支持内容。
3. 保存并确认预览能识别节点。

## 第五步：确认默认 Daily Collection

Migration 会预置一个包含全部已启用 Source 的 `Daily` Collection。添加 Source 后可以直接编辑它：

1. 不选择指定 Source 时，默认包含全部已启用 Source。
2. 模板推荐 `acl4ssr-mihomo`。
3. 建议先启用端点去重和名称排序。
4. 保存。

只有需要不同来源组合或不同模板时，才新建其他 Collection。

区域 include 过滤器会删除其他地区节点，第一次使用不要急着添加。

## 第六步：复制客户端链接

在 Collection 卡片打开快捷操作，选择需要的目标：

- Mihomo / Clash Meta：`mihomo`
- sing-box：`sing-box`
- Surge：`surge` 或 `surge-mac`
- Loon：`loon`
- Quantumult X：`qx`
- 通用 URI：`uri`

下载链接使用 `SUB_STORE_PUBLIC_DOWNLOAD_TOKEN`。不要把 admin token 放进客户端订阅链接。

## 最后做两件事

1. 到“设置”页面导出一次完整配置备份。
2. 阅读 [升级指南](upgrading.md)，了解 Deploy Button 仓库副本如何获取新版本。

遇到问题先看 [故障排查](troubleshooting.md)。
