import { describe, expect, test } from "bun:test";
import { buildRunId, resolveRunPaths } from "../scripts/lib/paths.ts";

describe("resolveRunPaths", () => {
  test("report lives directly under charter dir, not in a subfolder", () => {
    const p = resolveRunPaths({
      charter: "search-mobile-smoke",
      agent: "claude",
      browser: "agent-browser",
      runId: "2026-04-14_11-01-47_claude_agent-browser",
    });
    expect(p.reportPath).toBe(
      "./qa-runs/charters/search-mobile-smoke/2026-04-14_11-01-47_claude_agent-browser.md",
    );
  });

  test("attachments live under _attachments/<runId>", () => {
    const p = resolveRunPaths({
      charter: "search-mobile-smoke",
      agent: "claude",
      browser: "agent-browser",
      runId: "RID",
    });
    expect(p.runDir).toBe("./qa-runs/charters/search-mobile-smoke/_attachments/RID");
    expect(p.screenshotDir).toBe(
      "./qa-runs/charters/search-mobile-smoke/_attachments/RID/screenshots",
    );
    expect(p.logDir).toBe("./qa-runs/charters/search-mobile-smoke/_attachments/RID/logs");
  });

  test("buildRunId encodes date, agent, browser", () => {
    const id = buildRunId({
      agent: "codex",
      browser: "playwright-cli",
      date: new Date(2026, 3, 14, 11, 1, 47),
    });
    expect(id).toBe("2026-04-14_11-01-47_codex_playwright-cli");
  });

  test("explicit runDir override is respected", () => {
    const p = resolveRunPaths({
      charter: "x",
      agent: "claude",
      browser: "agent-browser",
      runId: "RID",
      runDir: "/custom/path",
    });
    expect(p.runDir).toBe("/custom/path");
    expect(p.screenshotDir).toBe("/custom/path/screenshots");
    expect(p.reportPath).toBe("./qa-runs/charters/x/RID.md");
  });
});
