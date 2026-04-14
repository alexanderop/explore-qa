# CLAUDE.md

Notes for AI agents working on the `explore-qa` harness itself (not on charter runs).

## What this repo is

A site-agnostic, agent-driven exploratory QA harness. A thin Bun runner composes
a prompt from Markdown fragments + a site profile + generic QA brain principles,
then shells out to a coding-agent CLI (Claude / Codex / Copilot) that drives a
browser CLI (`agent-browser` or `playwright-cli`) through one test mission.

There is no build step, no production bundle — only `bun test`, `tsc --noEmit`,
and Biome. The "code" is ~500 lines of TypeScript plus a folder tree of Markdown.

## Prompts are English

Everything user-visible ships in English. Users who want another language edit
the fragments under `prompts/`, `charters/`, and the skill SKILL.md files
directly — there is no i18n layer.

## Key boundaries

- **`scripts/lib/agents.ts`** is the only place to add a new agent backend.
- **`scripts/lib/browsers.ts`** is the only place to add a new browser backend.
- **`scripts/lib/compose.ts`** is the only place that reads charters, site
  profiles, prompt fragments, or brain files. Don't scatter filesystem reads.
- Everything under `sites/` and `brain/sites/` is user-owned per fork. Never
  put project-generic content there.

## Editing prompt fragments

- Don't duplicate fragments. If a rule belongs in every run, it goes in
  `_system.md` or `_honesty-checks.md`, not into a charter body.
- Templates are `{{name}}` Mustache-style. Substitution lives in
  `compose.ts`. Add a key there if you need a new one.
- **`{{browser}} --help` first.** `_browser-workflow.md` tells the agent to
  read the live CLI help before the first step. That is what keeps the harness
  backend-agnostic — do not regress this by putting backend-specific
  subcommands back in the prompts.
- Screenshots only on findings and key states. Token/time budget.

## Brain discipline

- `brain/_core/` — generic principles, shipped with explore-qa. Edit carefully,
  keep it generic, never site-specific.
- `brain/sites/<site>/` — user-owned, gitignored by default. The `reflect`
  skill writes here after a charter run. `findings/*` are append-only; never
  edit them in place.

## Tests

`bun test` runs unit tests under `tests/`. The contract worth pinning is the
charter/frontmatter parser, the settings resolver, and the compose substitution
result — not the CLI plumbing or the IO wrappers.
