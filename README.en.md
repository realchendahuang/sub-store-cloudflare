# Sub-Store Cloudflare

A small Cloudflare Workers app for subscription aggregation and cloud-side routing templates.

Chinese is the primary documentation language for this repository. See [README.md](README.md).

## What It Does

- Manages remote subscription URLs and local node text.
- Combines multiple sources into one cloud-side collection.
- Filters by region, type, and regex; renames, deletes matched name text, deduplicates, regex-sorts, resolves node hostnames, adds/removes flags, and applies common node options.
- Provides built-in Mihomo routing templates and supports custom JSON/YAML templates.
- Previews original and processed node lists in the admin UI, with local node validation.
- Supports subscription usage info, config backup/restore, and request options such as User-Agent, pass-through User-Agent, timeout, and remote fetch concurrency.
- Supports temporary `url`, `content`, and `ua` download parameters for one-off conversion through an existing source or collection profile.
- Outputs Mihomo, Stash, Surge, Surge Mac, Surfboard, Loon, Egern, Shadowrocket, Quantumult X, sing-box, v2ray, URI, and JSON.
- Uses Worker Secrets for admin and download tokens.

The deployment model is intentionally small: Workers Static Assets + Worker API + D1 + Worker Secrets.
It keeps the core Sub-Store workflow: format conversion, subscription formatting, multi-source collections, common client outputs, routing templates, preview/validation, usage info, and backup/restore.

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
https://substore.example.com/download/collection/<collection-id>/surge?token=<download-token>
https://substore.example.com/download/collection/<collection-id>/loon?token=<download-token>
https://substore.example.com/download/collection/<collection-id>/qx?token=<download-token>
https://substore.example.com/download/collection/<collection-id>/sing-box?token=<download-token>
```

One-off conversion:

```text
https://substore.example.com/download/source/<source-id>/mihomo?token=<download-token>&url=https%3A%2F%2Fexample.com%2Fsub
https://substore.example.com/download/source/<source-id>/sing-box?token=<download-token>&content=<url-encoded-node-text>
```

`url` temporarily replaces the remote subscription URL, `content` is parsed as local node text, and `ua` temporarily overrides the User-Agent for fetching a remote subscription. These parameters affect only the current request. When a source enables pass-through User-Agent, the Worker forwards the subscription client's User-Agent while fetching the remote subscription.

Custom routing templates apply to Mihomo, Stash, and Surge Mac YAML output. You can import regular Mihomo YAML using keys such as `mixed-port`, `proxy-groups`, and `rule-providers`, or use the internal camelCase JSON keys such as `mixedPort`, `proxyGroups`, and `ruleProviders`.

Local node content accepts URI lines, Mihomo YAML, JSON proxy arrays, complete Base64 content, and common Surge/Loon/Quantumult X single-line node formats.

## Acknowledgements

This project is inspired by and pays respect to [sub-store-org/Sub-Store](https://github.com/sub-store-org/Sub-Store). The original project is the full-featured subscription management system; this repository focuses on a smaller Cloudflare-native deployment.

See [LICENSE](LICENSE) and [NOTICE](NOTICE).
