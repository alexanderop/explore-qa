# explore-qa

An agent-driven exploratory testing harness you can point at any website.

`explore-qa` is a thin Bun runner that composes a prompt from Markdown fragments
and shells out to a headless coding agent (Claude Code, Codex CLI, or Copilot CLI).
The agent drives a browser CLI (`agent-browser` or `playwright-cli`) through a
charter — one mission, exploratory, mobile-first by default — and writes a
Markdown session report following SBTM + PROOF.

It is not a test runner and it is not a scripted suite. It is closer to giving
a QA engineer a mission statement and a browser.

## Quickstart

Prereqs: [Bun](https://bun.sh), at least one of `claude` / `codex` / `copilot`
on your PATH, and at least one browser CLI:

```bash
npm i -g agent-browser && agent-browser install
# or
npm i -g @playwright/cli && playwright-cli install --skills
```

Then:

```bash
git clone <this-repo> explore-qa
cd explore-qa
bun install

# 1. onboard a site (Claude Code required for this step)
#    Open this folder in Claude Code, then run:
#    /onboard-site https://example.com
#
#    This scaffolds sites/<name>.md, one or two starter charters, and
#    brain/sites/<name>/ for per-site learnings.

# 2. run a charter
bun scripts/qa.ts                  # interactive wizard
bun scripts/qa.ts --list           # list charters / sites / agents / browsers
bun scripts/qa.ts example-smoke claude agent-browser example   # direct
```

The harness ships with one placeholder site (`example`) and one smoke charter
(`example-smoke`) so `bun scripts/qa.ts` works out of the box. Replace them
with your own via `/onboard-site`.

## How it works

Seven moving parts:

1. **`sites/<name>.md`** — site profile. Frontmatter (`baseUrl`, `viewport`) +
   free-form Markdown body (critical journeys, consent banner, known quirks).
   Inlined into the system prompt for the active site.
2. **`charters/<name>.md`** — one charter = one test mission. Frontmatter
   (`runRoot`, `artifact`, `defaultModel`, `defaultMaxTurns`, `defaultBrowser`,
   `includeFragments`) + Markdown body with mission, areas, risks, scenarios.
3. **`prompts/_*.md`** — shared prompt fragments. `_system.md` and
   `_honesty-checks.md` are always inlined into the system prompt;
   `_browser-workflow.md` and `_report-format.md` are opt-in via
   `includeFragments`.
4. **`brain/_core/`** — generic, shipped principles; always inlined.
   **`brain/sites/<name>/`** — user-owned, per-site findings; inlined only for
   the active site. Gitignored by default.
5. **`scripts/lib/compose.ts`** — loads the charter, parses frontmatter,
   substitutes `{{site}}` / `{{browser}}` / `{{runDir}}` / etc., concatenates
   fragments + site profile + core brain into `{ prompt, systemPrompt, meta }`.
6. **`scripts/lib/agents.ts`** — switch over `claude` | `codex` | `copilot` that
   builds the right CLI invocation. Add new backends here only.
7. **`scripts/lib/browsers.ts`** — switch over `agent-browser` | `playwright-cli`
   that returns the tool name, the agent allowlist pattern, and any
   browser-specific env vars. Add new browser backends here only.

Per run, artifacts land under `qa-runs/charters/<charter>/_attachments/<runId>/`:

- `report.md` / `result.md` — the agent-authored report
- `screenshots/` — named `<scenario>_<step>_<desc>.png`
- `logs/` — selective excerpts + full `<agent>-session.jsonl`

## Skills

`explore-qa` ships four Claude Code skills under `.claude/skills/`. They only
work with the `claude` agent (other agents cannot write to `brain/`).

- **`/onboard-site <url>`** — scaffold `sites/<name>.md`, two or three starter
  charters, and `brain/sites/<name>/` by browsing the target and asking a few
  questions. Run this once per new site.
- **`/new-charter`** — guided Q&A to add a new charter for the active site.
- **`/reflect`** — after a charter run, extract learnings and write them into
  `brain/sites/<active>/areas/` or `findings/*`. Never runs during a headless
  charter run.
- **`/meditate`** — audit `brain/` for duplicates, contradictions, stale nodes.
  Proposes only; does not edit.

## Settings precedence

Settings resolve in this order (highest wins):

CLI args > env vars > `qa.local.json` > charter frontmatter > hardcoded defaults.

- env: `SITE`, `AGENT`, `BROWSER`, `MODEL`, `MAX_TURNS`, `RUN_ID`, `RUN_DIR`, `CHARTER`
- `qa.local.json` (gitignored): `{ "site", "agent", "browser", "model", "maxTurns" }`
- charter frontmatter: `defaultModel`, `defaultMaxTurns`, `defaultBrowser`

Copy `qa.local.json.example` to `qa.local.json` and edit once per machine.

## Editing prompts

Invariants:

- Don't duplicate fragments. If a rule belongs in every run, it goes in
  `prompts/_system.md` or `prompts/_honesty-checks.md`, not in a charter body.
- Templates are `{{name}}` (Mustache-style). Add a key in `compose.ts` if you
  need a new one.
- `{{browser}} --help` first. The workflow fragment instructs the agent to read
  the live CLI help before the first step — this is what keeps the harness
  backend-agnostic. Don't put backend-specific subcommands back in the prompts.
- Screenshots only on findings and key states. Token/time budget.

## Credits

- Charter & mission framing: Elisabeth Hendrickson, *Explore It!*
- Session-based test management: James Bach, Jon Bach, Michael Bolton.
- Brain/vault pattern: [poteto/brainmaxxing](https://github.com/poteto/brainmaxxing).
