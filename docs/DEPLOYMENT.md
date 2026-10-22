# Deployment and data — E1/T02

2026-10-22 source inventory. Dashboard settings, deployed-source parity, actual
DDL, backup retention and live mobile/performance have not been verified.

## Vercel and environment

Static root HTML/assets plus five ESM Node functions under api/. vercel.json
version 2 explicitly maps /api/track, /api/carriers, /api/parcel-updates to their
.js functions, then /(.*) to /$1. News/news-post rely on function discovery.
No build/output/header/cache/clean-URL settings are defined. SQL handlers declare
nodejs runtime. Carrier JSON must be bundled and available relative to cwd.

Before release confirm project/root directory, framework preset, install/build
commands, Node version, region, domains, preview access, environment scopes and
current deployment ID in the dashboard. None are inferred to be verified values.
Do not deploy E1 solely to inspect configuration.

Environment variable NAMES only:

| Name | Purpose |
| --- | --- |
| TRACK17_KEY | Provider token |
| PARCEL_UPDATES_SECRET | Shared parcel/news write authorization |
| POSTGRES_URL | Driver pooled database connection |
| POSTGRES_URL_NON_POOLING | Driver direct database connection |
| PORT | Optional local listener selection |

Confirm provisioned driver/provider variables with owner; other generated names
are unknown. NEWS_SECRET is only an error message and is not read. Never copy
values into docs, fixtures, logs or git. Keep dev/preview databases isolated.

## Local setup

Use a Node version satisfying package.json engines (>=20.12, <25), preferably a
maintained release matched to preview. Run `npm ci`, `npm run check`,
`npm run dev`; open http://localhost:3000/. Server loads ignored .env using native
Node env loading before importing handlers; existing process variables win.
.env.local is not loaded. One loopback runtime serves static files and all five
production handlers. No static server/CLI needed. Stop with Ctrl-C.

Home and carriers work without credentials. News/parcel successful SQL needs a
test database; tracking needs test provider access and performs register/delete.
Missing configuration retains existing handler error responses. `check` uses
synthetic stubs, never external provider/database writes.

## Inferred database schema, not a migration

| Table | Columns referenced and requirements implied by SQL |
| --- | --- |
| news | id numeric lookup/generated on insert; title, summary, cover_url, slug, content_html text-like; published_at nullable timestamp-like; created_at default needed; updated_at explicitly set on edit. |
| parcels | code text-like, UNIQUE or equivalent required by ON CONFLICT(code); only code inserted. Other columns unknown. |
| parcel_updates | id generated on insert; code parcel identity; time timestamp-like; event/location text-like; created_at/updated_at insert defaults needed, updated_at set on edit. |

Implied relationship parcel_updates.code -> parcels.code; actual foreign key or
cascade rules unknown. Exact types, timezone, nullability, generated sequences,
indexes, defaults, triggers and slug uniqueness require actual DDL review.
News sorts publication/creation; parcel reads/target-latest use code/time/creation.
Do not create indexes/migrations from guesses. Preserve all IDs on restore.
No migrations exist. data/parcel-updates.json is sample/legacy, not a backup;
carrier catalog is a versioned file, not a table.

## Backup/recovery procedure

Owner must establish provider, access, retention, RPO/RTO and restoration owner.
Before future migration/cutover:

1. Record deployment commit and database environment/schema version (currently
   unversioned); coordinate a news/parcel write pause. Provider tracking state
   is separate and is not recovered by database restore.
2. Create an approved provider snapshot/PITR restore point if available. With
   approved credential injection and a direct connection, use matching-version
   pg_dump custom format to include schema, all related table data and sequence
   state. Never put connection strings in command history/output or git.
3. Encrypt and store outside git under restricted access, with timestamp,
   environment, checksum and retention. Verify archive readability using
   pg_restore list. Record counts/ID ranges privately; review schema-only DDL
   against this inference without exporting production records into fixtures.
4. Restore to a new isolated database via provider clone/PITR or pg_restore with
   reviewed role/ownership options. Never clean/restore the source database.
   Verify constraints, defaults, counts, legacy IDs, sequences above maxima,
   news ID/slug lookup and ordered parcel timelines.
5. Bind an isolated preview to the restore; perform contract reads and approved
   fixture CRUD there, validate HTML content, record restore duration/recovery
   point. Only a successful drill demonstrates readiness.

Incident recovery: pause writes, preserve failed database/deployment identifiers,
restore chosen point to a replacement, validate as above, then have owner switch
bindings and redeploy verified revision. Smoke-test pages/APIs/operator flows
before resuming writes. Reconcile data since the recovery point with operators.
Code rollback promotes previous known-good Vercel deployment; it does not undo
SQL writes. Retain original database pending reconciliation/retention approval.
No backup, restore, migration or deployment was performed in E1.

## Mobile/performance baseline

Audit source sizes: ~4.8 MiB tree, ~2.1 MiB images, ~936 KiB catalog; 14 home images
without lazy loading, external fonts/icons and legacy plugins. These are not
transfer sizes or measured scores. No rendered mobile/Lighthouse/CWV evidence.
On approved preview record commit/URL, device/viewport, browser, network/CPU,
cold/warm cache, LCP/CLS/INP (or lab proxy), transfer bytes and request counts.
Check narrow/mobile and desktop tracking, news, manual/scan parcel workflows;
retain screenshots/reports outside secret-bearing sessions. Compare identical
conditions after migration; no invented budgets. Actual DDL/recovery validation
belongs to T06, mobile/performance to T10/T16, cutover to T17.
