# UI v2 handoff — 2026-10-22

## Changed

- Ported the approved photographic v2 home, contact, tracking and parcel editor into native Astro layouts/components. Retained Vietnamese content, approved SVG logos, green/forest/lime/black palette, rates, six service descriptions and template attribution. Lime is an accent fill, not text on white.
- Preserved every existing route and query contract; added `/admin-parcels.html` as an alias of `/parcel-updates.html`. Other legacy pages and the mobile scanning workflow remain available.
- Tracking uses the existing carrier catalog, `/api/track` and `/api/parcel-updates`. Sources load independently, have separate error/retry states, reject stale responses and use the current carrier input on each lookup. API-derived text renders through textContent.
- Parcel editor reads real API events, selects explicit event IDs, preserves location/time fields, has separate create/update/delete controls, pending states and a cancel-first native delete confirmation. API handlers, database logic and API tests are unchanged.
- Removed write-secret entry fields from parcel/mobile/news admin pages. Existing endpoints still require their original authorization; no secret is embedded, stored or bypassed.
- All JPEG/WebP photographs moved from public into `src/assets`; every rendered photo uses `astro:assets` Image. Nine approved crops are in `src/assets/v2`; legacy photos are in `src/assets/legacy`. Removed public CSS photo backgrounds. Build checks verify generated image EXIF/XMP is absent. Public PNG logos, icons, platform artwork and schematic map remain non-photographic assets.
- Quote forms have labels, validation, retained input and a visually hidden honeypot with aria-hidden, tabindex -1 and autocomplete off. No quote API exists in this application: submitting explains that no request was sent and provides the real phone/email. No simulated delivery success.
- Contact map is static inline SVG. Statistics retain explicit illustrative TODO labels pending issue #36. Progressive motion honors reduced motion; optional VI/EN marketing labels retain the mockup's partial localization behavior.

## Validation

- `npm run check`: Astro diagnostics (zero errors; one pre-existing unused-variable hint), Astro build, JavaScript syntax, existing acceptance tests and built route/asset checks pass.
- Acceptance suite: 61 pass, 0 fail; 1 HTTP integration test skips because loopback sockets are denied (EPERM).
- `node scripts/check-v2.js`: photo placement, generated image URLs/metadata stripping, quote honeypots, static maps and no password inputs on v2 pages pass.
- `git diff --check`: passes.
- Dependencies were copied from the existing adjacent checkout for local verification; node_modules and build output are ignored. Package declarations/lockfile unchanged.

## Left / release limitations

- Auth integration remains necessary for staff writes. The unchanged API requires PARCEL_UPDATES_SECRET in its contract. Removing secret-entry UI intentionally means writes cannot authenticate in this static deployment; they report authorization failure rather than pretending success. Mobile scanning/manual entry and news code remain, but writes also require a future trusted authentication integration. No new insecure proxy or API contract change was introduced.
- Connect a real quote intake service with server validation and honeypot handling before claiming delivery. Current form directs customers to phone/email and preserves inputs.
- Replace illustrative statistics with approved values under issue #36; confirm rates with operations.
- Browser screenshots, keyboard/dialog checks, responsive reflow at 390×844 and 1440×1000, 200% zoom and camera hardware verification remain outstanding. Local HTTP integration cannot run in this sandbox.
- Supplemental routes retain their existing content/layout; their photos now use Astro's image pipeline. Full English localization remains out of scope.

## Commands

```sh
npm ci
npm run check
node scripts/check-v2.js
npm run build
npm run dev
```

Working tree is on `rework/ui-v2`. Commit was attempted but the sandbox denies writes to `/workspace/hllogistic/repo/.git/worktrees/ui-v2/index.lock` (read-only Git metadata). Changes remain uncommitted. No push, deployment, database migration or production write.

To commit once Git metadata is writable:

```sh
git add HANDOFF.md public src scripts/check-v2.js
git commit -m "Port approved v2 layouts to Astro with processed photos and live tracking"
```
