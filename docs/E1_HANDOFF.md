# E1 handoff — 2026-10-22

Prepared update for `/workspace/hllogistic/HANDOFF.md`, which this session cannot
write (read-only filesystem). Current checkout branch: `rework/e1-baseline`.
The checkout's `.git` is also read-only: git add/commit fail creating index.lock.
No commit has been made in the requested checkout, and nothing was pushed.

## Implemented in the working tree

- T01: docs/CONTRACT.md records all 15 page URLs (14 HTML files plus /), consumed
  queries, five API paths, methods, payload/response shapes, aliases, defaults,
  errors and operator workflows. tests/fixtures/acceptance.json is synthetic.
- T02: docs/DEPLOYMENT.md records source Vercel settings, environment NAMES only,
  SQL-inferred news/parcels/parcel_updates schema, backup/restore/rollback
  procedure, source asset baseline and missing mobile/performance evidence.
- T03: ESM server.js serves static site and directly imports all five production
  handlers after env loading; shared JSON reader handles pre-parsed objects,
  strings, Buffers and raw streams (including split UTF-8). Added dev/check
  scripts, engine declaration and focused fixture checks.

HTML/branding, vercel.json and production SQL/provider/auth/CORS logic are
unchanged. No database/provider writes, migrations or deployments performed.

## Validation and limits

Node 20.19.2: `npm run check` passes syntax checks and 61 handler/body tests;
one HTTP integration test skips explicitly on sandbox EPERM for loopback
listeners. News CRUD/pagination, parcel aliases/latest targeting and provider
register/info/delete use queued SQL/fetch stubs. Four body representations are
checked on write fixtures. git diff --check passes.

`npm ci` failed: npm registry DNS/network access is blocked; configured proxy
connection is also denied. `npm run dev` currently cannot import the absent
@vercel/postgres dependency. An independent local listener probe fails EPERM.
Both requested curl probes (/ and /api/carriers) were attempted and could not
connect. Successful local HTTP operation is not claimed. Actual database,
Vercel packaging, browser/camera and restore drill remain unverified.

## Required completion in a writable/network-enabled environment

1. Install dependencies with npm ci; run npm run check and ensure HTTP test runs
   rather than skips. Run npm run dev; verify GET / and GET /api/carriers using
   curl at localhost:3000. Check news/operator workflows against isolated data.
2. Review and commit changes on rework/e1-baseline in focused T01/T02/T03 commits.
   No push. Copy this update into the workspace HANDOFF.md when writable.
3. Confirm dashboard configuration, actual DDL/provider/backups and rendered
   mobile/performance baseline. Subsequent T04–T17 remain in TECH_AUDIT.md;
   T06 owns database/recovery validation, T10/T16 mobile/performance evidence.

A local-only temporary clone at `/tmp/hllogistic-e1-review` contains the three
focused commits on a branch named `rework/e1-baseline`. Their ordered patches
are prepared in `/tmp/hllogistic-e1-patches/`. After reviewing them in a writable
checkout at the baseline, apply with `git am /tmp/hllogistic-e1-patches/*.patch`.
Do not apply over the existing modified working tree without first preserving
or moving those changes. These artifacts do not update this checkout's branch
or the external handoff file, and they do not establish HTTP acceptance.
