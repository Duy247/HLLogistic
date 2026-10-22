# Compatibility contract — E1/T01

Source: baseline `fc3775e`, reviewed 2026-10-22. Observed source behavior is
recorded here; production parity is unverified. Fixtures are synthetic.

## Pages and query strings

All are GET static documents. Assets retain URLs under assets/, carriers/, css/,
img/, js/, lib/ and partials/, including `/partials/navbar.html`.

| Routes | Behavior and all consumed query parameters |
| --- | --- |
| `/`, `/index.html` | Home; carrier selection and tracking form navigate to track.html with number, carrier, carrierText. |
| `/about.html` | About |
| `/service.html` | Services |
| `/price.html` | Pricing/quote |
| `/feature.html` | Features |
| `/team.html` | Team |
| `/testimonial.html` | Testimonials |
| `/contact.html` | Contact/mailto form |
| `/404.html` | Explicit error document; source does not guarantee automatic platform fallback. |
| `/track.html` | number prefills and auto-submits; carrier is provider code; carrierText prefills selection text. Catalog lookup, external POST then internal GET timeline. Manual entry remains available. |
| `/news.html` | id loads article HTML via news-post; otherwise list. Load more in batches of 5 using offset/hasMore; detail/back controls use History API. |
| `/news-admin.html` | No queries. Secret stored in sessionStorage newsAdminSecret; list/load/new/save/delete; HTML code/split/preview modes and publication datetime. |
| `/parcel-updates.html` | No queries. Public read by code; secret-authorized CREATE/UPDATE/DELETE with optional updateId, time/event/location and response log. |
| `/parcel-updates-mobile.html` | No queries. BarcodeDetector camera scan or manual entry, secret-authorized CREATE, event/time/location, scan status and camera cleanup. |

Other queries are ignored; no extensionless marketing aliases/canonical redirects
are source-defined. Contact/quote open mail clients. Newsletter and empty/# links
have no implemented backend. Port-5500 tracking/parcel scripts target localhost:3000;
news is same-origin. Use the single local runtime normally.

## Shared API behavior

All five paths below allow origin `*` and Content-Type header. OPTIONS returns
204 empty. Unsupported methods return 405 `{error:"Method not allowed"}`.
CORS methods: carriers/news-post GET,OPTIONS; track POST,OPTIONS;
news/parcel GET,POST,OPTIONS. News also handles PUT/DELETE despite their omission
from CORS. E1 preserves that behavior. JSON writes accept pre-parsed object,
JSON string/Buffer or raw stream; empty body becomes `{}`. Malformed JSON reaches
500 error handling. No new validation/auth/CORS policy is introduced.

### GET /api/carriers

No query/payload. 200 returns carriers/apicarrier.all.json unchanged, with no
added wrapper. Browser consumes key and _name/name. Missing/invalid file -> 500
`{error}`. The catalog shape is preserved in fixture acceptance.

### POST /api/track

Payload `{number,carrier?,carrierText?}`. Trimmed number required (400).
Missing TRACK17_KEY -> 500 before validation. Truthy carrier converts to Number;
otherwise carrierText resolves leading digits, exact case-insensitive name, then
partial name. Unresolved carrier omitted upstream. Calls 17TRACK v2.4 register,
gettrackinfo, deletetrack sequentially with arrays of `{number,carrier?}`.
200 `{register,info,stop}` contains raw upstream JSON. Register HTTP or embedded
errors -> upstream status, `{error,detail:register}` (embedded errors may keep
HTTP 200). Info HTTP failure -> upstream status, `{error,detail:info}`.
Delete status unchecked; its JSON becomes stop. Exceptions -> 500 `{error}`.

### GET/POST /api/parcel-updates

GET query first truthy code / parcel / number, trimmed; missing -> 400
`code is required`. 200 `{code,updates:[event]}`, time DESC then created_at DESC.
Event fields: id, code, time, event, location, createdAt, updatedAt. Empty list
is success; database failure -> 500 `{error}`.

POST payload `{secret?,secretKey?,key?,mode,parcelCode?,code?,number?,updateId?,data?}`.
First truthy secret alias must match PARCEL_UPDATES_SECRET (401 on mismatch;
500 if config missing). Mode trims/uppercases; missing/unknown -> 400. Code uses
first truthy parcelCode/code/number, trimmed; missing -> 400 parcelCode is required.
Data defaults `{}`; first truthy aliases:

- time / timestamp / date / current day's UTC midnight;
- event / description / empty string;
- location / place / empty string;
- target: top-level updateId / data.id / data.updateId / latest event ID.

CREATE ensures parcels.code exists then inserts -> 200 `{code,update:event}`.
UPDATE targets code plus ID or latest by time/created_at -> same envelope;
missing target -> 404 Update not found. Omitted fields reset to defaults above;
this is replacement rather than a partial patch. DELETE same targeting -> 200
`{code,removed:event}`, missing -> 404. Parcel row remains. SQL errors -> 500.

### GET/POST/PUT/DELETE /api/news

GET queries limit (default 5, maximum 20) and offset (default 0); parseInt,
negative/NaN fallback, zero accepted. Fetches limit+1 sorted published_at DESC,
created_at DESC; no draft/future filter. 200 `{posts:[summary],hasMore,nextOffset}`;
nextOffset = offset + returned count. Summary fields: id,title,summary,coverUrl,
slug,publishedAt. SQL failure -> 500 `{error}`.

Writes use first truthy secret/secretKey/key, sharing PARCEL_UPDATES_SECRET;
mismatch -> 401; absent config -> 500 NEWS_SECRET not set (historical message,
not an environment variable read by code).
POST/PUT payload plus secret: `{title,contentHtml,summary?,coverUrl?,slug?,publishedAt?,id?}`.
Trimmed title/contentHtml required (400). Optional text trimmed, blank
summary/coverUrl stored null; blank slug derived using NFD accent removal,
lowercase, stripping non-ASCII-alphanumeric/space/hyphen and collapsing spaces/
hyphens (đ stripped). POST publishedAt defaults null. PUT coalesces null/omitted
publication date to existing value, replaces text fields and sets updated_at.
PUT requires parseInt id (400 NaN); missing row -> 404 Post not found.
POST 200 `{post:{id,title,summary,coverUrl,slug,publishedAt,createdAt}}`;
PUT 200 `{post:{id,title,summary,coverUrl,slug,publishedAt,updatedAt}}`.
Stored contentHtml is omitted in write responses.
DELETE `{id,secret...}` -> 200 `{removed:{id}}`; invalid id -> 400;
missing -> 404. Parsing/SQL errors -> 500 `{error}`.

### GET /api/news-post

Query id or slug; truthy id wins, parsed as integer (NaN -> 400 id must be a
number). Neither -> 400 id or slug is required. 200
`{post:{id,title,summary,coverUrl,slug,contentHtml,publishedAt,createdAt}}`;
missing -> 404 Post not found. No publication filter. SQL error -> 500 `{error}`.

## Acceptance cases and evidence limits

`npm run check` runs syntax checks and fixture cases against the real handlers
with SQL/provider stubs, plus local HTTP checks. tests/fixtures/ contains route,
API request/response and operator acceptance data. No live credentials or writes.
Browser acceptance remains manual on a fixture-backed preview:

- All marketing routes, shared nav, Vietnamese branding, attribution and mailto.
- Home tracking URL, direct query auto-run, carrier selection, external/internal
  timelines. Existing external-failure coupling and initial-carrier override
  are deferred to T11.
- News load-more/detail/back/forward; admin create/load/edit/delete, code/split/
  preview and dates. Existing popstate pushState defect and admin limit=50
  capped to 20 remain for T12.
- Desktop read/create/update explicit/update latest/delete explicit/delete latest;
  mobile scan/manual create, camera-denied fallback and camera stop.

Unit/HTTP checks do not establish browser rendering, camera or live SQL behavior.
