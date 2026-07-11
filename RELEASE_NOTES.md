# v1.0.0

Cloudflare-native upstream compatibility major release.

## Highlights

- Adds JSON5 input, Surge Mac output, and broader Surge/Loon/QX client-line compatibility including Snell, SSH, and H2 CONNECT.
- Adds a Tools page for one-shot proxy/subscription conversion and rule conversion without saving content to D1.
- Adds safe subscription metadata propagation and optional Workers Cache API caching with hashed keys, configurable TTL, forced refresh, conditional requests, and stale fallback.
- Adds private scoped download grants with target restrictions, expiration, revocation, and one-time plaintext token display.
- Adds a bounded 50-entry recycle bin for deleted configuration.
- Adds configurable HTTPS node location and ASN lookup in preview.
- Preserves the v0.3.0 build-time JavaScript Filter / Operator model.
- Keeps the deployment on Workers Static Assets + Worker API + D1 + Worker Secrets. No KV, R2, Durable Objects, Queues, Cron, runtime script strings, general file hosting, artifact repository, or persistent request logs are required.

## Upgrade

Existing deployments keep their D1 database and Worker Secrets. Apply migrations and deploy normally:

```bash
pnpm run migrate:remote
pnpm run deploy:local
```

Migration `0003_compatibility_resources.sql` adds scoped download grants and recycle-bin tables without replacing existing sources, collections, templates, or settings.

See `docs/upstream-compatibility.md` for the tested compatibility matrix and explicit platform exclusions.
