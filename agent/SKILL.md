# Sub-Store Cloudflare Installer

Use this skill when a user wants to deploy, configure, import, or verify this repository with an AI coding agent.

## First Read

1. Read `AGENTS.md`.
2. Read `docs/deployment.md`.
3. Read `docs/ai-agent-install.md`.
4. Read `config/agent-setup.schema.json`.
5. Read `config/rule-presets.json`.

## User-Facing Start Prompt

```text
Follow AGENTS.md and agent/SKILL.md in this repository. Deploy this Sub-Store Cloudflare project to my Cloudflare account. Ask me only for missing inputs, write config/agent-setup.local.json, run pnpm run install:cloudflare, and return the final admin URL plus download URLs.
```

## Operating Rules

- Prefer the one-command installer: `pnpm run install:cloudflare`.
- Ask for missing inputs instead of inventing subscription data.
- Use `config/agent-setup.local.json` as the single private setup file.
- Use 1-64 lowercase letters, numbers, underscores, or hyphens for source, collection, and custom template ids.
- Treat an empty collection `sourceIds` array as all enabled sources; use explicit ids for fixed membership.
- Use `filterPresetIds` from `config/rule-presets.json` when the user asks for common filtering.
- Use `acl4ssr-mihomo-no-emoji` when the user asks for rule groups without emoji.
- Use D1 for sources, collections, templates, settings, filters, scoped download grants, and the bounded recycle bin.
- Do not add R2/KV/Queues/Durable Objects unless the codebase is changed for that storage model.
- Do not use browser automation for Cloudflare setup unless the user explicitly asks for a visual walkthrough.
- Treat upstream Sub-Store as a reference for retained source, collection, filter, template, preview, backup/restore, and download workflows only.
- Do not add files, sync, public sharing, unbounded archives, runtime-evaluated scripts, logs, queues, cron, or artifact features during installation or cleanup work. Build-time bundled Filter / Operator scripts, scoped download grants, and the bounded recycle bin are supported.

## Execution Checklist

1. Inspect `git status --short`.
2. Write or update `config/agent-setup.local.json`.
3. Run `pnpm run seed:validate`.
4. Run `pnpm run install:cloudflare`.
5. If Cloudflare login is missing, ask the user to run `pnpm --dir cloudflare exec wrangler login`, then resume the installer.
6. Verify the installer output and HTTP checks.
7. Run `git status --short` and confirm private local files are untracked/ignored.

## Cloudflare Missing States

- No Cloudflare account: explain that Workers + D1 require Cloudflare, prepare local setup only, and ask the user to create an account before deployment.
- Wrangler not logged in: ask for `pnpm --dir cloudflare exec wrangler login`.
- Cloudflare unreachable: stop at handoff and tell the user to rerun `pnpm run install:cloudflare`.

Never report deployment success until the installer has deployed and verified the Worker.
