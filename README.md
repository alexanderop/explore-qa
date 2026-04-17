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

```mermaid
flowchart LR
    you([YOU: pick a test goal])
    charter[charter + site profile]
    compose[compose<br/>prompt builder]
    brain[(brain:<br/>principles +<br/>past findings)]
    agent[claude / codex / copilot]
    browser[agent-browser /<br/>playwright-cli]
    site[(real website)]
    report[report.md +<br/>screenshots]

    you --> charter --> compose
    brain --> compose
    compose -- prompt --> agent
    agent --> browser --> site
    site --> report
    report -- read & triage --> you
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

```mermaid
flowchart LR
    subgraph INPUTS
        c[charters/&lt;charter&gt;.md<br/>the mission]
        s[sites/&lt;site&gt;.md<br/>baseUrl, journeys, quirks]
        p[prompts/_*.md<br/>system rules, honesty,<br/>browser workflow]
        bc[brain/_core/<br/>generic QA principles]
        bs[brain/sites/&lt;site&gt;/<br/>per-site findings]
    end

    compose[compose.ts<br/>builds full prompt]
    sp[systemPrompt<br/>+ userPrompt]
    agent[agent CLI<br/>claude / codex / copilot]
    browser[browser CLI<br/>agent-browser / playwright-cli]

    subgraph OUTPUTS
        runs[qa-runs/charters/&lt;charter&gt;/<br/>_attachments/&lt;runId&gt;/<br/>├─ report.md<br/>├─ screenshots/<br/>└─ logs/ session.jsonl<br/>&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;prompt-manifest.json]
    end

    c --> compose
    s --> compose
    p --> compose
    bc --> compose
    bs --> compose
    compose --> sp --> agent --> browser
    agent --> runs
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
   Also computes a `promptHash` and per-fragment `manifest` for regression
   tracking.
6. **`scripts/lib/agents.ts`** — switch over `claude` | `codex` | `copilot` that
   builds the right CLI invocation. Add new backends here only.
7. **`scripts/lib/browsers.ts`** — switch over `agent-browser` | `playwright-cli`
   that returns the tool name, the agent allowlist pattern, and any
   browser-specific env vars. Add new browser backends here only.

### Lifecycle of a charter run

```mermaid
flowchart TD
    cmd["bun scripts/qa.ts &lt;charter&gt; &lt;agent&gt; &lt;browser&gt; &lt;site&gt;"]
    s1[1. resolve settings<br/>CLI &gt; env &gt; qa.local.json &gt; charter]
    s2[2. compose prompt<br/>fragments + site + brain]
    s3[3. mkdir runDir<br/>qa-runs/.../&lt;runId&gt;/]
    s4[4. spawn agent CLI<br/>with allowlist for browser tool]
    s5[5. agent loops<br/>browse → observe → screenshot → note]
    s6[6. agent writes report.md<br/>SBTM + PROOF shape]
    s7[7. harness captures<br/>full session log → logs/]
    done[You read report.md, triage findings,<br/>optionally run /reflect to fold learnings<br/>into brain/sites/&lt;site&gt;/]

    cmd --> s1 --> s2 --> s3 --> s4 --> s5 --> s6 --> s7 --> done
```

Per run, artifacts land under `qa-runs/charters/<charter>/_attachments/<runId>/`:

- `report.md` / `result.md` — the agent-authored report
- `screenshots/` — named `<scenario>_<step>_<desc>.png`
- `logs/` — selective excerpts + full `<agent>-session.jsonl` +
  `prompt-manifest.json` (prompt fingerprint for regression tracking)

## Prompt versioning & regression tracking

Every run fingerprints the full composed prompt so you can tell whether a
difference in results comes from a prompt change, a site change, or agent
variance.

**What gets recorded:**

- **`promptHash`** (12-char sha256) — stored in the report frontmatter and the
  `qa-runs/README.md` index table. Same hash = identical prompt inputs.
- **`prompt-manifest.json`** — written to `logs/` alongside the session log.
  Lists each fragment that went into the prompt with its own 8-char hash:

  ```json
  {
    "promptHash": "134ed35118be",
    "fragments": [
      { "name": "charter:example-smoke", "hash": "a1458b34" },
      { "name": "frag:_browser-workflow", "hash": "a3deabf2" },
      { "name": "_system",               "hash": "ea6cedc8" },
      { "name": "_honesty-checks",       "hash": "8da638c7" },
      { "name": "site:example",          "hash": "d1248e95" },
      { "name": "brain:_core",           "hash": "147e5f93" }
    ]
  }
  ```

**Comparing two runs:**

```bash
bun scripts/compare-runs.ts \
  qa-runs/charters/smoke/2026-04-14_claude_agent-browser.md \
  qa-runs/charters/smoke/2026-04-17_claude_agent-browser.md
```

Output:

```
=== Prompt Changes ===
  promptHash: a3f8c2e91b04 -> b7d1e5f29c38
  Changed fragments: _honesty-checks

=== Results Delta ===
  Duration:  244s -> 310s  (+27%)
  Findings:  1 -> 3
  Status:    findings -> findings

=== Findings Diff ===
  Both runs:  F-01 Cart icon badge missing
  New in B:   F-02 Console 404 on /api/tracking; F-03 Viewport overflow

=== Verdict ===
  Prompt changed. Review changed fragments to assess impact.
```

**Dry-run preview:** `bun scripts/run-charter.ts <charter> --dry-run` prints
the prompt hash, manifest, full prompt, and CLI invocation without spawning an
agent.

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
- **`/agent-battle <charter>`** — run one charter in parallel across all three
  agents (`claude`, `codex`, `copilot`) on `agent-browser`, stream live status
  ticks from each session log, and produce a comparison report (speed,
  findings, discipline, report quality). Useful for picking which agent to
  trust on a given site, or for spotting prompt regressions.

  ```
  > /agent-battle otto-cart-to-checkout.md
  • Charter: otto-cart-to-checkout, site: otto. Starting all three agents in parallel.
  • Bash(bun scripts/qa.ts otto-cart-to-checkout claude  agent-browser otto)
  • Bash(bun scripts/qa.ts otto-cart-to-checkout codex   agent-browser otto)
  • Bash(bun scripts/qa.ts otto-cart-to-checkout copilot agent-browser otto)
  • All three agents launched. Scheduling first poll.
  • Three agents running on otto-cart-to-checkout. First status tick in ~60s.
  ```

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
