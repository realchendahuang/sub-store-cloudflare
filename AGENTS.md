# AI Agent Install Protocol

This file is the operating protocol for Codex, Claude Code, and similar local coding agents. Follow it when a user asks to install, deploy, or configure this repository.

## Goal

Deploy Sub-Store Cloudflare into the user's Cloudflare account, import their subscription sources, create useful collections, and return ready-to-copy admin and download URLs.

## Product Boundary

- Keep the app Cloudflare-native and small: Workers Static Assets + Worker API + D1 + Worker Secrets.
- Use D1 for structured configuration. Do not switch to R2/KV/Durable Objects/Queues/Cron/Pages unless the user explicitly changes the architecture and the code is updated for it.
- Treat upstream Sub-Store as the reference for core interaction quality, not as a feature backlog to copy wholesale.
- Preserve the core loop: manage sources, combine sources into collections, apply practical node filters, choose routing templates, preview output, and publish subscription URLs.
- Do not add upstream-only systems such as file hosting, sync providers, sharing, archive/history, script runtime, log panels, queues, cron jobs, or artifact management unless the user explicitly expands the product boundary.
- Do not expose UI controls for backend behavior that this Worker does not actually implement. A smaller real feature is preferred over a larger fake-compatible UI.
- The public data model is `sources`, `collections`, `templates`, `filters`, and `sourceIds`.
- The filter DSL accepted by Worker config is:
  - `{ "type": "include", "field": "name", "pattern": "..." }`
  - `{ "type": "exclude", "field": "name", "pattern": "..." }`
  - `{ "type": "rename", "field": "name", "pattern": "...", "replacement": "..." }`
  - `{ "type": "delete-field", "field": "name", "patterns": ["..."] }`
  - `{ "type": "dedupe", "fields": ["server", "port"] }`
  - `{ "type": "sort", "direction": "asc" }`
  - `{ "type": "regex-sort", "expressions": ["香港|HK", "日本|JP"] }`
  - `{ "type": "flag", "mode": "add" }`
  - `{ "type": "quick", "useless": "ENABLED", "udp": "DEFAULT", "scert": "DEFAULT", "tfo": "DEFAULT" }`
  - `{ "type": "resolve", "provider": "Cloudflare", "recordType": "A", "filter": "disabled" }`
- Download URLs are:
  - `/download/source/<source-id>?token=<download-token>`
  - `/download/collection/<collection-id>?token=<download-token>`
  - `/download/source/<source-id>/<target>?token=<download-token>`
  - `/download/collection/<collection-id>/<target>?token=<download-token>`

## Privacy Rules

- Never commit subscription URLs, node URIs, admin tokens, download tokens, database ids from private deployments, or generated seed SQL that contains user data.
- Put user-specific setup data in `config/agent-setup.local.json`.
- Generated local SQL goes to `cloudflare/agent.seed.local.sql`.
- Deployment-specific Wrangler config goes to `cloudflare/wrangler.deploy.local.jsonc`.
- These local paths are ignored by git.
- Before finishing, run `git status --short` and verify no private local file is tracked.

## One-Shot Prompt

The user can start with:

```text
Follow AGENTS.md and agent/SKILL.md in this repository. Deploy this Sub-Store Cloudflare project to my Cloudflare account. Ask me only for missing inputs, prepare my subscription sources and collections, generate the D1 seed SQL, deploy the Worker, import the seed, and give me the final admin URL plus collection download URLs.
```

The same prompt is available in `agent/install.prompt.md`.

## Required Inputs

Ask only for missing inputs. Prefer reasonable defaults when the user does not care.

- Cloudflare login state: whether `wrangler whoami` succeeds.
- Worker name: default `sub-store-cloudflare`.
- Domain mode:
  - `workers.dev` only.
  - custom admin domain.
  - custom admin domain plus separate download domain.
- D1 database:
  - create a new `sub-store-cloudflare`, or use an existing database name/id.
- Admin token and download token:
  - user-provided, or generated locally with `openssl rand -base64 32`.
- Sources:
  - remote subscription URLs.
  - local node text such as `vless://`, `trojan://`, `ss://`, `vmess://`.
- Collections:
  - collection ids and names.
  - which sources each collection includes.
- Rule template:
  - read `config/rule-presets.json`.
  - default to `acl4ssr-mihomo`.
- Filters:
  - default collection filters: `dedupe-by-endpoint`, `sort-by-name`.
  - provider-info cleanup: `clean-provider-nodes`.
  - ask before using region include filters such as `hk-jp-sg-us-only`.

## Workflow

1. Inspect the repo:
   - `git status --short`
   - `cat README.md`
   - `cat docs/deployment.md`
   - `cat agent/SKILL.md`
   - `cat agent/install.prompt.md`
   - `cat config/agent-setup.schema.json`
   - `cat config/agent-setup.example.json`
   - `cat config/rule-presets.json`
2. Check tooling:
   - `pnpm --dir cloudflare exec wrangler --version`
   - `pnpm --dir cloudflare exec wrangler whoami`
3. Prepare configuration:
   - Copy `config/agent-setup.example.json` to `config/agent-setup.local.json`.
   - Follow `config/agent-setup.schema.json`.
   - Fill `sources`, `collections`, optional custom `templates`.
   - Prefer `filterPresetIds` from `config/rule-presets.json` for common filters.
   - Use only the Worker filter DSL listed above.
   - Validate with `pnpm run seed:validate`.
4. Set up Cloudflare resources:
   - Install dependencies with `pnpm run setup`.
   - Create D1 if needed:
     - `pnpm --dir cloudflare exec wrangler d1 create sub-store-cloudflare`
   - Render local Wrangler config with the returned database id:
     - `pnpm run deploy:config -- config/agent-setup.local.json cloudflare/wrangler.deploy.local.jsonc --database-id <database-id>`
   - Set Worker secrets:
     - `pnpm --dir cloudflare exec wrangler secret put SUB_STORE_ADMIN_TOKEN`
     - `pnpm --dir cloudflare exec wrangler secret put SUB_STORE_PUBLIC_DOWNLOAD_TOKEN`
5. Build and deploy:
   - `pnpm run check`
   - `pnpm run migrate:remote`
   - `pnpm run deploy`
6. Import user config without browser automation:
   - `pnpm run seed:validate`
   - `pnpm run seed:render`
   - `pnpm run seed:remote`
7. Verify with HTTP calls:
   - `/api/env` with `?token=<admin-token>`
   - `/api/templates` with `?token=<admin-token>`
   - `/api/sources` with `?token=<admin-token>`
   - `/api/collections` with `?token=<admin-token>`
   - `/api/link/collection/<id>?token=<admin-token>`
   - `/download/collection/<id>/mihomo?token=<download-token>`
8. Finish with:
   - final admin URL.
   - collection download URLs for Mihomo and any requested targets.
   - sources/collections summary.
   - `git status --short` privacy check summary.

## Cloudflare Access

Cloudflare Access is optional. The default product already has:

- `SUB_STORE_ADMIN_TOKEN` for the admin UI and `/api/*`.
- `SUB_STORE_PUBLIC_DOWNLOAD_TOKEN` for `/download/*`.

If the user asks for Access:

- Do not use browser automation as the primary method.
- Prefer `pnpm run access:render`, Cloudflare API, Terraform, or explicit instructions.
- Ask for:
  - Cloudflare account id.
  - protected hostname, usually the admin hostname only.
  - allowed emails or email domains.
  - API token with Zero Trust Access application/policy permissions.
- Create a self-hosted Access application for the admin hostname.
- Use an allow policy with email or email domain rules.
- Keep `/download/*` outside Access unless the user confirms their subscription client can handle Access authentication. Most subscription clients cannot.
- Render the payload with `pnpm run access:render`.
- Apply only after reviewing the generated `cloudflare/access.setup.local.json`:
  - `CLOUDFLARE_API_TOKEN=... pnpm run access:apply`

Cloudflare API references:

- Create Access application: `POST /{accounts_or_zones}/{account_or_zone_id}/access/apps`
- Create reusable Access policy: `POST /accounts/{account_id}/access/policies`

## Template Guidance

- `acl4ssr-mihomo`: recommended default for most users.
- `acl4ssr-mihomo-no-emoji`: same ACL4SSR routing style with plain group names.
- `mihomo-basic`: small and easy to inspect.
- `loyalsoldier-whitelist`: direct-first whitelist style.
- `loyalsoldier-blacklist`: proxy-first blacklist style.
- `ai-streaming-mihomo`: useful when AI, streaming, Telegram, and GitHub routing matters.

## Filter Guidance

Common starter filters:

```json
[
  { "type": "exclude", "field": "name", "pattern": "官网|剩余|流量|过期|倍率" },
  { "type": "dedupe", "fields": ["server", "port"] },
  { "type": "sort", "direction": "asc" }
]
```

Ask before adding aggressive include filters, because they can remove valid nodes.
