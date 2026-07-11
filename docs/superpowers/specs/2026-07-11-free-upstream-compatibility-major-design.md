# Free-plan upstream compatibility major design

Status: approved for implementation.

Date: 2026-07-11

Target release: v1.0.0.

## Decision

Sub-Store Cloudflare will ship one major compatibility release instead of splitting the work across several minor releases. The release will absorb as much of upstream Sub-Store's subscription-generation workflow as can be implemented reliably on Cloudflare Workers Free while preserving the existing single-Worker architecture:

- Workers Static Assets for the admin UI;
- one Worker API and download runtime;
- D1 for bounded structured configuration;
- Worker Secrets for deployment-wide credentials;
- the Workers Cache API as an optional, non-durable optimization;
- build-time trusted JavaScript plugins, never runtime code strings.

Compatibility means a tested behavior, not an API name or UI control with a partial implementation. Features that cannot meet the Free-plan runtime and privacy requirements will remain explicitly unsupported.

## Approaches considered

### Import the entire upstream backend

This provides the broadest nominal API surface, but upstream assumes Node.js, mutable process storage, cron jobs, dynamic JavaScript, filesystem access, and a much larger dependency graph. Importing it wholesale would make the Worker difficult to audit and would not turn unsupported Node.js behaviors into reliable Workers behaviors.

### Keep the current narrow feature set

This is the lowest-risk option, but it leaves avoidable parser, producer, response metadata, conversion, link-management, and deletion-safety gaps even though those features fit the current architecture.

### Selective compatibility layer

This is the accepted approach. Upstream remains the behavior and fixture reference. Workers-native modules implement compatible contracts in bounded units, and release tests prove the supported matrix. Platform modules such as files, artifacts, runtime scripts, cron, and persistent logs are not copied merely to increase a feature count.

## Free-plan constraints

The release treats current Workers Free limits as product requirements:

- 10 ms CPU time per HTTP request;
- 128 MB isolate memory;
- 3 MB compressed Worker bundle;
- 50 subrequests per invocation;
- six simultaneous outgoing connections;
- 100,000 Worker requests per day.

D1 Free provides a maximum 500 MB database, 2 MB maximum row/string/BLOB size, 50 queries per Worker invocation, and seven days of Time Travel. The design therefore stores configuration, scoped link records, and small deletion snapshots in D1, but not subscription bodies, generated artifacts, or request logs.

The current v0.3.0 dry-run upload is 95.13 KiB gzip, leaving substantial bundle headroom. CPU time and request fan-out are the tighter constraints.

References:

- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Workers Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)
- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Upstream Sub-Store](https://github.com/sub-store-org/Sub-Store)

## Compatibility scope

### Parser and normalized node model

The parser layer will be separated from filtering and rendering. It will keep the current mainline inputs and add the upstream formats that can be normalized without external processes:

- plain and Base64 URI lists;
- JSON, JSON5, Clash/Mihomo JSON, and Clash/Mihomo YAML;
- Quantumult X, Loon, Surge, Surfboard, and common single-line client formats;
- `socks5`, `socks5+tls`, `http`, `https`, `ss`, `ssr`, `vmess`, `vless`, `trojan`, `hysteria`, `hysteria2`, `tuic`, `anytls`, and `wireguard` URI inputs;
- bounded support for upstream Mihomo/Surge node types that can be preserved as structured nodes, including `snell`, `ssh`, `mieru`, `masque`, `direct`, and HTTP/2 CONNECT-related fields;
- transport normalization for WebSocket, HTTP/2, gRPC, Reality, XHTTP, and supported client-specific aliases.

Unknown structured Mihomo nodes will be preserved for Mihomo/JSON output when they contain a valid name and type. They will be excluded with an explicit compatibility reason from target producers that cannot represent them.

JSON5 support will use a small audited parser dependency. The Worker will not execute JavaScript syntax to parse JSON5.

### Producers and targets

The target layer will continue supporting Mihomo, Stash, Surge, Surfboard, Loon, Egern, Shadowrocket, Quantumult X, sing-box, V2Ray, URI, and JSON. It will add Surge Mac as a distinct target and improve protocol-specific field mapping across existing targets.

Every producer will declare supported node types. Conversion will never silently emit malformed target lines. Unsupported nodes will be counted and reported in preview/conversion metadata; a normal subscription download succeeds when at least one node remains and fails clearly when all nodes are incompatible.

### One-shot conversion

Authenticated Worker endpoints and an admin UI tool will expose upstream-style one-shot conversion without saving data:

- proxy content to any supported target;
- rule content between the bounded rule formats supported by the new rule parser;
- optional temporary actions and a routing template for proxy conversion;
- result metadata containing parsed, emitted, and skipped counts plus bounded warnings.

Request and result sizes remain under the existing application limits. These endpoints use the admin token and are not public conversion services.

### Rule conversion

A small normalized rule model will cover common domain, domain suffix, domain keyword, IP-CIDR, IP-CIDR6, GEOIP, GEOSITE, process, port, final/match, and classical payload rules. Initial producers will cover Mihomo, Surge, Loon, and Quantumult X syntax.

Rule conversion is text transformation only. It will not fetch arbitrary rule-provider trees, recursively include files, or maintain a hosted rule repository.

### Download response metadata

Remote source fetches will capture bounded, allowlisted metadata:

- `subscription-userinfo`;
- `profile-web-page-url`;
- `profile-update-interval`;
- `content-disposition` filename when safe;
- ETag and Last-Modified for conditional fetches.

Source downloads propagate their own metadata. Collection downloads use explicit collection metadata when configured, otherwise the first successfully loaded selected source. Hop-by-hop, cookie, authorization, CORS, and arbitrary upstream headers are never forwarded.

### Remote source cache

Remote subscription fetches may use the Workers Cache API with a hashed internal cache key that does not expose the source URL or token. Cache entries contain the bounded source body and allowlisted metadata. The cache is opportunistic and non-authoritative:

- direct fetch remains the source of truth;
- preview and download may request a forced refresh;
- stale fallback is optional and clearly marked;
- cache failures never prevent a direct fetch;
- deployments where Cache API operations have no effect continue to work;
- D1 is never used as a subscription-body cache.

Cache TTL and stale behavior have conservative deployment-wide defaults with bounded source overrides.

### Scoped share links

D1 will store scoped download grants containing a cryptographically random token hash, resource type and ID, optional target restriction, expiration, enabled state, and timestamps. Plain tokens are returned only once at creation.

The existing deployment-wide download token remains supported. A scoped token grants access only to its source or collection and optional target. The UI can create, list, copy-at-creation, disable, and delete grants. This is private link management, not a public sharing platform.

### Bounded recycle bin

Deleting a source, collection, user template, or scoped share creates a small D1 snapshot before deletion. The recycle bin supports list, restore, and permanent deletion. It retains at most 50 entries and prunes oldest entries transactionally.

Snapshots contain configuration only. They never contain fetched subscription bodies, generated outputs, plaintext download tokens, or logs. Restore validates current IDs and reports conflicts instead of overwriting silently.

### Node information

The existing preview node panel will optionally request bounded server IP metadata from a configurable HTTPS provider. Results include only useful country, region, city, organization, and ASN fields. Failures do not affect preview or download, and the UI identifies that the node address is sent to the configured provider.

This feature is disabled unless an HTTPS provider is configured or a safe documented default is selected.

### Build-time compatibility plugins

The existing build-time Filter and Operator registry remains the only JavaScript execution model. The registry contract may add trusted configuration and response metadata transformers when they can use the same static-import, strict-output-validation, and action-count limits.

The major release will also add practical built-ins where they replace common pasted scripts. It will not add runtime script text, remote script URLs, `eval`, `new Function`, dynamic module loading, or a marketplace.

## Explicitly unsupported upstream modules

The major version does not claim compatibility for:

- general file hosting or arbitrary file management;
- artifact repositories or scheduled artifact production;
- GitHub Gist, GitLab, or third-party automatic synchronization;
- runtime JavaScript, remote scripts, or browser-pasted executable code;
- persistent application logs stored in D1;
- unbounded archives or complete configuration history;
- queues, cron, Durable Objects, KV, R2, or a second backend;
- multi-user accounts or a public sharing platform;
- full upstream REST API path compatibility when the behavior is not implemented.

These exclusions are visible in the compatibility document and environment endpoint. The project will not call an unsupported module compatible because a route stub exists.

## Module boundaries

The current large subscription module will be decomposed only where required by the compatibility work:

- `proxy/parse`: content detection, JSON5/YAML/client-line/URI parsing;
- `proxy/normalize`: normalized node contracts and transport aliases;
- `proxy/produce`: target capability matrix and producers;
- `rules`: rule parser, normalized model, and producers;
- `remote-source`: bounded fetch, metadata, conditional requests, and cache;
- `share-links`: token hashing and scoped authorization;
- `recycle-bin`: bounded snapshots, pruning, and restore;
- existing filters and script registry remain separate.

Public route handlers coordinate these modules and remain thin. No request-scoped mutable data is stored in module globals.

## Data flow

```text
saved source or one-shot content
  -> bounded remote fetch / optional cache
  -> parser and node normalization
  -> source filters and build-time plugins
  -> collection merge and filters
  -> target capability selection
  -> producer
  -> allowlisted response metadata
  -> download or authenticated conversion response
```

Scoped download flow:

```text
request token
  -> deployment-wide token check
  -> otherwise hash and D1 grant lookup
  -> resource and target scope check
  -> normal subscription pipeline
```

## Failure behavior

- Invalid input returns a bounded parse error with line or format context where available.
- Mixed compatible/incompatible nodes produce the compatible subset and warnings in preview/conversion metadata.
- A download with zero compatible nodes fails explicitly.
- A failed remote source follows the existing collection `ignoreFailed` policy.
- Cache, node-information, and stale-fallback failures never corrupt saved configuration.
- Share tokens are compared as hashes and never returned by list APIs.
- Recycle-bin restore never silently overwrites a live resource.
- Errors and logs never include subscription URLs, node URIs, source bodies, or plaintext tokens.

## Testing and release gates

The release requires:

- upstream-derived parser and producer fixtures for every advertised protocol/target pair;
- round-trip tests where a format has both a parser and producer;
- target capability and skipped-node tests;
- rule conversion fixtures;
- remote metadata, cache hit/miss/refresh/stale, and secret-free cache-key tests;
- scoped token creation, expiry, restriction, revocation, and timing-safe authorization tests;
- recycle-bin prune, conflict, restore, and privacy tests;
- Worker route integration tests using D1;
- frontend production build and locale checks;
- complete release gate, dry-run upload size, and startup profiling;
- deployed smoke tests on admin and download domains without exposing private values;
- a 100, 500, and 1,000 node compatibility benchmark on the deployed Worker.

The compressed Worker target remains below 2.5 MB. Built-in benchmark fixtures target less than 8 ms CPU to preserve Free-plan headroom. A feature that cannot pass its behavior tests is removed from the advertised compatibility matrix rather than released as partial compatibility.

## Documentation and positioning

The README will describe v1.0.0 as a Cloudflare-native compatibility edition, not a byte-for-byte upstream port. A generated compatibility matrix will distinguish:

- supported and tested;
- preserved only for selected targets;
- intentionally unsupported due to platform or product boundaries.

Deployment documentation will state that all core features still use Workers, Static Assets, D1, Secrets, and optional Cache API behavior. Existing installations upgrade through D1 migrations without replacing their database or tokens.
