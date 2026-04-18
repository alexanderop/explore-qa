---
name: battle-playground
description: >-
  Generate a single-file HTML timeline playground for an agent-battle run.
  Reads the three `*_<agent>_agent-browser.md` reports under
  `qa-runs/charters/<charter>/`, parses the matching session JSONL logs,
  and writes `qa-runs/charters/<charter>/battle-timeline.html` — three
  side-by-side timelines with milestones, key moments, screenshots, and
  a shared playhead. Triggers on "battle playground", "timeline
  playground", "visualize the battle", "html timeline", or "generate a
  playground for <charter>".
---

# battle-playground — HTML timeline for agent-battle runs

One job: turn the most recent battle for a charter into a self-contained
HTML file that lets a human see at a glance what each agent did, when,
and with what evidence.

## Usage

```bash
python3 .claude/skills/battle-playground/generate.py <charter> [--open]
```

- `<charter>` — the charter name (folder under `qa-runs/charters/`).
  If omitted, the script picks the charter with the most recent battle.
- `--open` — also open the generated file in the default browser.

The script writes to `qa-runs/charters/<charter>/battle-timeline.html`.
It is fully self-contained: data is baked in as JSON, screenshots are
referenced by relative path into `_attachments/`. You can share the HTML
by zipping the charter folder.

## What it parses

For each agent (claude / codex / copilot) the script:

1. Reads the frontmatter of `<timestamp>_<agent>_agent-browser.md` to
   pick up `duration_s`, `findings`, `status`, and `model`.
2. Extracts the **finding severity + title** by grepping the summary table
   row (`| F-01 | <Sev> | <Title> | ...`).
3. Reads the matching `_attachments/.../logs/<agent>-session.jsonl` and
   normalises every event into `{ t, kind, label, detail }`. Each agent
   emits a different JSONL shape — the parser handles all three.
4. Lists screenshots from `_attachments/.../screenshots/*.png`.
5. Detects **milestones** by scanning event text for scenario keywords
   parsed from the charter's `## Scenarios` section.
6. Picks **key moments** — the 3–5 most substantive think/agent-message
   events, scored by keyword density (found, issue, unexpected, error,
   bug, filter, H1, zero-result, and so on).

## What to do when invoked

1. Confirm the charter name with the user if ambiguous, then run the
   script once with `--open`.
2. If the charter has no battle yet, tell the user to run
   `/agent-battle <charter>` first — **do not** try to generate anything.
3. After the file is written, point the user at the output path.

## Do not

- Do not hand-write the HTML. Use the script.
- Do not edit `battle-timeline.html` files after generation to patch
  issues — fix `template.html` or `generate.py` and re-run.
- Do not commit generated `battle-timeline.html` files. They are build
  artifacts living under the gitignored `qa-runs/` tree.
