# Release Process

Use this checklist before publishing a release.

This repository does not use GitHub Actions, Dependabot, or release automation.
Run the release checks locally, commit directly to `main`, tag the release, then create the GitHub Release.

## Branch Policy

- `main` is the release branch.
- Maintainer releases are prepared directly on `main`.
- Contributors can still open pull requests, but must paste local validation output because the upstream repository does not run GitHub CI.
- Do not add GitHub Actions, Dependabot, or release automation unless the maintainer explicitly changes this policy.

## 1. Verify

```bash
git status --short
pnpm run release:prepare -- v1.0.0
pnpm run check:release
pnpm run deploy:dry-run
```

The release must not include:

- subscription URLs
- node URIs
- admin tokens
- download tokens
- private D1 database IDs
- generated local seed SQL

## 2. Update Version Notes

Update:

- `package.json`
- `cloudflare/package.json`
- `CHANGELOG.md`
- `RELEASE_NOTES.md`

## 3. Tag

```bash
git tag -a v1.0.0 -m "v1.0.0"
git push origin main --tags
```

## 4. Create GitHub Release

```bash
gh release create v1.0.0 \
  --title "v1.0.0" \
  --notes-file RELEASE_NOTES.md
```

Do not attach local setup files or generated seed SQL.
