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

A small Cloudflare Workers app for subscription aggregation, cloud-side node processing, and routing templates.

Chinese is the primary documentation language for this repository. See [README.md](README.md).

## Docs

- [Deployment](docs/deployment.md)
- [AI Agent install](docs/ai-agent-install.md)
- [Product scope](docs/product-scope.md)
- [Architecture](docs/architecture.md)
- [Upstream compatibility matrix](docs/upstream-compatibility.md)
- [Testing and release gates](docs/testing.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Release process](docs/release.md)
- [Roadmap](ROADMAP.md)
- [Governance](GOVERNANCE.md)
- [Contributing](CONTRIBUTING.md)
- [Support](SUPPORT.md)
- [Security](SECURITY.md)
- [Changelog](CHANGELOG.md)

## Fastest Install

### Deploy to Cloudflare

Click the button above. Cloudflare will clone this public repository into your GitHub/GitLab account, provision the Worker and D1 database, and deploy the app.

The deployment flow asks for two secrets:

- `SUB_STORE_ADMIN_TOKEN`: admin UI and `/api/*` token.
- `SUB_STORE_PUBLIC_DOWNLOAD_TOKEN`: `/download/*` subscription token.

Generate tokens with:

```bash
openssl rand -base64 32
```

Open the deployed app with:

```text
https://<your-worker>.<your-subdomain>.workers.dev/?token=<admin-token>
```

Then add sources, collections, filters, and templates in the web UI.

Note: this is Cloudflare's hosted template import flow. Cloudflare may configure Workers Builds inside your copied repository for future deployments. This upstream repository does not use GitHub Actions, Dependabot, or GitHub CI/CD.

### Agent / CLI Install

For local agent-assisted installs with seeded sources and collections:

```bash
pnpm run install:cloudflare
```

The installer validates the local setup, checks Cloudflare login, creates or reuses D1, renders local Wrangler config, sets Worker secrets, migrates D1, deploys the Worker, imports `config/agent-setup.local.json`, verifies HTTP endpoints, and prints ready-to-copy URLs. Generated tokens are persisted in the gitignored local setup so a failed run does not silently rotate them.

If Cloudflare is not available yet:

```bash
pnpm --dir cloudflare exec wrangler login
pnpm run install:cloudflare
```

For Codex, Claude Code, or another local coding agent, copy [agent/install.prompt.md](agent/install.prompt.md).

## What It Does

- Manages remote subscription URLs and local node text.
- Combines multiple sources into one cloud-side collection.
- Filters by region, type, and regex; renames, deletes matched name text, deduplicates, regex-sorts, resolves node hostnames, adds/removes flags, and applies common node options.
- Runs JavaScript filters/operators bundled with the Worker; built-ins are selectable in the UI and personal scripts are redeployed through the CLI installer.
- Provides built-in Mihomo routing templates and supports custom JSON/YAML templates.
- Previews original and processed node lists in the admin UI.
- Supports subscription usage info, config backup/restore, User-Agent options, pass-through User-Agent, timeout, and remote fetch concurrency.
- Supports temporary `url`, `content`, and `ua` download parameters for one-off conversion.
- Adds an admin Tools page for unsaved proxy/subscription conversion and Mihomo, Surge, Loon, and Quantumult X rule conversion.
- Provides scoped expiring download grants, a bounded 50-entry recycle bin, allowlisted response metadata propagation, and optional Workers Cache API caching.
- Looks up node IP, region, organization, and ASN through a configurable HTTPS provider.
- Outputs Mihomo, Stash, Surge, Surge Mac, Surfboard, Loon, Egern, Shadowrocket, Quantumult X, sing-box, v2ray, URI, and JSON.

Source, collection, and custom template IDs use 1–64 lowercase letters, numbers, underscores, or hyphens. An empty collection `sourceIds` array means all enabled sources; list IDs explicitly to select only specific sources.

The deployment model remains small: Workers Static Assets + Worker API + D1 + Worker Secrets, with the Cache API as an optional non-durable optimization.

## Local Development

Requires Node.js 22 and pnpm 11. This repository includes `.node-version` and a `packageManager` field.

```bash
pnpm run setup
cp cloudflare/.dev.vars.example cloudflare/.dev.vars
pnpm run build:frontend
pnpm run dev
```

Open:

```text
http://localhost:8787/?token=dev-admin-token
```

## Manual Deploy

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

See [docs/deployment.md](docs/deployment.md) and [docs/ai-agent-install.md](docs/ai-agent-install.md).

## Release Checks

```bash
pnpm run check:release
pnpm run deploy:dry-run
```

These local commands are the release gate. They cover Worker and test types, Workers/D1 integration tests, the frontend production build, production dependency audits, a real local Worker startup smoke test, deploy contracts, and privacy checks. The upstream repository intentionally does not use GitHub Actions or Dependabot.

## Acknowledgements

This project is inspired by and pays respect to [sub-store-org/Sub-Store](https://github.com/sub-store-org/Sub-Store). The original project is the full-featured subscription management system; this repository focuses on a smaller Cloudflare-native deployment.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=realchendahuang/sub-store-cloudflare&type=Date)](https://www.star-history.com/#realchendahuang/sub-store-cloudflare&Date)

See [LICENSE](LICENSE) and [NOTICE](NOTICE).
