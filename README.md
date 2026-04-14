# explore-qa

An agent-driven exploratory testing harness you can point at any website.

`explore-qa` is a thin Bun runner that composes a prompt from Markdown fragments
and shells out to a headless coding agent (Claude Code, Codex CLI, or Copilot CLI).
The agent drives a browser CLI (`agent-browser` or `playwright-cli`) through a
charter — one mission, exploratory, mobile-first by default — and writes a
Markdown session report following SBTM + PROOF.

It is not a test runner and it is not a scripted suite. It is closer to giving
a QA engineer a mission statement and a browser.

## Mental model for QA engineers

If you've done session-based exploratory testing, this is the same loop —
just with an LLM agent in the tester seat:

```
   YOU                       EXPLORE-QA                    AGENT + BROWSER
 ┌──────┐  charter +     ┌──────────────┐   prompt    ┌────────────────────┐
 │ Pick │  site profile  │   compose    │  ────────►  │  claude / codex /  │
 │ a    │ ─────────────► │  (prompt     │             │  copilot           │
 │ test │                │   builder)   │             │         │          │
 │ goal │                └──────────────┘             │         ▼          │
 └──────┘                       ▲                     │  agent-browser /   │
    ▲                           │                     │  playwright-cli    │
    │                           │ brain               │         │          │
    │                           │ (principles +       │         ▼          │
    │                           │  past findings)     │   real website     │
    │                                                 └────────────────────┘
    │                                                          │
    │                                                          ▼
    │                                                   report.md +
    └────────────  read & triage  ◄──────────────────   screenshots
```

You write the **charter** (the mission). The harness builds the **prompt**.
The agent runs the **session** in a real browser and hands you back a
**Markdown report** with findings, screenshots, and a session log you can audit.

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

What goes into one run:

```
                INPUTS                              OUTPUTS

  charters/<charter>.md  ──┐
  (the mission)            │
                           │
  sites/<site>.md  ────────┤
  (baseUrl, journeys,      │
   known quirks)           │
                           ├──►  compose.ts  ──►  agent CLI  ──►  qa-runs/
  prompts/_*.md  ──────────┤    (builds the      (claude/         charters/
  (system rules,           │     full prompt)     codex/           <charter>/
   honesty checks,         │                      copilot)         _attachments/
   browser workflow)       │           │                            <runId>/
                           │           ▼                            ├─ report.md
  brain/_core/  ───────────┤      systemPrompt                      ├─ screenshots/
  (generic QA              │      + userPrompt                      └─ logs/
   principles)             │           │                                ├─ <agent>-
                           │           ▼                                │  session
  brain/sites/<site>/  ────┘      browser CLI                           │  .jsonl
  (per-site findings,             (agent-browser /                      └─ excerpts
   gitignored)                     playwright-cli)
```

Seven moving parts:

1. **`sites/<name>.md`** — site profile. Frontmatter (`baseUrl`, `viewport`) +
   free-form Markdown body (critical journeys, consent banner, known quirks).
   Inlined into the system prompt for the active site.
2. **`charters/<name>.md`** — one charter = one test mission. Frontmatter
   (`runRoot`, `artifact`, `defaultModel`, `defaultBrowser`,
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

### Lifecycle of a charter run

```
  bun scripts/qa.ts <charter> <agent> <browser> <site>
        │
        ▼
  ┌────────────────────────────────────────────────────────────┐
  │ 1. resolve settings  (CLI > env > qa.local.json > charter) │
  │ 2. compose prompt    (fragments + site + brain)            │
  │ 3. mkdir runDir      qa-runs/.../<runId>/                  │
  │ 4. spawn agent CLI   with allowlist for the browser tool   │
  │ 5. agent loops:      browse → observe → screenshot → note  │
  │ 6. agent writes      report.md (SBTM + PROOF shape)        │
  │ 7. harness captures  full session log → logs/              │
  └────────────────────────────────────────────────────────────┘
        │
        ▼
  You read report.md, triage findings, optionally run /reflect
  to fold new learnings into brain/sites/<site>/.
```

Per run, artifacts land under `qa-runs/charters/<charter>/_attachments/<runId>/`:

- `report.md` / `result.md` — the agent-authored report
- `screenshots/` — named `<scenario>_<step>_<desc>.png`
- `logs/` — selective excerpts + full `<agent>-session.jsonl`

## Skills

`explore-qa` ships four skills under `.claude/skills/`, with a symlink at
`.agents/skills → ../.claude/skills` so all three agent CLIs pick them up:

- **Claude Code** reads `.claude/skills/` natively.
- **Copilot CLI** reads `.claude/skills/` natively (it also scans
  `.github/skills/` and `.agents/skills/`).
- **Codex CLI** only scans `.agents/skills/`, which is why the symlink exists.

The skills write to `brain/sites/<active>/`, which only `claude` can do reliably
today — `codex` and `copilot` can read the skills but aren't expected to run
`/reflect` or `/meditate`.

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

- env: `SITE`, `AGENT`, `BROWSER`, `MODEL`, `RUN_ID`, `RUN_DIR`, `CHARTER`
- `qa.local.json` (gitignored): `{ "site", "agent", "browser", "model" }`
- charter frontmatter: `defaultModel`, `defaultBrowser`

Copy `qa.local.json.example` to `qa.local.json` and edit once per machine.

## Agent permissions

All three agent CLIs run in fully permissive mode — the harness is
non-interactive, so the agent cannot stop to ask a human for approval, and a
single unapproved shell call would stall the whole run. Concretely
(`scripts/lib/agents.ts`):

- **Claude Code** — `--permission-mode bypassPermissions`
- **Codex CLI** — `--dangerously-bypass-approvals-and-sandbox`
- **Copilot CLI** — `--allow-all-tools` (the CLI help explicitly calls this
  "required for non-interactive mode")

This is intentional: charter runs are sandboxed to a scratch run directory
under `qa-runs/`, and the agents are told via prompt which browser CLI to use.
Only run `explore-qa` against sites and on machines where you're comfortable
giving a coding agent full shell access for the duration of the run.

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

- **Charter & mission framing** — from Elisabeth Hendrickson's *Explore It!*.
  A charter is a short mission statement ("explore X, with Y, to discover Z")
  that gives a tester a clear target without scripting every step. Each file
  under `charters/` is one such mission — it's what keeps a run focused and
  exploratory instead of drifting into ad-hoc clicking.
- **Session-based test management (SBTM)** — from James Bach, Jon Bach, and
  Michael Bolton. Testing happens in time-boxed, chartered sessions that
  produce a structured debrief: what was tested, what wasn't, what was found,
  and where time went. `report.md` follows this shape so a run is auditable
  after the fact, not just a wall of agent chatter.
- Brain/vault pattern: [poteto/brainmaxxing](https://github.com/poteto/brainmaxxing).
