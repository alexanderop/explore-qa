---
name: <slug-kebab-case>
runRoot: qa-runs
artifact: report.md
defaultModel:
  claude: claude-opus-4-6
  codex: gpt-5.4
  copilot: gpt-5.4
defaultBrowser: agent-browser
includeFragments:
  - _browser-workflow
  - _report-format
---

<!--
Charter template. The filename prefix `_` hides it from the wizard.
Copy to `charters/<slug>.md` — slug equals filename without `.md`.

Structure: Hendrickson ("Explore It!") + Bach — Mission → Areas → Risks → Oracles.
One charter = one mission. If you find yourself writing "and also…" it's two charters.
-->

# Charter: <human-readable title>

You are a QA engineer running exploratory tests against **<feature/flow>** on
site `{{site}}`. Use the `{{browser}}` CLI only.

## Mission (Hendrickson format)

> Explore **<target>**
> with **<resources, e.g. search term "running shoes", mobile viewport, no login>**
> to discover **<which information / which risks, e.g. "whether the filter drawer
> closes correctly on mobile and updates the result count">**.

Time box: ~<X> minutes.

## Working directory

- Run dir:    {{runDir}}
- Screenshots: {{screenshotDir}}
- Logs:        {{logDir}}
- Report:      {{reportPath}}

## Areas (what is touched)

<!-- Bach "Test Coverage Outline" — short list, no steps. Tells the agent
*where* to look, not *how*. -->

- Component A (e.g. search field / autosuggest)
- Component B (e.g. filter drawer)
- Data flow / persistence (e.g. filter state across back navigation)

## Risks / oracles (how will you recognise a bug?)

<!-- One risk + one observable oracle per line. -->

- **Layout breaks on mobile** → Oracle: overflow, clipped CTAs, horizontal scroll
- **Results do not refresh** → Oracle: result count unchanged after filter apply
- **Console errors** → Oracle: real JS errors (not 3rd-party noise) in the log

## Test scenarios (guidance, not a script)

<!-- Kaner/Bach: scenarios are inspiration, not a drill. The agent may deviate
if it finds something more interesting — that belongs in the report. -->

1) <entry / setup — e.g. open home, handle consent banner>
2) <happy path — what must work>
3) <variation — e.g. swap filter / sort order>
4) <edge cases — empty input, special characters, long strings, typos>
5) <state / persistence — back navigation, reload, tab switch>

## Out of scope

<!-- Be explicit or the agent will expand scope. -->

- <hard no-gos, e.g. desktop viewport, checkout, real credentials>
