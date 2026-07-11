# Testing and Release Gates

This repository uses local validation instead of GitHub Actions.

## Quick Check

Use this during development:

```bash
pnpm run check
```

It runs Worker and test TypeScript checks plus the frontend locale/build check.

## Release Gate

Use this before publishing or proposing a deployment-sensitive patch:

```bash
pnpm run check:release
pnpm run deploy:dry-run
```

`check:release` covers:

- Worker TypeScript.
- Worker test TypeScript.
- Workers runtime and D1 migration integration tests.
- Frontend locales and production build.
- Frontend and Worker production dependency audits.
- Real `wrangler dev` startup and response-header smoke testing.
- Agent setup validation.
- Seed SQL rendering.
- Local Wrangler deploy config rendering.
- Worker contract checks.
- Module format checks.
- Documentation link checks.
- Current-file open-source hygiene scan.
- `main` git history privacy scan.

`deploy:dry-run` asks Wrangler to validate the deploy without publishing the Worker.

## Focused Checks

```bash
pnpm run check:worker
pnpm run check:tests
pnpm run check:audit
pnpm run check:runtime
pnpm run check:scripts
pnpm run check:frontend
pnpm run check:agent
pnpm run check:worker-contract
pnpm run check:docs
pnpm run check:open-source
pnpm run check:history -- main
```

The Worker tests run through Cloudflare's Vitest integration, apply the real D1 migrations, and dispatch requests to the actual Worker entrypoint. They cover auth, security headers, code-owned built-in templates and scripts, storage restore, download rendering, JSON5 and client-line parsers, rule conversion, remote metadata and Cache API behavior, scoped download grants, recycle/restore, and payload limits. `check:scripts` also generates the registry, performs a Wrangler dry-run bundle, and enforces a 2.5 MiB gzip release budget below the 3 MiB Workers Free limit.

## Deployment Doctor

For Cloudflare install problems:

```bash
pnpm run install:doctor
```

Paste only sanitized output in GitHub issues. Never include subscription URLs, node URIs, admin tokens, download tokens, private D1 database IDs, or generated seed SQL.
