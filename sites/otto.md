---
name: otto
baseUrl: https://www.otto.de
viewport: Desktop 1440x900
---

# Site: otto.de

## Overview

otto.de is a large German general-merchandise marketplace (fashion, furniture,
electronics, household). The homepage mixes promotional carousels, voucher
overlays, and a top category navigation; most user value lives behind search
and the 15-item category bar.

## Critical user journeys

1. Open home → top-nav category tile (e.g. `Damen-Mode`) → drill into a
   subcategory tile.
2. Open home → type a term into the search box → land on `/suche/<term>/`
   results page with a visible product count and filter UI.
3. On a results page → open the filter panel → apply one filter → confirm
   the result count updates.

## Consent banner

- Vendor: OneTrust (TCF v2, exposes `window.OneTrust`, `window.__tcfapi`).
- Accept-all selector: `#onetrust-accept-btn-handler` (visible label: "OK").
- Reject-all selector: `#onetrust-reject-all-handler` (visible label:
  "Einwilligung ablehnen").
- Expected behavior: banner at `#onetrust-banner-sdk` hides after click;
  `OptanonConsent` cookie persists the choice across navigations, so the
  banner may not reappear on subsequent opens inside the same browser
  session.

## Known quirks

- Homepage renders a voucher/outfit overlay with a visible "Überspringen"
  (Skip) button above the fold — not consent, but a separate dismissable
  promo.
- Filter DOM uses a `heureka_` id prefix (`#heureka_filterSheetTemplate`,
  `#heureka_filterTitles`, `#heureka_filterlistExpanderMobile`) and custom
  elements prefixed `oc-` (e.g. `OC-EXPANDER-V1`).
- Category landing pages like `/damen/` are hub pages with subcategory
  tiles, not ready-to-filter product lists — drill one more level to reach
  a PLP.
- Search autosuggest overlays the header on focus; press Escape or click
  away to dismiss it before interacting with the rest of the page.

## Out of scope (project-wide)

- Checkout and real payments.
- Authenticated areas (`Mein Konto`, `Merkzettel` once personalized).
- Voucher activation flows (`Zur Aktivierung` buttons).
- Mobile app-only promotions ("Nur in der App").
