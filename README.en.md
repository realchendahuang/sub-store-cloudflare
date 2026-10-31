# Sub-Store Cloudflare

[![Release](https://img.shields.io/github/v/release/realchendahuang/sub-store-cloudflare?include_prereleases&sort=semver)](https://github.com/realchendahuang/sub-store-cloudflare/releases)
[![License: AGPL-3.0](https://img.shields.io/github/license/realchendahuang/sub-store-cloudflare)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/workers/)
[![D1](https://img.shields.io/badge/Storage-D1-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/d1/)
[![Workers Free](https://img.shields.io/badge/Designed_for-Workers_Free-2F7DFF)](docs/upstream-compatibility.md)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/realchendahuang/sub-store-cloudflare)

Run subscription sources, self-hosted nodes, processing actions, and routing templates in your own Cloudflare Worker, then give each client one final subscription URL.

The app uses Workers Static Assets + Worker API + D1 + Worker Secrets and is designed around Workers Free limits. It does not require a separate server, KV, R2, Durable Objects, Queues, or Cron.

Chinese is the primary documentation language: [README.md](README.md).

## Fastest install: three steps

### 1. Prepare two different random tokens

Use a password manager, or run this cross-platform Node.js command:

```bash
node --input-type=module -e "import{randomBytes as r}from'node:crypto';console.log(r(32).toString('base64url'));console.log(r(32).toString('base64url'))"
```

Use the first line for `SUB_STORE_ADMIN_TOKEN` and the second for `SUB_STORE_PUBLIC_DOWNLOAD_TOKEN`. Never deploy fixed values copied from documentation or screenshots.

### 2. Click Deploy to Cloudflare

Cloudflare imports a repository copy into your GitHub/GitLab account, provisions the Worker and D1 database, asks for the two required secrets, and runs `pnpm run build` followed by `pnpm run deploy`.

Both secret fields must contain the different random values you generated.

### 3. Open the admin UI

Open the Worker URL returned by Cloudflare and append:

```text
/#token=<SUB_STORE_ADMIN_TOKEN>
```

The first-run screen guides you through Source → default Daily collection → client download link.

See the Chinese [five-minute quick start](docs/quick-start.md) for the complete walkthrough.

## Choose an install path

| Need | Recommended path | Entry point |
| --- | --- | --- |
| Fastest empty deployment, configure in the browser | Deploy to Cloudflare | Button above |
| Guided terminal deployment | Interactive CLI | `pnpm run install:cloudflare` |
| Empty CLI deployment, configure in the browser | CLI quick mode | `pnpm run install:quick` |
| Import sources through Codex or Claude Code | Agent install | [Install prompt](agent/install.prompt.md) |
| Full control over D1, secrets, and domains | Manual Wrangler | [Deployment guide](docs/deployment.md) |

### Interactive CLI

Requires Git, Node.js 22+, and Corepack:

```bash
git clone https://github.com/realchendahuang/sub-store-cloudflare.git
cd sub-store-cloudflare
corepack enable
pnpm run install:cloudflare
```

The installer can collect deployment names, domains, and optional remote subscription URLs. It then installs dependencies, checks Cloudflare login, creates or reuses D1, generates tokens, migrates, deploys, seeds, verifies, and prints ready-to-copy URLs.

For an empty web-configured deployment:

```bash
pnpm run install:quick
```

Generate both deployment tokens with:

```bash
pnpm run tokens:generate
```

Non-interactive Agent runs without `config/agent-setup.local.json` stop before deployment instead of importing example subscription URLs.

## First five minutes after deployment

1. Add a remote subscription or local node text on the Subscriptions page.
2. Review the pre-created `Daily` Collection; create another only when needed. `acl4ssr-mihomo` is the recommended template.
3. Start with cleanup, endpoint dedupe, and name sorting filters.
4. Copy the Mihomo, sing-box, Surge, or other link from the Collection card.
5. Export a backup from Settings and store both tokens safely.

## Highlights

- Remote sources, local nodes, collections, filters, and routing templates.
- Build-time JavaScript Filter / Operator support without runtime `eval()`.
- JSON/JSON5, Mihomo YAML, URI, and common Surge/Loon/Quantumult X input.
- Mihomo, Stash, Surge, Surge Mac, Surfboard, Loon, Egern, Shadowrocket, Quantumult X, sing-box, v2ray, URI, and JSON output.
- One-shot proxy/subscription and rule conversion tools.
- Scoped expiring download grants and a bounded 50-entry recycle bin.
- Safe subscription metadata propagation, optional Cache API caching, backup/restore, and node location/ASN lookup.

See the [upstream compatibility matrix](docs/upstream-compatibility.md) for tested support and explicit exclusions.

## Upgrades

A Deploy Button install creates a repository copy in your account; upstream releases are not merged automatically. Do not create a second Worker and D1 database as the default upgrade method.

See [docs/upgrading.md](docs/upgrading.md) for repository sync, D1 migrations, backups, and rollback.

## Documentation

- [Five-minute quick start](docs/quick-start.md)
- [Deployment](docs/deployment.md)
- [Upgrading](docs/upgrading.md)
- [AI Agent install](docs/ai-agent-install.md)
- [JavaScript Filter / Operator](docs/script-plugins.md)
- [Compatibility matrix](docs/upstream-compatibility.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Architecture](docs/architecture.md)
- [All docs](docs/README.md)

## Local development

```bash
corepack enable
pnpm run setup
cp cloudflare/.dev.vars.example cloudflare/.dev.vars
pnpm run build:frontend
pnpm run dev
```

Open `http://localhost:8787/#token=dev-admin-token`.

Never commit subscription URLs, node URIs, tokens, private D1 IDs, or generated seed SQL. See [SECURITY.md](SECURITY.md), [LICENSE](LICENSE), and [NOTICE](NOTICE).
