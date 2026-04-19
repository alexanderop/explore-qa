## Report ({{reportPath}})

Write the report **exactly** to this template. Keep the H2 headings, order, and
field names identical — no reordering, no renaming, no extra top-level sections.
Fill empty sections with `_none_` rather than omitting them. Template follows
SBTM (James & Jonathan Bach) + Jon Bach's PROOF debrief.

```markdown
# QA Session Report — <charter name>

## Session

- **Charter:** <one sentence: what was tested>
- **Run ID:** {{runId}}
- **Agent:** {{agent}}
- **Browser/Device:** {{browser}} / {{device}}
- **Site:** {{site}}
- **URL:** <tested URL>
- **Date:** <YYYY-MM-DD>
- **Duration:** <hh:mm>
- **Traffic light:** 🟢 green | 🟡 yellow | 🔴 red
- **One-sentence verdict:** <max 1 sentence>

## Task breakdown (% of the session)

| Category | % | Note |
|---|---|---|
| Setup | <n> | <e.g. consent banner, geo overlay> |
| Test design & execution | <n> | |
| Bug investigation & reporting | <n> | |
| Off-charter | <n> | <if you followed a trail outside the script> |

Sum must equal 100.

## Coverage

**Tested:**
- <area/scenario 1>
- <area/scenario 2>

**Not tested (deliberately out of scope):**
- <explicit omissions>

**Not reached (wanted to, couldn't):**
- <what was planned but blocked — or `_none_`>

## Findings

Summary table (sorted by severity):

| ID | Severity | Title | Scenario | Screenshot |
|---|---|---|---|---|
| F-01 | Critical/Major/Minor | <short> | <scenario> | `./screenshots/...png` |

### F-01 — <title>

- **Severity:** Critical | Major | Minor
- **Scenario:** <which scenario>
- **Repro steps:**
  1. …
  2. …
- **Expected:** <what should happen>
- **Actual:** <what actually happened>
- **Evidence:** ![<alt>](./screenshots/<file>.png)
- **Console/network:** <relevant excerpt or `_none_`>
- **Suspected cause:** <optional, clearly flagged as hypothesis>

(One H3 block per finding in the same structure. No findings → `_none_`.)

## Issues (blockers / open questions)

Problems that got in the way of testing (not product bugs):

- <e.g. browser CLI flag X did not work>
- <e.g. page object was broken>
- `_none_` if nothing

## Console & network anomalies (aggregated)

| Scenario | Type | Excerpt |
|---|---|---|
| <name> | console.error / 4xx / 5xx / slow | <short> |

## Accessibility

Quick a11y pass on the reached key states (not a full WCAG audit). Capture an
accessibility snapshot at each key state and report observations per category.
The table is mandatory — fill every row, use `_none_` only if no key state was
reachable at all.

| Category | Status | Notes |
|---|---|---|
| Landmarks & headings | ok / warn / fail | <short> |
| Labels & alt text | ok / warn / fail | <short> |
| Keyboard reachability & focus order | ok / warn / fail | <short> |
| Visible focus & contrast | ok / warn / fail | <short> |
| ARIA roles & states | ok / warn / fail | <short> |

Blocking a11y issues (screen-reader or keyboard use prevented) MUST also appear
as a Finding above with severity Major or Critical. Minor a11y issues stay in
this table only.

## PROOF debrief

- **Past** — what was done? <2–3 sentences>
- **Results** — what came out of it? <2–3 sentences>
- **Obstacles** — what was in the way? <1–2 sentences>
- **Outlook** — what should be tested next? <1–2 sentences>
- **Feelings** — confidence in the result (high/medium/low) + reason in one sentence.
```

### Screenshot embedding (mandatory)

Report lives at `{{reportPath}}`, screenshots under `{{screenshotDir}}`. Use
**relative** Markdown image links:

```markdown
![Consent banner](./screenshots/01-consent-banner.png)
```

No absolute paths. No wiki links (`![[...]]`). Screenshots only for findings and
key states — not after every step.

### Severity definitions (mandatory)

- **Critical** — main flow blocked, no workaround (e.g. feature never succeeds, app crash).
- **Major** — function limited or data wrong, workaround exists (e.g. filter does not apply, wrong counts).
- **Minor** — cosmetic, copy, layout detail without loss of function.
