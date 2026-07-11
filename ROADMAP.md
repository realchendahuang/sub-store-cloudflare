# Roadmap

This roadmap is intentionally conservative. The project should stay easy to deploy, easy to understand, and Cloudflare-native.

## Current Foundation

- Cloudflare Workers Static Assets + Worker API.
- D1 for structured configuration.
- Worker Secrets for admin and download tokens.
- Cloudflare Deploy Button for quick installs.
- Agent / CLI installer for seeded sources and collections.
- Free-verified build-time JavaScript filters/operators, plus CLI-deployed personal scripts.
- Local release gates instead of GitHub CI/CD.
- JSON5 and broader client-line parsing, Surge Mac output, and one-shot proxy/rule conversion.
- Allowlisted remote metadata propagation and optional Workers Cache API caching.
- Scoped expiring download grants and a bounded D1 recycle bin.

## Near-Term Priorities

- Improve deployment troubleshooting and diagnostics.
- Add focused tests around Worker API behavior and output targets.
- Tighten docs for common Mihomo, sing-box, URI, and JSON workflows.
- Improve import/export safety and validation messages.
- Add screenshots or short GIFs after the UI stabilizes.
- Expand tested parser/producer fixtures as upstream adds protocols and transport fields.

## Later, If Needed

- More built-in routing templates when there is clear demand.
- More filter presets when they map cleanly to the existing filter DSL.
- More deployment examples for custom domains and split download domains.
- English translations for deployment-critical docs.

## Not Planned by Default

- R2, KV, Durable Objects, Queues, Cron, or extra Cloudflare products.
- File hosting.
- Gist, GitLab, or third-party sync providers.
- Public sharing platform. Scoped private download grants are implemented.
- Unbounded archive/history system. A bounded recycle bin is implemented.
- Runtime evaluation of browser-pasted or D1-stored JavaScript, and any script marketplace. Build-time bundled filters/operators are evaluated separately under the accepted Free-compatible design.
- Log panel.
- Full upstream Sub-Store API compatibility.

These may be reconsidered only if the product boundary changes explicitly.
