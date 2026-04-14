---
name: example-smoke
runRoot: qa-runs
artifact: report.md
defaultModel:
  claude: claude-opus-4-6
  codex: gpt-5.4
  copilot: gpt-5.4
defaultMaxTurns: 10
defaultBrowser: agent-browser
includeFragments:
  - _browser-workflow
  - _report-format
---

# Charter: example.com smoke

You are a QA engineer running a minimal smoke check against site `{{site}}`
using the `{{browser}}` CLI. This charter ships with explore-qa so the harness
has something to run out of the box — replace it with real charters via the
`/onboard-site` or `/new-charter` skill.

## Mission

> Explore **the home page of the active site**
> with **a mobile viewport (iPhone 15 Pro), no login**
> to discover **whether the page renders without console errors and the main
> navigation is reachable**.

Time box: ~2 minutes.

## Working directory

- Run dir:    {{runDir}}
- Screenshots: {{screenshotDir}}
- Logs:        {{logDir}}
- Report:      {{reportPath}}

## Areas

- Home page first paint
- Top-level navigation links
- Console / network errors

## Risks / oracles

- **Page does not render** → Oracle: blank viewport or HTTP error
- **Broken main nav** → Oracle: a top nav link is missing or 404s
- **Console errors** → Oracle: real JS errors in the log

## Test scenarios

1) Open the base URL from the active site profile.
2) Take one screenshot of the home page (key state).
3) List the top-level navigation items from the DOM.
4) Note any console errors or failing network requests.

## Out of scope

- Any flow beyond the home page.
- Desktop viewport.
- Authenticated areas.
