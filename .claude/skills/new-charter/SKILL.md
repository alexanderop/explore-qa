---
name: new-charter
description: >-
  Create a new explore-qa charter file from charters/_template.md in a guided
  Q&A flow. Triggers on "new charter", "add charter", "create charter", or
  when the user describes a test mission they want to persist.
---

# new-charter — add a charter cleanly

You run as **charter author**, not as a test agent. Goal: turn a user idea into
an executable charter file that follows the Hendrickson/Bach discipline and
fits the explore-qa harness.

## Preflight

1. Read `charters/_template.md` — source of truth for structure.
2. Read `CLAUDE.md` section "Editing prompts" — invariants (no fragment
   duplication, no backend-specific CLI calls, `{{browser}} --help` first).
3. `ls charters/` — does the proposed slug collide with an existing charter?
   If yes → ask the user (overwrite? rename? edit the existing one?).
4. Identify the active site (from `qa.local.json` or ask). Charters use
   `{{site}}` so they work against any site profile — do not hardcode URLs.

## Interview (short, purposeful — skip questions the user already answered)

Ask in this order, one question per turn (or bundled via AskUserQuestion if
available):

1. **Mission in one sentence** — what should be explored? If the answer
   contains "and also…" → push back: that is two charters.
2. **Hendrickson mission**: Target / Resources / Information-Discovery. Help
   the user cast it into `Explore <X> with <Y> to discover <Z>`.
3. **Slug** (kebab-case, short, e.g. `search-mobile-full`, `nav-mobile`).
4. **Areas** (3–6 components or data flows touched — Bach Test Coverage Outline).
5. **Risks + oracles** (3–5 lines, one risk → one observable symptom).
6. **Scenarios** (4–8 guidance bullets — not step-by-step scripts).
7. **Out of scope** — explicit, what is *not* tested.

If the user says "just do it", read an existing charter in `charters/` as a
model and propose a default — **but confirm before writing**.

## Write

1. Copy `charters/_template.md` to `charters/<slug>.md`.
2. Replace every `<...>` placeholder with interview answers.
3. Remove all HTML comments (`<!-- ... -->`) — they are author hints, not part
   of the executable charter.
4. Check the frontmatter:
   - `name` equals the filename without `.md`
   - `defaultModel` set for all three agents (claude / codex / copilot)
   - `includeFragments` minimal: always `_browser-workflow`; `_report-format`
     for anything beyond a smoke check.
5. Keep the charter site-agnostic: reference `{{site}}`, not a hardcoded URL.

## Validate

- `bun scripts/qa.ts --list` → the new charter must appear; `_template` must not.
- `bun test` → the frontmatter parser must not crash.
- **Do not auto-run** the new charter. That is the user's call.

## Discipline

- **One charter = one mission.** If it reads as "search AND filter AND sort
  AND wishlist" → push back, split.
- **Don't reinvent the wheel.** Before adding a new charter, ask: could this
  be an edit to an existing charter? (Exception: existing charters are not
  grown to expand scope — new scope = new charter.)
- **No backend-specific browser commands in the charter.** The agent discovers
  commands via `{{browser}} --help`. This is a rule, not a style.

## Output

Respond with a `## New Charter Summary` block:

```
## New Charter Summary

**File:** `charters/<slug>.md`
**Mission:** Explore <X> with <Y> to discover <Z>.
**Areas:** <comma-separated>
**Out of scope:** <short>

**Next steps:**
- Review: `cat charters/<slug>.md`
- Dry run: `bun scripts/qa.ts <slug> claude agent-browser <site>`
- Commit when OK.
```
