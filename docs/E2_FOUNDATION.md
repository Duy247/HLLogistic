# Astro foundation

All 14 page entry points are in `src/pages/*.astro`. `build.format: file`
produces the original `.html` filenames in `dist/`; `index.astro` produces
`index.html`, served at both `/` and `/index.html`. Query strings continue to
be consumed by the original browser code. Do not enable Vercel clean URLs.

`BaseLayout.astro` owns the document shell, language, title, favicon links and
head/body slots. `SiteHead`, `Navbar`, `Footer`, and `LegacyScripts` consolidate
shared UI and dependencies. Operator pages retain their original simpler shell
through `standardHead={false}` and the named head slot. All pages use BaseLayout.
The shared footer now consistently uses the existing home page's Vietnamese
branding/contact details and template attribution, replacing template variants.
The navbar is rendered at build time; `public/js/navigation.js` only marks the
current link. The original partial and includes script retain their public URLs
for compatibility, but Astro pages no longer fetch them.

## Commands

Use Node >=20.19 and <25. The Astro, TypeScript and Astro check versions are
exact in package.json. Dependency installation is blocked in the implementation
sandbox. The existing E1 lockfile still needs regeneration with `npm install`
in a network-enabled environment; review and retain the resulting lockfile.
After that, `npm ci` is the normal reproducible installation command.

- `npm run dev`: Astro with all five production API handlers through local Vite
  middleware on port 3000; legacy `.html` requests map to their Astro pages.
- `npm run build`: static Astro output in dist/.
- `npm run preview`: builds and serves dist/ plus the same production handlers.
- `npm run check`: Astro/TypeScript check, Astro build, existing API/body/HTTP
  fixture suite, then generated legacy-route/link/branding/catalog checks.

The local API runtimes load ignored `.env` before importing handlers. Fixtures
use only synthetic configuration and SQL/provider stubs. Do not exercise real
tracking or write APIs without an isolated test environment.

## Deployment

Vercel uses `vercel.json`: Astro framework, npm install, npm run build, static
output dist/, five explicit API rewrites, and cleanUrls=false. Root `api/`
remains Vercel Node serverless functions; there is no Astro SSR adapter. The
carrier catalog stays at root for handlers and is explicitly included in
function bundles. Its public copy preserves `/carriers/apicarrier.all.json`.
Keep those copies identical; the build check enforces this.

Existing serverless contracts and service code are unchanged. Only the local
preview static root changed from the checkout to dist/. Private application
sources and environment files are not copied to public/.

## Applying the mockups later

Replace shared navigation/footer/head presentation in src/components and the
shell in src/layouts/BaseLayout.astro. Replace each page's content in src/pages;
keep original route filenames, field IDs, query handling and API calls until
feature scripts are deliberately migrated. Public assets live under public/
at their original URLs, including the current logo and CSS colors.

`/workspace/hll-design/mockups/` contains prototypes with fixture interactions;
do not replace real API behavior with their mock data. The prototype operator
page omits scanning, so retain mobile scanning/manual entry when integrating.
Styles and feature scripts remain legacy/global/inline intentionally in this
foundation. Their TypeScript conversion and behavior repairs are later work.
