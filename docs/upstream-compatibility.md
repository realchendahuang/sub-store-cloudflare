# 原版 Sub-Store 兼容矩阵

Sub-Store Cloudflare v1.0.0 是面向 Cloudflare Workers 免费版的兼容版本，不是把原版 Node.js 后端原样塞进 Worker。下面的“支持”都对应真实 Worker 行为和测试，不代表只保留了同名 UI。

## 订阅输入与输出

| 能力 | v1.0.0 状态 | 说明 |
| --- | --- | --- |
| URI / Base64 订阅 | 支持 | SS、SSR、VMess、VLESS、Trojan、Hysteria、Hysteria2、TUIC、AnyTLS、HTTP、SOCKS5、WireGuard。 |
| Mihomo / Clash YAML | 支持 | `proxies` 节点数组会归一化；未知结构化节点会保留给 Mihomo/JSON。 |
| JSON / JSON5 | 支持 | 支持注释、尾逗号和单引号 JSON5，不执行 JavaScript。 |
| Surge / Loon / QX 单行节点 | 支持 | 支持主流类型，并增加 Snell、SSH、H2 CONNECT 的结构化输入。 |
| Mihomo / Stash | 支持 | 支持内置和自定义规则模板。 |
| Surge / Surge Mac / Surfboard | 支持 | Surge Mac 是独立目标，并可输出 Snell、SSH、H2 CONNECT。 |
| Loon / Egern / Shadowrocket / QX | 支持 | 不可表达的节点不会生成畸形行。 |
| sing-box / V2Ray / URI / JSON | 支持 | JSON 适合兼容诊断和二次处理。 |

不同客户端的协议能力并不相同。一次性转换接口会返回 `parsed`、`emitted`、`skipped` 和有限警告；当目标客户端无法表达全部节点时，会明确给出跳过数量。

## 节点处理

- 区域、类型、正则包含/排除。
- 正则重命名和删除。
- 去重、普通排序和正则排序。
- 旗帜处理、域名解析和常用属性设置。
- 构建时 JavaScript Filter / Operator。
- 原始节点和处理后节点预览。
- 失败远程来源跳过策略。

运行时脚本、远程脚本和网页粘贴执行仍不支持。个人脚本通过 CLI 打包后重新部署。

## v1.0.0 新增的原版工作流

### 一次性节点和规则转换

管理端“工具”页面和管理员 API 可以在不写入 D1 的情况下转换内容：

```text
POST /api/proxy/parse
POST /api/rule/parse
```

节点转换目标包含全部订阅输出目标。规则转换覆盖常见 Domain、Domain Suffix、Domain Keyword、IP-CIDR、IP-CIDR6、GEOIP、GEOSITE、Process、Port 和 Match/Final 规则，输出 Mihomo、Surge、Loon 或 Quantumult X。

### 远程订阅元数据和边缘缓存

下载响应会安全透传 `subscription-userinfo`、`profile-web-page-url`、`profile-update-interval` 和安全化的文件名。

远程订阅默认使用 300 秒 Workers Cache API 边缘缓存。缓存键使用订阅 URL 与 User-Agent 的 SHA-256，不暴露订阅 token。设置页面可以关闭缓存、修改 TTL，或关闭上游失败时的最近缓存回退。Cache API 是非持久优化；不可用时会自动回到直接拉取。下载链接可以附加 `refresh=1` 强制刷新。

### 独立分享链接

管理端可以为一个 Source 或 Collection 创建独立下载授权：可限制输出目标、设置有效期、停用和删除。明文 token 只在创建时返回，D1 只保存 SHA-256 token hash。

这是一套私有下载授权，不是公开分享平台。原来的部署级下载 token 保持兼容。

### 有上限的回收站

删除 Source、Collection、自定义 Template 或独立分享授权时，会保存配置快照。回收站最多保留 50 条，支持恢复和彻底删除；恢复遇到同名 ID 会报冲突，不会覆盖现有配置。

回收站不保存远程订阅响应、生成结果、明文 token 或请求日志。

### 节点信息

预览节点详情可以查询 IP、国家、地区、城市、组织和 ASN。默认 HTTPS 服务是 `https://ipwho.is/{ip}`，可以在设置中替换。使用时节点服务器地址会发送给配置的第三方服务；查询失败不影响预览或订阅下载。

## 明确不兼容

- 通用文件托管和文件管理。
- Artifact 仓库及定时生成。
- Gist、GitLab 和第三方自动同步。
- 运行时 JavaScript、远程脚本和脚本市场。
- D1 持久请求日志。
- 无限历史版本。
- 多用户账号和公开分享平台。
- KV、R2、Durable Objects、Queues、Cron 或第二个后端。

这些模块会突破当前免费版 CPU、存储、隐私或产品边界，因此不会用空路由伪装兼容。
