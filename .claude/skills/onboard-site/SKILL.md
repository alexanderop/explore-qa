---
name: onboard-site
description: >-
  Scaffold a new site profile for explore-qa by browsing the target URL,
  mapping critical user journeys, and generating sites/<name>.md, two or
  three starter charters, and brain/sites/<name>/. Triggers on
  "onboard site", "add site", "set up for <url>", or when a user asks how
  to point explore-qa at a new website.
---

# onboard-site — scaffold a new site for explore-qa

You run as **site scout**, not as a test agent. Goal: in a single session,
turn a URL into a working site profile + a minimal set of charters that a
future `bun scripts/qa.ts` run can execute end-to-end.

Only the `claude` backend supports this skill.

## Preconditions

1. Confirm `agent-browser` is on PATH (`agent-browser --help`). If missing, stop
   and tell the user: `npm i -g agent-browser && agent-browser install`.
2. Read `sites/_template.md` and `charters/_template.md` for structure of truth.
3. Read `CLAUDE.md` — respect the invariants (no backend-specific browser
   commands baked into charters, `{{site}}` substitution in charters, no
   site-specific content in `prompts/` or `brain/_core/`).

## Interview

Ask the user, in one turn (bundle via AskUserQuestion if available):

1. **Target URL** (e.g. `https://example.com`).
2. **Short site name** (kebab-case, used as the filename and `{{site}}` value).
   Propose a default from the hostname; let the user override.
3. **Scope hint** — e-commerce, content site, SaaS app, search engine, or
   other. Used to pick starter charters.
4. **Viewport** — default `iPhone 15 Pro`. Override only if the user insists.
5. **Authoring language** — the language the site profile and charters should
   be written in. Default `English`. Offer the site's primary language as a
   second option when it's obviously non-English (e.g. `otto.de` → German,
   `rakuten.co.jp` → Japanese). The harness prompts stay English regardless —
   only the user-owned content under `sites/` and `charters/` is translated.
   If the user picks a non-English language, write mission, areas, risks,
   scenarios, overview, journeys, and known quirks in that language. Keep
   frontmatter keys, `{{site}}`/`{{browser}}` placeholders, selectors, URLs,
   and fragment names (`_browser-workflow`, `_report-format`) as-is.
   **Also add a "Report language" directive to every generated charter body**
   (e.g. `**Report language:** German — write the final report at {{reportPath}},
   all finding titles, summaries, and notes in German. Keep code, URLs,
   selectors, and log excerpts verbatim.`). The `_report-format` fragment
   itself stays English — the per-charter directive overrides the output
   language so reports match the authoring language the user picked.

If `sites/<name>.md` already exists, ask: overwrite, edit, or pick a different
name. Never silently overwrite.

## Discovery (browse, do not guess)

Use `agent-browser` to collect ground truth. Do NOT fabricate selectors.

1. `agent-browser --help` first — learn the live subcommands.
2. Open the target URL, take one snapshot (accessibility tree / DOM).
3. Detect the consent banner:
   - Look for common vendors (OneTrust, Cookiebot, TrustArc, Didomi, custom).
   - Capture the accept-all button's visible label and, if available, a stable
     `id` or `data-*` attribute.
   - If no banner appears within ~3 seconds, record "none".
4. After accepting the banner, take another snapshot. List the top-level
   navigation items from the DOM.
5. Identify 2–3 critical journeys based on the scope hint:
   - e-commerce → home → search → results → filter drawer
   - content site → home → article → navigation back
   - SaaS app → landing → sign-in (no credentials, just the form) → error states
   - search → home → query → results
6. Open each candidate journey one hop deep to confirm it is reachable from
   home without login or payment. If a journey is blocked, drop it and note
   it under "out of scope" instead.

Close the browser cleanly at the end.

## Write (in this exact order)

All paths are relative to the repo root.

1. **`sites/<name>.md`** — fill the `sites/_template.md` structure:
   - `name`, `baseUrl`, `viewport` in the frontmatter
   - Overview paragraph (one paragraph only)
   - Critical user journeys (numbered list, from Discovery step 5)
   - Consent banner block (vendor, accept selector or label, expected behavior)
   - Known quirks (only what you *actually observed*, e.g. a visible hydration
     delay — no speculation)
   - Out of scope (explicit — auth, checkout, real payments)

2. **`charters/<name>-smoke.md`** — a smoke charter scoped to the
   home page + top nav. Copy `charters/_template.md`, fill in the placeholders,
   remove HTML comments, reference `{{site}}` rather than the hardcoded URL.

3. **One or two focused charters** named `<name>-<journey>.md` — one per
   critical journey from Discovery step 5. Same rules as the smoke charter.
   Skip this step if discovery surfaced only one reliable journey.

4. **`brain/sites/<name>/index.md`** — a short stub:
   ```markdown
   # Brain — <name>

   Per-site knowledge. Written by the `reflect` skill after charter runs.
   Append-only under `findings/*`, editable under `areas/` and `glossary/`.
   ```
   Also `mkdir -p brain/sites/<name>/{areas,findings/known-issues,findings/false-positives,glossary}`.

5. **`qa.local.json`** — if the file does not exist, create it with
   `{ "site": "<name>", "agent": "claude", "browser": "agent-browser" }`.
   If it exists, update the `site` key and preserve every other key as-is.
   Never clobber the user's existing agent/browser/model overrides.

## Validate before handing back

- `bun scripts/qa.ts --list` must show the new site under "Sites" and the new
  charters under "Charters". `_template` entries must NOT appear.
- `bun test` must pass (the frontmatter parser is the contract that covers
  the new charter file).

## Output

Respond with a `## Onboard Summary` block:

```
## Onboard Summary

**Site:** <name> → <baseUrl>
**Consent banner:** <vendor or "none">
**Critical journeys:** <comma-separated>
**Charters created:** <list>
**Brain scaffold:** brain/sites/<name>/

**Next step:** bun scripts/qa.ts <name>-smoke claude agent-browser <name>
```

Then tell the user to `git diff` and commit when satisfied.

## Discipline

- **No selectors you did not observe.** If discovery failed to find the consent
  accept button, write "not detected — verify manually" rather than guessing.
- **No site content in `prompts/` or `brain/_core/`.** Everything site-specific
  goes under `sites/` or `brain/sites/<name>/`.
- **Charters reference `{{site}}`, not a hardcoded URL.** This is what makes
  future site swaps a one-file change.
- **One charter per mission.** If discovery finds five journeys, write two
  or three charters, not one "mega" charter.
- **Do not run the new charter automatically.** That is the user's call.
