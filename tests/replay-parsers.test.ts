import { describe, expect, test } from "bun:test";
import { scoreFinding, scoreFindings } from "../scripts/lib/replay/confidence.ts";
import { parseConsoleLog } from "../scripts/lib/replay/console.ts";
import { anchorFindings, extractVerdict, parseFindings } from "../scripts/lib/replay/findings.ts";
import {
  addMilestones,
  charterKeywords,
  extractKeyMoments,
} from "../scripts/lib/replay/milestones.ts";
import { parseSessionLog } from "../scripts/lib/replay/parsers.ts";
import { assignTimes, scaleToDuration, spread } from "../scripts/lib/replay/timing.ts";
import type { Finding, ReplayEvent } from "../scripts/lib/replay/types.ts";

describe("parsers.parseSessionLog (claude)", () => {
  const jsonl = [
    JSON.stringify({
      type: "assistant",
      message: {
        content: [
          { type: "text", text: "I am reading the help." },
          {
            type: "tool_use",
            name: "Bash",
            input: {
              description: "run screenshot",
              command: "agent-browser screenshot --out a.png",
            },
          },
        ],
      },
    }),
    JSON.stringify({ type: "result", duration_ms: 123 }),
  ].join("\n");
  const { events, hasRealTimestamps } = parseSessionLog("claude", jsonl);

  test("extracts text → think, Bash → classified kind", () => {
    const kinds = events.map((e) => e.kind);
    expect(kinds).toContain("think");
    expect(kinds).toContain("shot");
    expect(kinds).toContain("done");
  });
  test("no real timestamps for claude", () => {
    expect(hasRealTimestamps).toBe(false);
  });
});

describe("parsers.parseSessionLog (codex)", () => {
  const jsonl = [
    JSON.stringify({
      type: "item.completed",
      item: { type: "agent_message", text: "Starting the run." },
    }),
    JSON.stringify({
      type: "item.completed",
      item: { type: "command_execution", command: "agent-browser open https://example.com" },
    }),
  ].join("\n");
  const { events } = parseSessionLog("codex", jsonl);

  test("extracts think + nav", () => {
    expect(events[0]?.kind).toBe("think");
    expect(events[1]?.kind).toBe("nav");
  });
});

describe("parsers.parseSessionLog (copilot)", () => {
  const jsonl = [
    JSON.stringify({
      type: "assistant.message",
      timestamp: "2026-04-18T12:00:00.000Z",
      data: { content: "Hello", toolRequests: [] },
    }),
    JSON.stringify({
      type: "assistant.message",
      timestamp: "2026-04-18T12:00:10.000Z",
      data: {
        content: "",
        toolRequests: [
          { name: "bash", arguments: { command: "agent-browser screenshot --out b.png" } },
        ],
      },
    }),
  ].join("\n");
  const { events, hasRealTimestamps } = parseSessionLog("copilot", jsonl);

  test("copilot has real timestamps", () => {
    expect(hasRealTimestamps).toBe(true);
  });
  test("copilot events carry relative t", () => {
    expect(events[0]?.t).toBe(0);
    expect(events[1]?.t).toBe(10);
  });
});

describe("timing", () => {
  test("spread linearly distributes events over duration", () => {
    const raw = [
      { kind: "think" as const, label: "a" },
      { kind: "think" as const, label: "b" },
    ];
    const out = spread(raw, 10);
    expect(out[0]?.t).toBe(0);
    expect(out[1]?.t).toBe(5);
  });

  test("scaleToDuration stretches the last event to duration when shorter", () => {
    const raw = [
      { kind: "think" as const, label: "a", t: 0 },
      { kind: "think" as const, label: "b", t: 5 },
    ];
    const out = scaleToDuration(raw, 100);
    expect(out[1]?.t).toBe(100);
  });

  test("assignTimes dispatches by hasRealTimestamps", () => {
    const raw = [{ kind: "think" as const, label: "a" }];
    expect(assignTimes(raw, 10, false)[0]?.t).toBe(0);
    expect(assignTimes(raw, 10, true)[0]?.t).toBe(0);
  });
});

describe("milestones", () => {
  test("charterKeywords pulls first non-stopword per scenario", () => {
    const body = `
## Scenarios

- **Scenario 1 — Submit laufschuhe**: enter query laufschuhe
- **Scenario 2 — Filter by marke**: apply filter
`;
    const k = charterKeywords(body);
    expect(k.length).toBe(2);
    expect(k[0]?.label).toMatch(/Scn 1 · laufschuhe/i);
  });

  test("addMilestones anchors keywords to first matching event", () => {
    const events = [
      { t: 1, kind: "act" as const, label: "type laufschuhe", detail: "" },
      { t: 2, kind: "nav" as const, label: "open filter", detail: "apply marke" },
    ];
    const ms = addMilestones(events, charterKeywords(`- **Scenario 1 — Open marke filter**: x`));
    expect(ms.some((m) => m.label.toLowerCase().includes("marke"))).toBe(true);
  });

  test("extractKeyMoments scores think events by MOMENT_RE", () => {
    const events = [
      { t: 1, kind: "think" as const, label: "nothing special" },
      { t: 2, kind: "think" as const, label: "found a bug in the filter" },
    ];
    const km = extractKeyMoments(events);
    expect(km.length).toBeGreaterThan(0);
    expect(km[0]?.text).toMatch(/bug|filter/i);
  });
});

describe("findings", () => {
  const report = `---
charter: x
---

## Session

- **One-sentence verdict:** Search works but filter count is off.

## Findings

| ID | Severity | Title | Scenario | Screenshot |
|---|---|---|---|---|
| F-01 | Major | Wrong count | Filter | \`./screenshots/f01.png\` |

### F-01 — Wrong count

- **Severity:** Major
- **Scenario:** Filter by marke
- **Repro steps:**
  1. Open search
  2. Apply filter
- **Expected:** count X
- **Actual:** count Y
- **Evidence:** ![proof](./screenshots/f01.png)
- **Console/network:** _none_
- **Suspected cause:** stale cache
`;

  test("parseFindings picks up the H3 block", () => {
    const fs = parseFindings(report);
    expect(fs.length).toBe(1);
    const f = fs[0];
    if (!f) throw new Error("missing finding");
    expect(f.id).toBe("F-01");
    expect(f.severity).toBe("Major");
    expect(f.reproSteps).toEqual(["Open search", "Apply filter"]);
    expect(f.screenshotBasename).toBe("f01.png");
  });

  test("extractVerdict reads the Session line", () => {
    expect(extractVerdict(report)).toMatch(/Search works/);
  });

  test("anchorFindings attaches t when screenshot filename appears in an event", () => {
    const fs = parseFindings(report);
    const events = [
      {
        t: 5,
        kind: "shot" as const,
        label: "screenshot",
        detail: "agent-browser screenshot --out ./screenshots/f01.png",
      },
    ];
    const anchored = anchorFindings(fs, events, [
      { name: "f01.png", rel: "./screenshots/f01.png" },
    ]);
    expect(anchored[0]?.anchorT).toBe(5);
  });
});

describe("parsers capture tool results", () => {
  test("Claude pairs tool_use.id → tool_result.content for snap events", () => {
    const jsonl = [
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              id: "toolu_abc",
              name: "Bash",
              input: { command: "agent-browser snapshot" },
            },
          ],
        },
      }),
      JSON.stringify({
        type: "user",
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_abc",
              content: "button 'Submit' ref=s1e42",
            },
          ],
        },
      }),
    ].join("\n");
    const { events } = parseSessionLog("claude", jsonl);
    const snap = events.find((e) => e.kind === "snap");
    expect(snap?.result).toMatch(/Submit/);
  });

  test("Codex captures aggregated_output on command_execution", () => {
    const jsonl = JSON.stringify({
      type: "item.completed",
      item: {
        type: "command_execution",
        command: "agent-browser snapshot",
        aggregated_output: "textbox 'Search' ref=s1e9",
      },
    });
    const { events } = parseSessionLog("codex", jsonl);
    const snap = events.find((e) => e.kind === "snap");
    expect(snap?.result).toMatch(/Search/);
  });

  test("Copilot pairs toolCallId → tool.execution_complete.result", () => {
    const jsonl = [
      JSON.stringify({
        type: "assistant.message",
        timestamp: "2026-04-18T12:00:00.000Z",
        data: {
          content: "",
          toolRequests: [
            {
              toolCallId: "call_xyz",
              name: "bash",
              arguments: { command: "agent-browser snapshot" },
            },
          ],
        },
      }),
      JSON.stringify({
        type: "tool.execution_complete",
        timestamp: "2026-04-18T12:00:05.000Z",
        data: {
          toolCallId: "call_xyz",
          result: { content: "heading 'Otto Search' ref=s1e1" },
        },
      }),
    ].join("\n");
    const { events } = parseSessionLog("copilot", jsonl);
    const snap = events.find((e) => e.kind === "snap");
    expect(snap?.result).toMatch(/Otto Search/);
  });
});

describe("console.parseConsoleLog", () => {
  test("extracts level + message and attaches source line", () => {
    const raw = `# Console errors observed during session
# Page: https://example.com

[error] Failed to load resource: the server responded with a status of 400 ()
  Source: https://api.example.com/ping

[warning] Dropped payload due to filtering
  (routine APM noise)
`;
    const entries = parseConsoleLog(raw);
    expect(entries.length).toBe(2);
    expect(entries[0]?.level).toBe("error");
    expect(entries[0]?.source).toContain("api.example.com");
    expect(entries[1]?.level).toBe("warning");
  });

  test("empty log → empty list", () => {
    expect(parseConsoleLog("")).toEqual([]);
    expect(parseConsoleLog("# only comments")).toEqual([]);
  });
});

describe("confidence.scoreFinding", () => {
  const mkEvent = (t: number, kind: ReplayEvent["kind"], label = ""): ReplayEvent => ({
    t,
    kind,
    label,
  });
  const base: Finding = {
    id: "F-01",
    severity: "Major",
    title: "x",
    anchorT: 100,
    reproSteps: [],
  };

  test("3+ post-anchor inspect/snap events → high", () => {
    const events = [
      mkEvent(90, "think"),
      mkEvent(110, "inspect", "eval check1"),
      mkEvent(120, "snap", "snapshot"),
      mkEvent(140, "shot", "screenshot"),
    ];
    const scored = scoreFinding(base, events);
    expect(scored.confidence).toBe("high");
    expect(scored.verifications?.length).toBe(3);
  });

  test("1-2 events → medium", () => {
    const events = [mkEvent(130, "inspect", "eval")];
    expect(scoreFinding(base, events).confidence).toBe("medium");
  });

  test("0 events in window → low", () => {
    const events = [mkEvent(99, "inspect", "before anchor"), mkEvent(300, "inspect", "too late")];
    expect(scoreFinding(base, events).confidence).toBe("low");
  });

  test("un-anchored finding stays untouched", () => {
    const u: Finding = { id: "F-02", severity: "Minor", title: "y", reproSteps: [] };
    expect(scoreFinding(u, [])).toEqual(u);
  });

  test("scoreFindings applies to each", () => {
    const fs = scoreFindings([base], [mkEvent(110, "inspect"), mkEvent(120, "snap")]);
    expect(fs[0]?.confidence).toBe("medium");
  });
});
