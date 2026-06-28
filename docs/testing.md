# Testing and Release Gates

This repository uses local validation instead of GitHub Actions.

## Quick Check

Use this during development:

```bash
pnpm run check
```

It runs the Worker TypeScript check and the frontend locale/build check.

## Release Gate

Use this before publishing or proposing a deployment-sensitive patch:

```bash
pnpm run check:release
pnpm run deploy:dry-run
```

`check:release` covers:

- Worker TypeScript.
- Frontend locales and production build.
- Agent setup validation.
- Seed SQL rendering.
- Local Wrangler deploy config rendering.
- Worker contract checks.
- Module format checks.
- Current-file open-source hygiene scan.
- `main` git history privacy scan.

`deploy:dry-run` asks Wrangler to validate the deploy without publishing the Worker.

## Focused Checks

```bash
pnpm run check:worker
pnpm run check:frontend
pnpm run check:agent
pnpm run check:worker-contract
pnpm run check:open-source
pnpm run check:history -- main
```

## Deployment Doctor

For Cloudflare install problems:

```bash
pnpm run install:doctor
```

Paste only sanitized output in GitHub issues. Never include subscription URLs, node URIs, admin tokens, download tokens, private D1 database IDs, or generated seed SQL.
