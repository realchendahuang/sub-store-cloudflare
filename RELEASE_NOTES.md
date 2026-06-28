# v0.1.1

Open-source polish release for Sub-Store Cloudflare.

## Highlights

- Removes GitHub Actions and Dependabot from the upstream repository.
- Keeps lightweight GitHub issue forms and a pull request template for contributor intake; they do not run CI/CD.
- Keeps releases gated by local checks: `pnpm run check:release` and `pnpm run deploy:dry-run`.
- Clarifies the two deployment paths: Cloudflare Deploy Button for quick template import, and `pnpm run install:cloudflare` for local Agent/CLI installs.
- Updates Worker compatibility dates and documents the Node 22 + pnpm baseline.
- Keeps the Cloudflare-native architecture: Workers Static Assets + Worker API + D1 + Worker Secrets.

## Install

Use the Deploy to Cloudflare button in `README.md`, or run:

```bash
pnpm run install:cloudflare
```
