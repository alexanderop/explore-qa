---
name: confirm
description: >-
  Live-reproduce findings from an explore-qa run report against the real site
  using `agent-browser --headed`, so the user can watch and judge whether each
  finding is a real bug. Triggers on "confirm", "verify finding", "reproduce
  the bug", "run the report against the site".
---

# Confirm — live-reproduce a run's findings in a visible browser

You are not the test agent and you are not the librarian. You are the
**witness**: you walk through each finding from the latest report in a visible
browser, so the user can see what happens with their own eyes and decide
whether the finding stands.

## Identify the input

1. If the user names a report path, use it. Otherwise pick the most recent run:
   ```
   ls -t qa-runs/charters/*/*.md | grep -v battle-timeline | head -1
   ```
2. Read the report. Pull out:
   - the `findings:` count from frontmatter
   - the URL(s) from the Session block
   - every entry under `## Findings` (id, title, repro steps, expected, actual)
3. If `findings: 0`, tell the user there is nothing to confirm and stop.

## Reproduce in headed mode

For each finding, in order:

1. **Read `agent-browser --help` first.** Subcommands change; do not guess.
2. Run every browser command with `--headed` so the window is visible.
3. Set the viewport from the report's "Browser/Device" line
   (e.g. `agent-browser --headed set viewport 1440 900`).
4. Walk the **exact repro steps** from the report. Do not improvise a shorter
   path — the user is watching to judge whether the steps themselves are sound.
5. Capture both the **DOM truth** and the **visual truth**:
   - DOM: `agent-browser --headed eval "..."` or `get text <sel>` — what the
     code actually contains.
   - Visual: `screenshot /tmp/confirm-<finding-id>.png` then `Read` it inline,
     so you can describe what a sighted user would see.
6. Compare against the report's "Expected" and "Actual". State explicitly
   whether the live behavior matches "Actual" (reproduced), matches "Expected"
   (not reproduced — possibly fixed or flaky), or sits between the two
   (partially reproduced — common when DOM and visual disagree).

## Discipline

- **One finding at a time.** Don't batch. The user is using the visible
  browser to follow along.
- **Don't close the browser at the end.** Leave it open on the last verified
  state so the user can poke around.
- **Don't re-test the whole charter.** Only the listed findings. If you
  notice something else, mention it briefly but do not chase it.
- **Trust the live page over the report.** If the report says "X is broken"
  and live X works, the report is wrong (or fixed) — say so. Do not bend the
  evidence to match the report.
- **Severity may shift.** A finding that reproduces in the DOM but renders
  fine visually is usually less severe than the report claims; one that the
  report calls Minor but blocks a real user flow is more severe. Call this
  out — that judgment is the whole point of running this skill.

## Output

After all findings, respond with a `## Confirm Summary` block:

```
## Confirm Summary

Report: `<path>`
Findings checked: N

| ID | Status | Note |
|---|---|---|
| F-01 | reproduced | DOM matches report, visual is fine — severity should drop to a11y/SEO only |
| F-02 | not reproduced | Page now behaves as Expected — likely fixed since the run |
| F-03 | partial | Steps land on the right page, but the actual symptom no longer appears |

Browser left open at: <last URL>
```

Then ask the user which findings (if any) they want to file, downgrade, or
drop from the report.
