# 产品边界

Sub-Store Cloudflare 是一个云端订阅配置器，不是完整 Sub-Store 的逐项复刻，也不是 Cloudflare 功能展示项目。

它解决的问题只有一个：把订阅源、节点处理、组合订阅和规则模板放到服务端维护，然后给客户端一个可直接使用的订阅链接。

## 核心循环

```text
添加订阅源
  -> 解析节点
  -> 过滤 / 重命名 / 去重 / 排序
  -> 组合多个订阅源
  -> 套用规则模板
  -> 预览校验
  -> 复制下载链接
```

只要一项能力不能自然落到这条链路里，就不属于默认范围。

## 保留的能力

- 远程订阅 URL 和本地节点文本。
- 单订阅源和组合订阅。
- 常用节点过滤、重命名、正则删除、去重、排序、旗帜处理、域名解析和常用属性设置。
- 随 Worker 编译的 JavaScript Filter / Operator；内置脚本经过免费版验证，个人脚本需要重新部署。
- Mihomo / Stash 规则模板，以及可导入的自定义模板。
- 原始节点和处理后节点预览，本地节点格式校验。
- Mihomo、Stash、Surge、Surfboard、Loon、Egern、Shadowrocket、Quantumult X、sing-box、v2ray、URI 和 JSON 输出。
- 部署级下载 token、独立限时下载授权、管理端 token、配置备份与恢复。
- 不落库的一次性节点/规则转换和有 50 条上限的配置回收站。
- 远程订阅允许元数据透传和可自动降级的 Cache API 边缘缓存。
- 远程订阅 User-Agent、透传 User-Agent、超时和并发设置。
- 下载链接级临时 `url`、`content`、`ua` 参数，用于一次性复用当前过滤器、模板和输出格式。

这些能力都服务于“生成最终订阅链接”这条主线。

## 构建时脚本边界

JavaScript Filter / Operator 随 Worker 一起由 Wrangler 编译，D1 只保存脚本 ID 和参数，不在请求期间执行来自网页、D1 或远程 URL 的代码字符串。

项目只承诺经过 Cloudflare Workers 免费版性能验证的内置脚本。个人脚本需要通过 Agent / CLI installer 重新部署，并属于部署者信任的应用代码，不是沙箱中的不可信输入。用法见 [script-plugins.md](script-plugins.md)，完整设计见 [superpowers/specs/2026-07-11-build-time-script-compatibility-design.md](superpowers/specs/2026-07-11-build-time-script-compatibility-design.md)。

## 不默认加入的能力

- 文件托管和文件管理。
- Gist / GitLab / 第三方同步。
- 公开分享平台。单资源、可撤销、可过期的私有下载授权属于核心下载链路。
- 无上限归档和历史版本系统。最多 50 条配置快照的回收站属于误删保护。
- 运行时脚本字符串、远程脚本加载和脚本市场。构建时打包的受限 Filter / Operator 按上面的免费版设计单独评估。
- 日志面板。
- 队列、定时任务、后台 artifact 生成。
- KV、R2、Durable Objects、Queues、Cron 等额外 Cloudflare 组件。Workers Cache API 只作为非持久优化。
- 多后端兼容层或完整上游 API 兼容层。

这些能力在原版 Sub-Store 里有各自价值，但会把这个仓库从“订阅配置器”推向更大的平台型系统。

## 如何借鉴原版

原版 [sub-store-org/Sub-Store](https://github.com/sub-store-org/Sub-Store) 是完整订阅管理系统。这个仓库只借鉴和保留与核心循环有关的部分：

- 订阅源 / 组合订阅的编辑体验。
- 动作式节点处理编辑器。
- 多客户端输出格式。
- 预览、复制链接、导入导出这些日常操作。

不为已经删掉的上游模块保留空壳 UI、兼容接口或占位配置。

## 新功能判断

新增功能默认需要同时满足：

- 它直接改善最终订阅链接的生成、预览或维护。
- 它能用现有模型表达：`sources`、`collections`、`filters`、`templates`、`settings`。
- 它不要求新增独立存储、后台任务或另一套产品页面。
- 它能在 README 里用一句话解释清楚。
- 它有对应的 Worker 行为、前端入口和验证方式。

如果一项能力主要服务于文件发布、同步平台、分享平台、脚本平台或日志平台，它应该放在项目之外，而不是并进默认产品。
