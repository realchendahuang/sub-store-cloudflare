# Changelog

All notable changes to this project will be documented in this file.

This project follows semantic versioning where practical.

## [Unreleased]

## [1.0.0] - 2026-07-11

### Added

- Added JSON5 subscription input, a distinct Surge Mac output target, and structured Snell, SSH, and HTTP/2 CONNECT client-line compatibility.
- Added authenticated one-shot proxy/subscription conversion and Mihomo, Surge, Loon, and Quantumult X rule conversion APIs plus an admin Tools page.
- Added allowlisted remote subscription metadata propagation, hashed Cache API keys, configurable edge-cache TTL, forced refresh, conditional requests, and stale-on-error fallback.
- Added scoped download grants with one-time plaintext tokens, D1-stored SHA-256 hashes, target restrictions, expiration, revocation, and deployment-token compatibility.
- Added a bounded 50-entry recycle bin for deleted sources, collections, custom templates, and scoped download grants.
- Added configurable HTTPS node IP, location, organization, and ASN lookup from the preview node panel.
- Added an upstream compatibility matrix and a D1 migration for the new compatibility resources.

### Changed

- Repositioned the project as a tested Cloudflare-native compatibility edition while keeping Workers Static Assets + Worker API + D1 + Worker Secrets.
- Updated product and Agent boundaries to preserve scoped private links and the bounded recycle bin while continuing to reject public sharing, unbounded archives, runtime scripts, files, artifacts, queues, cron, and persistent logs.
- Download responses now propagate safe subscription metadata and expose a non-sensitive edge-cache status header.

### Verification

- Added rule conversion, JSON5, Surge Mac, response metadata, scoped authorization, and recycle/restore tests.
- Kept the full release gate, dry-run bundle measurement, startup profiling, and deployed smoke verification as release requirements.

## [0.3.0] - 2026-07-11

### Added

- Added build-time JavaScript Filter / Operator support without runtime `eval()` or `new Function()`.
- Added code-owned script metadata at `/api/scripts`, metadata-driven admin UI controls, and two Free-verified built-ins: TLS fingerprint and name regex filter.
- Added gitignored personal script manifests and source directories that the Agent/CLI installer compiles into the Worker registry.
- Added Worker/D1 integration coverage for script metadata, validation, execution, arguments, unavailable scripts, and per-stage limits.

### Changed

- Aligned source and collection validation, immutable IDs, partial updates, and empty-collection membership semantics across the Worker, frontend, installer, and documentation.
- Removed the advertised `surge-mac` target because it had no independent renderer; use `surge` or a supported YAML target instead.

### Documentation

- Documented Free-compatible build-time JavaScript filters and operators, personal deployment steps, upstream compatibility levels, security boundaries, and performance gates.

## [0.2.0] - 2026-07-10

### Added

- Added Workers runtime and D1 migration integration tests for auth, storage restore, downloads, parsers, and payload limits.
- Added a real `wrangler dev` startup smoke test and production dependency audits to the release gate.
- Added bounded readers for API bodies, remote subscriptions, flow metadata, and DoH responses.

### Changed

- Moved built-in routing templates from D1 seed rows into Worker-owned code so template fixes reach existing deployments immediately.
- Removed request-time schema creation and default seeding; D1 migrations are now the only schema path.
- Consolidated the repository into one pnpm workspace and one root lockfile.
- Updated Wrangler, Workers types, Hono, Axios, Vite, Vue tooling, TypeScript, and YAML dependencies.
- Lazy-loaded the settings route and CodeMirror editor, and removed redundant precompression output.
- Updated Wrangler compatibility settings to `2026-07-08` with `nodejs_compat` across all generated and checked configs.

### Security

- Added CSP, frame denial, no-referrer, no-sniff, and permissions-policy response headers.
- Changed unhandled failures to structured server logs plus generic client-facing 500 responses.
- Removed the admin token from the browser URL after ingest and changed backup export to authenticated blob download.
- Stopped the installer from printing private D1 database IDs and strengthened ignored-file privacy verification.

### Documentation

- Documented the new runtime limits, code-owned template model, release checks, and header-authenticated backup export.

## [0.1.1] - 2026-06-28

### Changed

- Removed repository GitHub Actions and Dependabot so the upstream project does not depend on GitHub automation.
- Kept lightweight GitHub issue forms and a pull request template for contributor intake; they do not run CI/CD.
- Clarified that the Cloudflare Deploy Button is the Cloudflare-hosted template import path, while `pnpm run install:cloudflare` is the local Agent/CLI deployment path.
- Updated Worker compatibility dates and documented the Node 22 + pnpm local development baseline.

### Verification

- Local release checks and Wrangler dry-run deployment remain the release gate.

## [0.1.0] - 2026-06-28

### Added

- Cloudflare-native Worker application with Static Assets, Worker API, D1, and Worker Secrets.
- Source and collection management for remote subscription URLs and local node text.
- Node filters for include/exclude, rename, delete-field, dedupe, sort, regex-sort, flag handling, quick options, and DNS resolve workflows.
- Built-in routing templates for Mihomo-compatible YAML output.
- Output targets for Mihomo, Stash, Surge, Surfboard, Loon, Egern, Shadowrocket, Quantumult X, sing-box, v2ray, URI, and JSON.
- Preview, backup/restore, temporary `url` / `content` / `ua` conversion parameters, and subscription usage metadata.
- Deploy to Cloudflare button support with root `wrangler.jsonc`.
- Agent/CLI installer via `pnpm run install:cloudflare`.
- Release checks for Worker/frontend builds, agent setup, deployment config, worker contract, module format, open-source hygiene, and git history privacy.

### Documentation

- Added deployment, AI agent install, architecture, and product-scope documentation.
- Added contributing, support, security, code of conduct, release notes, and local release checks.
