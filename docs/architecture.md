# 架构说明

Sub-Store Cloudflare 是一个单 Worker 应用：管理界面由 Worker Static Assets 托管，配置 API 和订阅输出由同一个 Worker 处理，结构化配置保存在 D1。

## 运行边界

```text
Cloudflare Worker
  |
  |-- Static Assets                  Vue 管理界面
  |-- /api/env                       环境信息
  |-- /api/settings                  前端设置
  |-- /api/storage                   备份与恢复
  |-- /api/sources                   订阅源
  |-- /api/collections               组合订阅
  |-- /api/templates                 分流模板
  |-- /api/preview/*                 节点预览
  |-- /download/source/:id[/:target]   单订阅源输出
  |-- /download/collection/:id[/:target] 组合订阅输出
  |
  |-- D1                             sources / collections / templates / app_settings
  |-- Worker Secrets                 管理端 token / 下载 token
```

核心路径只需要 Workers、D1 和 Secrets。KV、R2、Durable Objects、Queue、Cron 都不是必要组件。

## 数据模型

| 表 | 作用 |
| --- | --- |
| `sources` | 保存远程订阅 URL 或本地节点文本。 |
| `collections` | 保存订阅源组合、过滤器和默认模板。 |
| `templates` | 保存规则模板，包括代理组、规则提供者和规则列表。 |
| `app_settings` | 保存远程订阅请求参数、主题和必要的前端默认状态。 |

## 输出流程

```text
客户端请求 /download/collection/:id[/:target]
  |
  |-- 校验下载 token
  |-- 读取 collection
  |-- 应用请求级临时输入参数 url / content / ua
  |-- 拉取 collection 里的 sources
  |-- 解析节点
  |-- 应用 source filters
  |-- 合并
  |-- 应用 collection filters
  |-- 确保节点名唯一
  |-- 套用 template
  |-- 输出 mihomo / stash / surge / loon / qx / shadowrocket / sing-box / v2ray / uri / json
```

`target` 可省略；省略时 Worker 会根据客户端 User-Agent 自动选择输出格式，无法识别时默认输出 Mihomo。`/download/source/:id[/:target]` 走同一套解析和过滤逻辑，只是不读取 collection。

下载请求可以附加 `url`、`content` 和 `ua`：

- `url`：临时替换当前订阅源的远程订阅地址。
- `content`：临时按本地节点文本解析。
- `ua` / `userAgent`：临时覆盖拉取远程订阅时使用的 User-Agent。

这些参数只影响当前请求，不写入 D1。组合订阅会把临时输入应用到组合里第一个选中的订阅源，然后继续执行组合级过滤器和模板。

远程订阅的 User-Agent 优先级是：订阅源自定义 `ua` / 临时 `ua` 参数 > 透传下载请求的 User-Agent > 全局默认 User-Agent。

## 输入与核心能力

远程订阅只负责拉取 `http(s)` URL，多个 URL 可以按行填写并合并。本地订阅支持单行 URI、Mihomo YAML、JSON 代理数组、常见 Surge/Loon/Quantumult X 单行节点和完整 Base64 内容。常用 URI 包括 `ss`、`ssr`、`vmess`、`vless`、`trojan`、`hysteria`、`hysteria2`、`tuic`、`anytls`、`http`、`socks5`、`wireguard`。

这版保留的核心能力是：

- 订阅源管理和组合订阅。
- 节点解析、过滤、重命名、去重、排序、域名解析、旗帜和常用属性设置。
- Mihomo 规则模板和自定义模板。
- 原始/处理后节点预览，本地节点校验。
- 下载链接级临时输入和一次性格式转换。
- 单订阅源自定义 User-Agent 和透传 User-Agent。
- 订阅流量信息、配置备份与恢复。
- Mihomo、Stash、Surge、Surge Mac、Surfboard、Loon、Egern、Shadowrocket、Quantumult X、sing-box、v2ray、URI、JSON 输出。

脚本运行、文件托管、Gist 同步、分享、归档、定时任务和日志系统不在核心路径里。

## Filters

过滤器是这版自己的小型 JSON DSL，保存在 D1。前端编辑器会把界面里的动作转换成下面这些结构；Worker 只读取这些结构：

- `include`：按字段和正则保留节点。
- `exclude`：按字段和正则排除节点。
- `rename`：按正则重命名字段，默认字段是 `name`。
- `delete-field`：按正则删除字段里的匹配文本，默认字段是 `name`。
- `dedupe`：按一个或多个字段去重，可以删除重复项，也可以给重复节点重命名。
- `sort`：按节点名排序，也支持随机排序。
- `regex-sort`：按一组正则表达式把节点排到前面。
- `resolve`：请求时用 DoH 把节点域名解析成 IPv4/IPv6，并保留 TLS 节点的原始 SNI。
- `flag`：按节点名识别区域旗帜，或移除已有旗帜。
- `quick`：过滤无效节点，并批量设置 `udp`、`tfo`、`skip-cert-verify`、`vmess aead` 等常用属性。

示例：

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

## Templates

模板保存在 D1，只应用于 Mihomo、Stash 和 Surge Mac 这类 YAML 输出。导入接口接受 JSON 或 YAML；常见 Mihomo YAML 键名会归一化成内部配置。

- `mixedPort`
- `mixed-port`
- `allowLan`
- `allow-lan`
- `mode`
- `logLevel`
- `log-level`
- `dns`
- `sniffer`
- `proxyGroups`
- `proxy-groups`
- `ruleProviders`
- `rule-providers`
- `rules`

`proxyGroups[].proxies` 或 `proxy-groups[].proxies` 里可以使用 `$all`，生成时会展开为当前组合订阅里的全部节点。Surge、Surfboard、Loon、Egern、Shadowrocket、Quantumult X、sing-box、v2ray、URI 和 JSON 输出使用同一套节点解析与过滤结果，但不读取 Mihomo 规则模板。

## 为什么只用 D1

这个项目的数据是结构化配置，主要是订阅源、组合关系、过滤器和规则模板。D1 可以直接表达这些关系，也方便迁移和导出。大文件、后台任务和跨请求状态都不是核心路径，因此不默认引入其他 Cloudflare 存储或异步组件。

## 上游关系

完整订阅管理系统请参考 [sub-store-org/Sub-Store](https://github.com/sub-store-org/Sub-Store)。本项目保留核心管理体验和订阅生成链路，部署形态收敛到 Cloudflare Workers。
