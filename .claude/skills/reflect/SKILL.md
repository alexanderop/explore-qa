---
name: reflect
description: >-
  Update brain/sites/<active>/ with learnings from the last explore-qa charter
  run. Reads the report under qa-runs/, scans the session log, and writes new
  or edited nodes into brain/sites/<active>/. Triggers on "reflect", "update
  brain", "what did we learn from the last run".
---

# Reflect — update brain/sites/<active>/ from the last run

Manual step after a charter run. You are not the test agent — you are the
**librarian**. Extract learnings, persist them, dedupe ruthlessly.

## Identify the input

1. Ask the user for the run path, or find the last run automatically:
   ```
   ls -dt qa-runs/charters/*/_attachments/* | head -1
   ```
2. Identify the **active site**. Check in this order: `qa.local.json` `site`
   key, then the `site:` field in the run's frontmatter, then ask the user.
   All writes go under `brain/sites/<site>/`.
3. Read in this order:
   - the charter's report (e.g. `<runDir>/report.md`)
   - the run frontmatter (status, findings count, duration)
   - optional: `<runDir>/logs/<agent>-session.jsonl` only if the report is unclear

## Process

1. **Read `brain/_core/index.md` and `brain/sites/<site>/index.md`** (if it
   exists) — understand what already exists. Do not duplicate.
2. **Scan the report** for four categories of learnings:
   - **Component knowledge** → `brain/sites/<site>/areas/<slug>.md`
     How a UI component behaves, what traps exist, which selectors are stable,
     hydration quirks.
   - **False positive** → `brain/sites/<site>/findings/false-positives/YYYY-MM-DD-<slug>.md`
     A "bug" that the run verified as not-a-bug — with symptom, reality, and the
     counter-check that cleared it.
   - **Known issue** → `brain/sites/<site>/findings/known-issues/YYYY-MM-DD-<slug>.md`
     A confirmed bug, ideally with ticket ID and repro steps.
   - **Glossary** → `brain/sites/<site>/glossary/<slug>.md`
     A domain term a future run would otherwise misinterpret.
3. **Structural enforcement check** (before any brain write):
   Could the learning instead live as a sharpening of `prompts/_honesty-checks.md`,
   as an extension of an existing `areas/` node, or as a charter edit? If yes →
   no new brain node, write a backlog entry in `brain/sites/<site>/backlog.md`
   with the proposal.
4. **Dedup**: for each candidate `Grep -r "<keyword>" brain/sites/<site>/`.
   - Hit in `areas/` or `glossary/` → edit in place, set `lastUpdated`, justify
     the diff in your output.
   - Hit in `findings/*` → **do not write** (append-only, no updates).
   - No hit → create new.
5. **Update `brain/sites/<site>/index.md`** if nodes were added or removed.

## Discipline (hard, do not soften)

- **When in doubt: do not write.** A single bad note poisons 50 future runs.
- **findings/* are append-only.** Filename `YYYY-MM-DD-<slug>.md`. Never edit.
- **areas/glossary** may be edited, but every edit must be justified in the output.
- **No speculative nodes.** Only what was *actually observed* in the run.
- **No brain node without a concrete re-use case.** Ask: would this spare a
  future run a false positive or help it understand a component faster? If
  no, drop it.

## Frontmatter schema

```markdown
---
name: <slug>
type: area | finding-fp | finding-known | glossary
created: YYYY-MM-DD
lastUpdated: YYYY-MM-DD
links: [[other-node]]
---
```

## Output

Respond with a `## Reflect Summary` block:

```
## Reflect Summary

**New:**
- `<file>` — what and why

**Edited:**
- `<file>` — what and why

**Intentionally NOT written:**
- <learning> — why (duplicate / speculative / not observed / better as structural change)

**Backlog (structural improvements):**
- `prompts/<file>` or `charters/<file>` — sharpen / add / remove

**Index updated:** yes/no
```

Then remind the user to run `git diff brain/sites/<site>/` before committing,
or roll individual edits back with `git checkout`.
