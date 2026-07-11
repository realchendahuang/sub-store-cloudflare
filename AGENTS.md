# AI Agent Install Protocol

This file is the operating protocol for Codex, Claude Code, and similar local coding agents. Follow it when a user asks to install, deploy, configure, or verify this repository.

## Goal

Deploy Sub-Store Cloudflare into the user's Cloudflare account, import their subscription sources, create useful collections, and return ready-to-copy admin and download URLs.

## Product Boundary

- Keep the app Cloudflare-native and small: Workers Static Assets + Worker API + D1 + Worker Secrets.
- Use D1 for structured configuration. Do not switch to R2/KV/Durable Objects/Queues/Cron/Pages unless the user explicitly changes the architecture and the code is updated for it.
- The public data model is `sources`, `collections`, `templates`, `filters`, `settings`, `sourceIds`, scoped `download_grants`, and bounded `recycle_bin` entries.
- Treat upstream Sub-Store as a reference for retained source, collection, filter, template, preview, backup/restore, and download workflows only.
- Do not add files, Gist sync, public sharing, unbounded archives, runtime-evaluated scripts, logs, queues, cron, or artifact features during install or cleanup work. Build-time bundled Filter / Operator scripts, scoped download grants, and the bounded configuration recycle bin are supported through the existing pipeline.

## Deployment Paths

There are two supported install paths:

1. **Deploy to Cloudflare button** for ordinary open-source users.
   - Uses root `wrangler.jsonc`.
   - Uses root `package.json` `build` and `deploy` scripts.
   - Cloudflare provisions D1 and asks the user for Worker secrets.
   - Does not import private sources from local files.
2. **Agent / CLI installer** for users who want imported sources and collections.
   - Write `config/agent-setup.local.json`.
   - Run `pnpm run install:cloudflare`.
   - Let the installer create or reuse D1, render local Wrangler config, set secrets, migrate, deploy, seed, and verify.

Prefer the installer over manually running every deployment command.

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
Follow AGENTS.md and agent/SKILL.md in this repository. Deploy this Sub-Store Cloudflare project to my Cloudflare account. Ask me only for missing inputs, write config/agent-setup.local.json, run pnpm run install:cloudflare, and give me the final admin URL plus collection download URLs.
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
  - create or reuse `sub-store-cloudflare`, or use an explicit database id.
- Admin token and download token:
  - user-provided, env-provided, or generated locally.
- Sources:
  - remote subscription URLs.
  - local node text such as `vless://`, `trojan://`, `ss://`, `vmess://`.
- Collections:
  - collection ids and names.
  - which sources each collection includes.
  - `sourceIds: []` means all enabled sources; list ids to pin a collection to specific sources.
- Rule template:
  - read `config/rule-presets.json`.
  - default to `acl4ssr-mihomo`.
- Filters:
  - default collection filters: `dedupe-by-endpoint`, `sort-by-name`.
  - provider-info cleanup: `clean-provider-nodes`.
  - ask before using region include filters such as `hk-jp-sg-us-only`.
- Build-time scripts:
  - use public built-ins for ordinary installs.
  - put personal manifests in `config/script-plugins.local.json` and code in `config/scripts.local/`.
  - never store or execute script source from D1, the browser, or a remote URL.

## Workflow

1. Inspect the repo:
   - `git status --short`
   - `cat README.md`
   - `cat docs/deployment.md`
   - `cat docs/ai-agent-install.md`
   - `cat agent/SKILL.md`
   - `cat config/agent-setup.schema.json`
   - `cat config/rule-presets.json`
2. Prepare private setup:
   - Copy `config/agent-setup.example.json` to `config/agent-setup.local.json` if needed.
   - Fill `sources`, `collections`, optional custom `templates`.
   - Use 1-64 lowercase letters, numbers, underscores, or hyphens for record ids.
   - Prefer `filterPresetIds` from `config/rule-presets.json` for common filters.
   - Validate with `pnpm run seed:validate`.
3. Deploy with one command:
   - `pnpm run install:cloudflare`
4. Verify installer output:
   - admin URL works.
   - `/api/env`, `/api/templates`, `/api/sources`, `/api/collections` are verified.
   - `/api/link/collection/<id>` and `/download/collection/<id>/mihomo` are verified when collections exist.
5. Finish with:
   - final admin URL.
   - collection download URLs for Mihomo and any requested targets.
   - sources/collections summary.
   - `git status --short` privacy check summary.

## Cloudflare Missing States

If the user does not have a Cloudflare account, say clearly:

```text
This project requires a Cloudflare account because it runs on Workers + D1. I can prepare the local setup, but deployment requires Cloudflare. Create an account, then run:
pnpm --dir cloudflare exec wrangler login
pnpm run install:cloudflare
```

If Wrangler is not logged in, ask the user to run:

```bash
pnpm --dir cloudflare exec wrangler login
```

If the agent cannot connect to Cloudflare, stop at handoff:

```text
Cloudflare is not reachable from this environment. I prepared the local setup. Resume with:
pnpm run install:cloudflare
```

Do not claim deployment success until HTTP verification passes.

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
