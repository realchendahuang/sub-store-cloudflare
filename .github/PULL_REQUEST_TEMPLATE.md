## Summary

What changed and why?

## Scope

- [ ] I checked `docs/product-scope.md`.
- [ ] This keeps the architecture Cloudflare-native: Workers Static Assets + Worker API + D1 + Worker Secrets.
- [ ] This does not add R2, KV, Durable Objects, Queues, Cron, sync providers, sharing, archive/history, script runtime, or log panels unless the product boundary was explicitly changed.

## Testing

Paste local command output, especially when touching deployment, Worker behavior, or frontend output:

```bash
pnpm run check:release
pnpm run deploy:dry-run
```

## Privacy

- [ ] I did not commit subscription URLs, node URIs, admin tokens, download tokens, private D1 database IDs, generated seed SQL, or local deployment config.

## Notes

This upstream repository does not use GitHub Actions, Dependabot, or GitHub CI/CD. Maintainer releases are verified locally and published from `main`.
