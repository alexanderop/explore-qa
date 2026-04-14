---
name: meditate
description: >-
  Maintenance pass over brain/. Finds contradictions, duplicates, stale nodes,
  and implied principles. Makes NO automatic changes — only proposes.
  Triggers on "meditate", "brain audit", "clean up brain".
---

# Meditate — audit brain/

Manual maintenance run. You are not the test agent and not the reflect agent —
you are the **auditor**. Find problems in the brain, propose fixes, change
nothing without user approval.

## Process

1. Read `brain/_core/index.md` and `brain/sites/<site>/index.md` for the active site.
2. Read **all** nodes under `brain/_core/principles/` and under the active site's
   `areas/`, `glossary/`, `findings/`. For large vaults, sample + anything linked
   from the index.
3. Look for these problem classes:

### Contradictions

Two nodes that logically contradict each other. Example: an `area` node calls a
selector stable, a newer `finding-known` shows the same selector has changed.

### Duplicates

Two nodes that say the same thing. Propose: merge into the older node, keep its
filename, drop the newer.

### Stale

`area`, `glossary`, `principle` with `lastConfirmed` older than 90 days.
Propose: re-confirm in the next run, or delete if no longer relevant.

### "Flipped" false positives

If the same slug or symptom appears under both `findings/false-positives/` and
`findings/known-issues/`, reality has changed and the former false positive is
now a real bug. Propose: archive the false positive (move to
`findings/archive/`, do NOT delete — keep history).

### Unstated principles

If 3+ `area` nodes make the same observation (e.g. "this selector is only
stable after hydration"), it is a candidate for a new `principles/` node in
`brain/_core/`. Propose: principle slug + rationale.

### Linking gaps

`area` nodes without a `links:` frontmatter, or wiki links pointing at nothing.
Propose: add or remove.

## Output

Write `brain/sites/<site>/MEDITATE.md` (overwrites previous results) with
numbered proposals:

```markdown
# Meditate — YYYY-MM-DD

## 1. <short title>
- **Class:** Contradiction | Duplicate | Stale | FP→Bug | Unstated Principle | Linking
- **Affected:** `brain/<file>`, `brain/<file>`
- **Finding:** <what you found>
- **Proposal:** <concrete action>
- **Rationale:** <why>

## 2. ...
```

## Discipline

- **No automatic edits.** Not a single byte without explicit human approval.
- **No proposals without a concrete finding.** "Could be cleaned up" is not a
  proposal. "Nodes X and Y both say Z, merge into X" is a proposal.
- **If nothing was found: empty output is fine.** "Brain is clean, no action
  needed" is a valid result.
