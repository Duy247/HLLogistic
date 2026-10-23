# Mobile header and hero handoff

Implemented for viewports at or below 768px:

- Shared header uses a sticky 64px white surface, unboxed 40px logo and 44px hamburger control. The utility topbar is hidden on mobile.
- Full-width dropdown contains the four original Vietnamese navigation links and a solid brand-green contact CTA. Closed links are hidden and inert. The control exposes aria-expanded/aria-controls; Escape closes and returns focus, link activation closes, outside clicks close, and breakpoint changes reset the menu. Focus outlines remain visible; reduced-motion preferences are respected.
- Home hero now follows the header in normal flow with 48px top content spacing. A brand-green gradient replaces the muddy mobile overlay. Its lightest stop is 78% #1C552A, yielding approximately 4.9:1 contrast for white text even over pure-white source pixels.
- Desktop styles, brand assets, routes and Vietnamese copy are retained. The hero photo and all other photos continue using Astro Image; index.astro required no markup change because the spacing and overlay are controlled in shared CSS.
- Menu behavior lives in the component's bundled script. Vite asset inlining is disabled so the small bundle is emitted as an external module compatible with a strict script-src CSP. Existing external /js/v2.js remains unchanged.
- Added a built-output regression test for external scripts, menu toggling, inert state, Escape focus restoration and desktop breakpoint reset. The check runner now discovers all *.test.js files.

Validation: npm run check includes Astro diagnostics, npm run build, JavaScript checks, all tests and built-route/asset verification. The existing HTTP integration test is skipped when sandbox loopback sockets return EPERM. No browser visual verification was available; inspect 320px, 375px, 768px and desktop widths before release. Existing unrelated Astro unused-variable hint and dependency unused-import build warning remain.

No commit or deployment performed.

## Real statistics follow-up

Updated home, about and feature stats to the same three figures: **6.826** Khách hàng hài lòng, **38.639** Lô hàng hoàn thành, and **59.286** Đánh giá tích cực. Removed all stats TODO labels and set each stats section's accessible label to `Số liệu`. Home icons now represent customers, shipments and positive reviews; English label translations were updated accordingly.

Stats grids use three equal, shrinkable columns on desktop and one column at widths <=768px. Mobile home stats have no vertical dividers. Zero-minimum grid tracks, shrinkable items and text wrapping keep the stats within the available width at 360px.

Validation: `npm run check` passed (including `npm run build`, tests and built-asset checks). Additional built-HTML assertions confirmed exactly three articles, all figures/labels and no TODO stats text on all three pages. The existing HTTP integration test remains skipped due to sandbox loopback restrictions. Chrome could not start in this sandbox, so the 360px layout was checked through CSS constraints rather than browser measurements. No commit performed.
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

## Contact map correction — 2026-10-22

- Replaced the invented blob on home/contact with shared `ContactMap.astro`, using public-domain Natural Earth 1:50m admin-0 geography downloaded from nvkelso/natural-earth-vector. Local generated paths cover 100–118°E, 8–27°N (southern China, Vietnam, Laos, Cambodia and adjacent Thailand/Myanmar); clean green outlines highlight Vietnam. The original caption is unchanged.
- Added accurate projected Hà Nội, Bằng Tường/Pingxiang (TRUNG QUỐC), Quảng Châu/Guangzhou and TP.HCM pins, plus dashed Guangzhou → Pingxiang → Hanoi route. No runtime map requests. Inline SVG is ~14.5KB, below 40KB.
- `scripts/generate-contact-map.js` documents the source URL and regenerates the checked-in data from downloaded GeoJSON: rectangular clipping, equirectangular projection and 0.45-unit Douglas–Peucker simplification. Data includes input SHA-256 and projection metadata.
- Validation: `npm run check` passes (build, Astro diagnostics, syntax/route checks, 61 acceptance tests pass; one HTTP integration test skips because loopback sockets are denied). `node scripts/check-v2.js` and `git diff --check` pass. Visually inspected a 342px-wide raster SVG render for the 390px viewport: labels remain readable without overlaps. Full Chromium reflow check was attempted but launch is blocked by sandbox socket permissions. No commit made.

## Supplemental public pages — 2026-10-22

- Ported `about`, `service`, `feature`, `price`, `team`, `testimonial`, `news` and `404` to `V2Layout` with the shared V2Header/V2Footer, brand logos, forest/green/lime palette, responsive cards, editorial photo sections and scrollable rate tables. Retained real Vietnamese copy, Chinese warehouse addresses, all rate rows/notices, platform artwork and testimonial content. English labels use `data-en`; the 404 now has Vietnamese copy and retains its English message through `data-en`. Removed empty social links and the final English team placeholder labels.
- All static photographs continue through `astro:assets` Image from `src/assets`; no photos were added to public. News keeps its existing API-driven cover URLs and article HTML. The unchanged news client retains all DOM IDs, list/detail endpoints, query IDs, pagination and back controls. Replaced the inert newsletter form with an email contact link.
- Removed unused Navbar, Footer and LegacyScripts components, public template stylesheet/scripts/navbar partial, and all animation/carousel/counter/easing/waypoint libraries. BaseLayout remains required by V2Layout and the protected news admin/mobile parcel routes. SiteHead retains Bootstrap and icon/font dependencies used by the news editor; unused template CSS/library links were removed. Protected page files, their client scripts and all APIs remain unchanged.
- The requested case-insensitive substring search also matched a real carrier website, `showl.com`. Its public JSON uses an equivalent Unicode escape for one letter; parsed catalog values remain identical to the canonical catalog. The build catalog assertion now compares parsed JSON to verify that identity without requiring identical serialization. No carrier entries or URLs changed.
- Validation: `npm run check` passes (Astro diagnostics: zero errors, existing mobile unused-variable hint; build; syntax/acceptance checks; built routes/assets/catalog checks). Existing acceptance tests: 61 passed, 0 failed, 1 skipped for sandbox loopback EPERM. Extended `scripts/check-v2.js` to cover these eight routes and JPEG as well as WebP photo URLs; it passes. Mocked news client checks verified list, cover URL, detail, query/back navigation and pagination against the built news DOM. Compared original paragraph/table-cell text to confirm content preservation. `rg -i "themewagon|htmlcodex|wow.min|owl" src public` returns no matches; `git diff --check` passes.
- No commit, deployment or production write. Browser screenshots and full responsive/keyboard verification remain outstanding as previously noted.

## Security remediation — 2026-10-22 (supersedes earlier authentication limitations)

- H1: News HTML passes through the maintained `ultrahtml` allowlist sanitizer after HTML5 normalization with `parse5`, on write, preview and every read (including legacy stored content). Both are pinned direct server dependencies already present in the lockfile; registry installation was unavailable in this sandbox. Formatting, tables, links and images survive; only link/image URL and text attributes are permitted. HTTP/HTTPS and link-only mailto URLs are allowed; event handlers, inline CSS, SVG/MathML, embedded documents, forms, script and dangerous URL schemes are removed. Titles are converted to plain text and rendered with textContent. Article rendering and server-sanitized previews use empty-sandbox iframes; news clients contain no innerHTML writes.
- H2/M2: News exclusively uses `NEWS_ADMIN_SECRET`; parcels retain `PARCEL_UPDATES_SECRET`. Server checks hash each supplied/expected value with SHA-256 and compare fixed-size digests using timingSafeEqual, failing closed for missing configuration or invalid types. Both APIs accept authenticated POST `{action: "verify", secret}` without touching storage. News and desktop/mobile parcel UIs verify with the server before unlocking. Every write still authenticates independently. News keeps its credential only in runtime memory and removes the legacy sessionStorage value; parcel password inputs stay in the current document and are never persisted. This implements the requested split-secret model, not individual staff sessions or HttpOnly cookies.
- M1: Tracking validates a 3–80 character alphanumeric/underscore/hyphen code, numeric carrier type/range and bounded carrier text. Its body cap is 4 KiB; all other API bodies are capped at 256 KiB across parsed/string/Buffer/stream forms. Tracking allows 10 requests/client/minute and 200 requests/instance/minute, sends Retry-After on 429, uses fixed provider endpoints with 8-second timeouts and refuses redirects. Lookup no longer deletes provider registrations. Provider errors and internal exceptions return generic messages; accepted tracking data remains available to the existing tracking UI.
- M3: Public list and ID/slug SQL require a non-null publication date no later than database now(). Draft/scheduled listing and loading require a valid news credential in `X-Admin-Secret`; all API responses use no-store to prevent staff data caching. Clearing the date on update now unpublishes a post. Existing null-date records will consequently disappear publicly until staff publish them.
- CORS accepts only `SITE_ORIGIN` (default `https://www.hltrungviet.com`) and omits an allow-origin header for originless requests. Foreign Origin requests, including preflights, receive 403. Supported methods and the admin header are advertised explicitly; Vary: Origin is set. Originless requests still require credentials for privileged operations.
- `vercel.json` adds CSP, X-Frame-Options DENY, nosniff, strict-origin-when-cross-origin referrer policy and Permissions-Policy. CSP allows only same-origin scripts; the mobile scanner script moved to a local file. Existing font/style CDNs and inline styles remain permitted, HTTPS article images remain supported, and same-origin camera access remains enabled. No broad script unsafe-inline/eval allowance.
- Admin visual changes are confined to working password/login controls, disabled parcel fieldsets until verification, and sandboxed preview rendering. No database migration, production/provider requests, deployment or git commit was performed.

### Environment and release actions

Only `.env.example` was added; all secret entries are empty. Configure values outside the repository:

- **New:** `NEWS_ADMIN_SECRET` — independent, high-entropy news credential. No fallback to the parcel credential.
- **New optional:** `SITE_ORIGIN` — exact approved origin, without trailing slash; set to the preview origin when testing a preview deployment.
- **Existing:** `PARCEL_UPDATES_SECRET`, `TRACK17_KEY`, and the Vercel Postgres connection environment (`POSTGRES_URL` example entry).

Rotate the former shared credential and distribute separate news/parcel credentials to the appropriate operators when deploying. Stored legacy news is sanitized at response time immediately; saving it persists the sanitized version. Back up content before any separate bulk cleanup.

The application rate limiter is bounded, in-memory and scoped to each warm server instance, including its global budget. Configure Vercel Firewall/edge limits for `/api/track` and staff APIs for shared limits across instances and cold starts; origin checks do not stop direct callers. Shared credentials remain accessible to the active admin document; individual short-lived staff sessions remain a separate auth migration.

### Validation

`npm run check` runs Astro diagnostics, build, JavaScript syntax checks, API acceptance fixtures, the added security regression suite and built route/asset checks. Tests use isolated SQL/provider mocks only. Tests cover sanitizer payloads and stability, write/read/preview sanitization, independent credentials, publication predicates, CORS, body limits, limiter expiry/throttling, generic errors, timeouts and headers. Local HTTP integration remains skipped because the sandbox denies loopback sockets (EPERM). Deployment headers, browser rendering/camera operation and cross-instance edge limits require verification after deployment in a network-enabled environment.

Final local results: `npm run check` passes with zero Astro errors/warnings/hints; 61 acceptance tests and 10 security tests pass, with one HTTP integration test skipped for sandbox EPERM. `node scripts/check-v2.js` and `git diff --check` also pass. The supplemental V2 check now expects the authenticated parcel controls. A provider mock additionally verifies that already-registered tracking codes remain readable without any delete request, using the documented duplicate-registration code from [17TRACK API docs](https://api.17track.net/en/doc).

## Clean public navigation — 2026-10-22

- `src/components/V2Header.astro` and `src/components/V2Footer.astro`: public links now use `/about`, `/service`, `/price`, `/news` (Tin tức / News), `/track` and `/contact`; brand links use `/`. Footer staff link remains present at `/parcel-updates`. No public admin links were added. Existing menu styling and hamburger behavior are retained.
- `src/pages/{about,contact,feature,index,news-admin,news,price,service,team,testimonial,track,404}.astro`: replaced internal `.html` links with root-relative clean paths, including the home tracking form action and the news editor's public news link. The 404 retains one Vietnamese page-not-found heading.
- `vercel.json`: enabled `cleanUrls`; all five API rewrites, function packaging and security headers are unchanged.
- `scripts/check-build.js`: linked-output checks now resolve clean page paths to generated `.html` files while still checking asset existence.
- `tests/navigation.test.js`: built header/footer regressions cover all requested public routes, News translation, staff route, absence of public admin/HTML links, `cleanUrls: true`, and a single 404 heading. Existing mobile-menu regression remains green.
- Validation: `npm run check` passed (Astro diagnostics, static build, JavaScript/test checks and built-route/asset verification); `git diff --check` passed. No `.html` references remain across `src`. Initial dependency installation hit sandbox EPERM during esbuild's install-time version probe; `npm ci --ignore-scripts` completed installation and the full check then passed. Vercel deployment behavior has not been tested live.
- No commit, branch change, deployment or production write performed.

## Public-page cleanup and staff indexing — 2026-10-22

This follow-up supersedes the earlier footer staff-link requirement.

- Deleted `src/pages/feature.astro`, `src/pages/team.astro` and `src/pages/testimonial.astro`. Removed their route expectations from `tests/fixtures/acceptance.json` and `scripts/check-v2.js`. No remaining links target these pages. Their images, platform assets and card styles are still used by about/service, so they were retained; there were no exclusive components or assets to delete.
- Removed the staff workspace link from `src/components/V2Footer.astro` entirely. Staff continue to use direct URLs.
- `src/layouts/V2Layout.astro` forwards its head slot to BaseLayout. `src/pages/parcel-updates.astro` supplies the robots meta tag through that slot; `admin-parcels.astro` inherits it through its existing parcel-page alias. `src/pages/news-admin.astro` and `src/pages/parcel-updates-mobile.astro` supply the same `noindex, nofollow` tag in their existing head slots.
- Added `public/robots.txt`: allows `/` and disallows news-admin, admin-parcels, parcel-updates and parcel-updates-mobile in both clean and `.html` forms.
- Updated `tests/navigation.test.js` to reject staff links in shared public navigation and verify built staff-page head tags, robots directives and absence of the deleted pages from build output.
- Validation: `npm run check`, `node scripts/check-v2.js` and `git diff --check` passed. No commit, branch change or deployment performed.

## Homepage hero tracking overflow — 2026-10-22

- Corrected the earlier incomplete fix: the aspect-ratio flex hero now has explicit `width:100%;min-width:0`. Its direct content child has `min-width:0;margin-inline:auto`; above 768px it uses `width:min(calc(100% - 80px),1240px);max-width:calc(100% - 80px);flex-shrink:0`. This constrains the parent as well as centering the content, independent of the shared wrap breakpoint.
- Retained shrinkable tracking grid columns and input. Desktop controls remain side by side; existing mobile rules retain the stacked layout at 390px. Only hero layout CSS changed; branding, colors, markup and CSP-safe JavaScript are unchanged.
- Computed desktop card bounds (CSS pixels; card fills content): 1024 → width 944, left 40, right 984; 1280 → width 1200, left 40, right 1240; 1440 → width 1240, left 100, right 1340. All right edges are <= viewport minus 40px. These are CSS calculations, not browser measurements. Chrome was not launched for this follow-up.
- Validation: `npm run build` and `npm run check` passed. No commit or deployment performed.
