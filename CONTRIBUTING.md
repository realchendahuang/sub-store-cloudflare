# Contributing

Thanks for helping improve Sub-Store Cloudflare.

## Product Scope

This project is intentionally small: Workers Static Assets + Worker API + D1 + Worker Secrets.

Before adding a feature, read [docs/product-scope.md](docs/product-scope.md). Contributions should normally improve one of these workflows:

- sources
- collections
- filters
- templates
- preview
- backup/restore
- download links and output targets
- deployment and agent installation

Do not add R2, KV, Durable Objects, Queues, Cron, file hosting, sync providers, sharing, archive/history, script runtime, or log panels unless the product boundary is explicitly changed.

## Development

Requires Node.js 22 and pnpm 11.

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

## Checks

Run before opening a pull request or asking the maintainer to merge a patch:

```bash
pnpm run check:release
pnpm run deploy:dry-run
```

Focused checks:

```bash
pnpm run check
pnpm run check:agent
pnpm run check:worker-contract
pnpm run check:open-source
```

## Private Data

Never commit:

- subscription URLs
- node URIs
- admin tokens
- download tokens
- private D1 database IDs
- generated seed SQL containing user data

These files are local-only and ignored:

- `config/agent-setup.local.json`
- `cloudflare/agent.seed.local.sql`
- `cloudflare/wrangler.deploy.local.jsonc`
- `.dev.vars`
- `cloudflare/.dev.vars`

## Pull Requests

If you send a patch upstream, keep it focused. Include:

- what changed
- why it changed
- how it was tested
- any product-scope tradeoff

The maintainer does not use GitHub Actions or Dependabot for this repository, so include local command output from `pnpm run check:release` and `pnpm run deploy:dry-run` when the change touches deployment, Worker behavior, or frontend output.

## Issues

Use the GitHub issue forms for reproducible bugs, deployment problems, and scoped feature requests. Security reports should follow [SECURITY.md](SECURITY.md), not public issues.
