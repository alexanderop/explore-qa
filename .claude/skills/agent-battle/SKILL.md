---
name: agent-battle
description: >-
  Run one explore-qa charter in parallel across all three agents
  (claude, codex, copilot) on agent-browser, stream concise live status
  updates from each session log, and produce a comparison report at the
  end (speed, findings, discipline, report quality). Triggers on
  "agent battle", "compare agents", "run all three", "which agent is
  better at <charter>".
---

# agent-battle — side-by-side run across the three agent CLIs

User input: a charter name (e.g. `example-smoke`) and optionally a site.
If either is missing, ask once, then proceed — no further explanation.

## Phase 1 — Start three runs in parallel

Spawn **all three** in the background with `run_in_background: true`, each
with a generous timeout (~10 min, `600000` ms). One Bash call per agent, run
in parallel in a single message:

```bash
qa <charter> claude  agent-browser <site>
qa <charter> codex   agent-browser <site>
qa <charter> copilot agent-browser <site>
```

Tell the user in one sentence that all three are running. No tables, no todo
list — the live commentary is the output of this skill.

## Phase 2 — Self-paced polling via /loop dynamic mode

Do **not** use `Monitor` + `tail -F`. It is fragile (rate limits, late files,
no state between events). Instead use `ScheduleWakeup` as a self-paced polling
loop with a byte-offset state per log.

One-time setup:

1. Glob `qa-runs/charters/<charter>/_attachments/<today>_*_agent-browser/logs/*-session.jsonl`
   to find the three log paths. Files appear ~5–15 seconds after launch — if not
   all three are present on the first tick, re-glob on the next tick.
2. Create a state file (e.g. `/tmp/agent-battle-<charter>-state.json`) with
   `{"claude": 0, "codex": 0, "copilot": 0}` — byte offsets per agent.
3. First `ScheduleWakeup` with `delaySeconds: 60`, `prompt: "<<autonomous-loop-dynamic>>"`,
   reason: a short, concrete sentence (e.g. `"first poll for <charter> battle"`).

Per loop iteration:

1. Read the state file → offsets per agent.
2. For each agent: read only the new bytes (`tail -c +$((offset+1)) <log>` or
   `python3` with `seek`). Parse each new line as JSON and extract the events
   you care about:
   - **claude**: `"name":"TodoWrite"` → todo step; `"name":"Bash"` with a
     `description` → short activity note; `"type":"result"` → run finished.
   - **codex**: `"type":"item.completed"` with an `agent_message` → quote the
     `text` field; `"type":"task.completed"` → run finished.
   - **copilot**: `"type":"assistant.turn_end"` → turn done; `is_error:true`
     → error; `"interaction.completed"` / `"shutdown"` → run finished.
3. Write the updated offsets (`wc -c` of each log) back to the state file.
4. Check the background tasks via `TaskList`. If all three are `completed` →
   go to Phase 4.
5. Otherwise schedule the next `ScheduleWakeup`. Choose cadence dynamically:
   - High activity (>3 events in the last tick) → `delaySeconds: 60`
   - Moderate (1–2 events) → `delaySeconds: 90`
   - Quiet (0 events, tasks still running) → `delaySeconds: 120`
   - **Never go over 180s** — a battle takes ~5–10 min, anything slower and
     you lose visibility into the run.
   - `prompt` stays `"<<autonomous-loop-dynamic>>"`. The `reason` should be
     short and specific (e.g. `"polling 3 agents, codex quiet"`).

## Phase 3 — Live updates (serious tone, not commentary theatre)

Per tick, write a short status update — factual, concise, one line per agent
that produced new events. Rules:

- **Tone:** neutral engineering voice. No sports metaphors, no "kick-off", no
  "goal", no "red card". Think status channel, not live sports feed.
- **Length:** 2–5 sentences per tick. One line per agent with new activity.
  No tables, no code blocks, no markdown headings.
- **Silence:** if an agent produced no events this tick, either skip it
  entirely or note briefly that it's still running. Do not speculate about why
  it's quiet — it may simply be inside a tool call that doesn't emit an event
  the parser recognises.
- **User interjections:** if the user asks "what is agent X doing right now",
  **peek the jsonl directly** (last 100–300 lines parsed with `python3`:
  claude `assistant.message` / `tool_use.input`, codex `agent_message.text`,
  copilot `assistant.turn_end`). Don't guess, don't wait for the next tick.
- **Completion events:** when any background task flips to `completed`, state
  it plainly: `<agent> finished in <duration>`.

Example of the target tone:

> claude: took a screenshot of the home page, opened the nav drawer.
> codex: still loading the filter panel (~45s since last event).
> copilot: turn 4 complete, no errors reported.

## Phase 4 — Final comparison report

Once **all three** background tasks report `completed`:

1. Stop the monitor loop (no more `ScheduleWakeup`).
2. Read the three reports in parallel (three `Read` calls in one tool block):
   `qa-runs/charters/<charter>/<timestamp>_<agent>_agent-browser.md`
3. From each report's frontmatter pull: `duration_s`, `findings`, `status`.
   Count screenshots in the matching `_attachments/.../screenshots/` folder.
   Also pull the first-finding severity + title from each report's summary
   table row (`| F-01 | <Sev> | <Title> |`).
4. **Write a persistent summary file** at
   `qa-runs/charters/<charter>/<date>_battle-summary.md` (same date the three
   runs share) using the template in *Summary file structure* below. Use
   `Write`, not `Edit` — overwrite if it already exists for this date.
5. Post the **comparison report** inline in chat:
   - A Markdown table: Duration / Findings / Screenshots / Severity per agent.
   - One short paragraph per agent: strengths and weaknesses observed in the run.
   - A clear one-sentence verdict: which agent produced the most useful output
     for this charter and why.
   - End with two lines pointing at the artefacts — the summary file and, if
     the user wants a timeline visualisation, the `battle-playground` skill
     (run `python3 .claude/skills/battle-playground/generate.py <charter> --open`).

### Summary file structure

```markdown
---
charter: <charter>
date: <YYYY-MM-DD>
agents: [claude, codex, copilot]
verdict: <agent>
---

# Agent battle — <charter> — <date>

## Comparison

| agent   | duration | findings | shots | severity | report                                      |
|---------|----------|----------|-------|----------|---------------------------------------------|
| claude  | ...      | ...      | ...   | Minor    | [link](./<ts>_claude_agent-browser.md)      |
| codex   | ...      | ...      | ...   | Minor    | [link](./<ts>_codex_agent-browser.md)       |
| copilot | ...      | ...      | ...   | Major    | [link](./<ts>_copilot_agent-browser.md)     |

## Findings by agent

### claude — <Sev> — <Finding title>
One or two sentences: what the finding is and why it matters.

### codex — <Sev> — <Finding title>
...

### copilot — <Sev> — <Finding title>
...

## Observations per agent

- **claude** — one short paragraph: how it approached the charter, what it
  covered well, where it struggled or wandered.
- **codex** — same.
- **copilot** — same.

## Verdict

One paragraph naming the winner and explaining the reasoning against the
evaluation axes (speed / substance / discipline / report quality / resilience).
Then a one-line call-out of each loser's clearest strength so the reader
knows when they would pick it instead.
```

The summary file is the durable artifact — it outlives the chat log and is
what `reflect` and downstream tooling will read later. Keep it tight
(under ~150 lines) and write the finding paragraphs from the **report
bodies**, not from what you observed in the live session log — the report
bodies are what the agent itself considered canonical.

## Evaluation axes (for the final verdict)

Speed alone does not win. Weigh:

- **Speed** — `duration_s`. Shorter is better, but not decisive.
- **Substance** — number of *well-supported* findings with repro steps. An
  empty "0 findings" report with nothing but frontmatter is weak; an honest
  "0 findings" with a detailed residual-risk section is strong.
- **Discipline / honesty** — did the agent notice stale refs or broken
  selectors and cleanly reset, instead of fabricating a finding? (See
  `prompts/_honesty-checks.md`.)
- **Report quality** — are repro steps complete? Console notes, residual risk,
  scenario breakdown present? Or just empty frontmatter?
- **Resilience** — when errors occurred, did the agent change strategy or keep
  running into the same wall?

## Do not

- No todo list for the skill itself. The live commentary is the output.
- No verdict before Phase 4. The final report only fires once all three are done.
- Do not narrate every single Bash call. Report only meaningful events.
- Do not pause to ask the user whether to continue mid-run. The battle was
  started intentionally — finish it.
