# 文档索引

- [architecture.md](architecture.md)：Worker + D1 的简化架构、数据模型和输出链路。
- [product-scope.md](product-scope.md)：项目保留什么、不保留什么，以及如何判断新功能是否属于核心范围。
- [deployment.md](deployment.md)：Cloudflare 一键按钮、Agent/CLI installer、手动 Wrangler 部署。
- [ai-agent-install.md](ai-agent-install.md)：让 Codex、Claude Code 等 AI Agent 引导部署、导入配置和处理 Cloudflare 缺失状态。
- [testing.md](testing.md)：本地检查、发布 gate、部署 dry-run 和隐私扫描。
- [release.md](release.md)：发布前检查、tag 和 GitHub Release 流程。
- [../AGENTS.md](../AGENTS.md)：AI Agent 的固定安装协议。
- [../agent/SKILL.md](../agent/SKILL.md)：可复制给 AI Agent 的 skill-like 安装入口。
- [../agent/install.prompt.md](../agent/install.prompt.md)：给 Codex / Claude Code 的一段式安装提示词。
- [../CONTRIBUTING.md](../CONTRIBUTING.md)：贡献指南。
- [../SUPPORT.md](../SUPPORT.md)：支持入口和 issue 信息要求。
- [../SECURITY.md](../SECURITY.md)：安全报告方式。
- [../CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md)：社区行为准则。
- [../CHANGELOG.md](../CHANGELOG.md)：版本变更记录。
- [../config/agent-setup.schema.json](../config/agent-setup.schema.json)：Agent 本地配置 schema。
- [../config/rule-presets.json](../config/rule-presets.json)：内置规则模板和过滤器预设。

第一次部署建议先读根目录 [README.md](../README.md)。普通用户优先用 Cloudflare 官方 Deploy Button；需要导入订阅源和组合订阅时再用 `pnpm run install:cloudflare`。
