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
