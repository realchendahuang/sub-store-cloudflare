# Support

Use GitHub Issues for reproducible bugs, deployment problems, and focused feature requests. Use GitHub Discussions for broader questions when available.

Before opening an issue:

```bash
pnpm run install:doctor
pnpm run check:release
```

For deployment problems, include:

- install path: Deploy to Cloudflare button, `pnpm run install:cloudflare`, or manual Wrangler deploy
- sanitized command output
- Worker route or `workers.dev` hostname without tokens
- output target such as `mihomo`, `sing-box`, `surge`, `uri`, or `json`

Do not include subscription URLs, node URIs, admin tokens, download tokens, private database IDs, or generated seed SQL.
