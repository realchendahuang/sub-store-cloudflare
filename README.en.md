# Sub-Store Cloudflare

A small Cloudflare Workers app for subscription aggregation and cloud-side routing templates.

Chinese is the primary documentation language for this repository. See [README.md](README.md).

## What It Does

- Manages remote subscription URLs and local node text.
- Combines multiple sources into one cloud-side collection.
- Filters by region, type, and regex; renames, deletes matched name text, deduplicates, regex-sorts, adds/removes flags, and applies common node options.
- Provides built-in Mihomo routing templates and supports custom JSON/YAML templates.
- Previews original and processed node lists in the admin UI, with local node validation.
- Supports subscription usage info, config backup/restore, and request options such as User-Agent, timeout, and remote fetch concurrency.
- Outputs Mihomo, sing-box, v2ray, URI, and JSON.
- Uses Worker Secrets for admin and download tokens.

The deployment model is intentionally small: Workers Static Assets + Worker API + D1 + Worker Secrets.
It keeps the core Sub-Store workflow: format conversion, subscription formatting, multi-source collections, routing templates, preview/validation, usage info, and backup/restore.

## Architecture

```text
Cloudflare Worker
  |-- Static Assets              Vue admin UI
  |-- /api/*                     config API
  |-- /download/source/*         source output
  |-- /download/collection/*     collection output
  |
  |-- D1                         sources / collections / templates / settings
  |-- Worker Secrets             admin token / download token
```

No KV, R2, Durable Objects, Queues, or Cron are required for the core workflow.

## Quick Start

```bash
pnpm run setup
pnpm --dir cloudflare exec wrangler d1 create sub-store-cloudflare
cp cloudflare/.dev.vars.example cloudflare/.dev.vars
cp config/agent-setup.example.json config/agent-setup.local.json
pnpm run deploy:config -- config/agent-setup.local.json cloudflare/wrangler.deploy.local.jsonc --database-id <database-id>
pnpm run build:frontend
pnpm run dev
```

Open:

```text
http://localhost:8787/?token=<admin-token>
```

## AI Agent Install

Ask Codex, Claude Code, or another local coding agent to follow [AGENTS.md](AGENTS.md) and [agent/SKILL.md](agent/SKILL.md). A copyable prompt is in [agent/install.prompt.md](agent/install.prompt.md):

```text
Follow AGENTS.md and agent/SKILL.md in this repository. Help me deploy this Sub-Store Cloudflare project to my Cloudflare account. Ask me only for missing inputs, prepare my subscription sources and collections, generate the D1 seed SQL, deploy the Worker, import the seed, and give me the final admin URL plus collection download URLs.
```

See [docs/ai-agent-install.md](docs/ai-agent-install.md).
Rule and filter presets live in [config/rule-presets.json](config/rule-presets.json), and the setup schema lives in [config/agent-setup.schema.json](config/agent-setup.schema.json).

Production secrets:

```bash
pnpm --dir cloudflare exec wrangler secret put SUB_STORE_ADMIN_TOKEN
pnpm --dir cloudflare exec wrangler secret put SUB_STORE_PUBLIC_DOWNLOAD_TOKEN
```

Deploy:

```bash
pnpm run migrate:remote
pnpm run deploy
```

Import local agent-prepared seed data:

```bash
cp config/agent-setup.example.json config/agent-setup.local.json
# edit config/agent-setup.local.json
pnpm run seed:render
pnpm run seed:remote
```

Download URLs:

```text
https://substore.example.com/download/source/<source-id>/mihomo?token=<download-token>
https://substore.example.com/download/collection/<collection-id>/mihomo?token=<download-token>
```

## Acknowledgements

This project is inspired by and pays respect to [sub-store-org/Sub-Store](https://github.com/sub-store-org/Sub-Store). The original project is the full-featured subscription management system; this repository focuses on a smaller Cloudflare-native deployment.

See [LICENSE](LICENSE) and [NOTICE](NOTICE).
