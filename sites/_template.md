---
name: <site-slug>
baseUrl: https://example.com
viewport: iPhone 15 Pro
---

<!--
Site profile. One file per target site. Copy to `sites/<slug>.md` (slug without `.md`
equals the value you pass via `--site` / `SITE=`).

The `onboard-site` skill fills this in automatically. Edit by hand when a team
member discovers something persistent that every future run should know.

The body below is free-form Markdown and is inlined into the system prompt for
every run of this site — keep it tight.
-->

# Site: <human-readable name>

## Overview

One paragraph: what is this site, who uses it, what matters.

## Critical user journeys

Three to five flows a smoke test should never regress:

1. <e.g. open home → search → click first result>
2. <e.g. open category → apply filter>
3. <…>

## Consent banner

- Vendor: <e.g. OneTrust / Cookiebot / custom / none>
- Accept-all selector or visible label: <selector or button text>
- Expected behavior: <e.g. banner disappears within 500ms after accept>

## Known quirks

- <e.g. lazy-loaded filter drawer hydrates ~300ms after open>
- <e.g. back button loses scroll position on product list>

## Out of scope (project-wide)

- <e.g. checkout, real payments, authenticated areas>
