# Changelog

All notable changes to this project will be documented in this file.

This project follows semantic versioning where practical.

## [0.1.1] - 2026-06-28

### Changed

- Removed repository GitHub Actions and Dependabot so the upstream project does not depend on GitHub automation.
- Kept lightweight GitHub issue forms and a pull request template for contributor intake; they do not run CI/CD.
- Clarified that the Cloudflare Deploy Button is the Cloudflare-hosted template import path, while `pnpm run install:cloudflare` is the local Agent/CLI deployment path.
- Updated Worker compatibility dates and documented the Node 22 + pnpm local development baseline.

### Verification

- Local release checks and Wrangler dry-run deployment remain the release gate.

## [0.1.0] - 2026-06-28

### Added

- Cloudflare-native Worker application with Static Assets, Worker API, D1, and Worker Secrets.
- Source and collection management for remote subscription URLs and local node text.
- Node filters for include/exclude, rename, delete-field, dedupe, sort, regex-sort, flag handling, quick options, and DNS resolve workflows.
- Built-in routing templates for Mihomo-compatible YAML output.
- Output targets for Mihomo, Stash, Surge, Surge Mac, Surfboard, Loon, Egern, Shadowrocket, Quantumult X, sing-box, v2ray, URI, and JSON.
- Preview, backup/restore, temporary `url` / `content` / `ua` conversion parameters, and subscription usage metadata.
- Deploy to Cloudflare button support with root `wrangler.jsonc`.
- Agent/CLI installer via `pnpm run install:cloudflare`.
- Release checks for Worker/frontend builds, agent setup, deployment config, worker contract, module format, open-source hygiene, and git history privacy.

### Documentation

- Added deployment, AI agent install, architecture, and product-scope documentation.
- Added contributing, support, security, code of conduct, release notes, and local release checks.
