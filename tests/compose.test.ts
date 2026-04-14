import { describe, expect, test } from "bun:test";
import type { Agent } from "../scripts/lib/agents.ts";
import type { Browser } from "../scripts/lib/browsers.ts";
import { composePrompt } from "../scripts/lib/compose.ts";

const ctx = (browser: Browser, agent: Agent = "claude", site = "example") => ({
  agent,
  browser,
  site,
  runId: "TEST-RID",
  runDir: "/tmp/test-run",
  screenshotDir: "/tmp/test-run/screenshots",
  logDir: "/tmp/test-run/logs",
  reportPath: "/tmp/test-run/report.md",
});

describe("composePrompt", () => {
  test("playwright-cli backend → no agent-browser leaks anywhere", async () => {
    const c = await composePrompt("example-smoke", ctx("playwright-cli"));
    const haystack = `${c.prompt}\n${c.systemPrompt}`;
    expect(haystack).not.toContain("agent-browser");
    expect(haystack).toContain("playwright-cli");
  });

  test("agent-browser backend → no playwright-cli leaks anywhere", async () => {
    const c = await composePrompt("example-smoke", ctx("agent-browser"));
    const haystack = `${c.prompt}\n${c.systemPrompt}`;
    expect(haystack).not.toContain("playwright-cli");
    expect(haystack).toContain("agent-browser");
  });

  test("all {{…}} placeholders are substituted in the charter body", async () => {
    const c = await composePrompt("example-smoke", ctx("agent-browser"));
    expect(c.prompt).not.toContain("{{");
    expect(c.prompt).toContain("/tmp/test-run");
  });

  test("{{site}} substitution resolves to the active site", async () => {
    const c = await composePrompt("example-smoke", ctx("agent-browser", "claude", "acme"));
    expect(c.prompt).toContain("acme");
  });

  test("system prompt always includes honesty checks", async () => {
    const c = await composePrompt("example-smoke", ctx("agent-browser"));
    expect(c.systemPrompt).toContain("Absence burden of proof");
  });

  test("system prompt inlines brain/_core/index.md", async () => {
    const c = await composePrompt("example-smoke", ctx("agent-browser"));
    expect(c.systemPrompt).toContain("Brain (core principles)");
    expect(c.systemPrompt).toContain("principles/exploratory-not-checklist");
  });

  test("system prompt inlines the active site profile when present", async () => {
    const c = await composePrompt("example-smoke", ctx("agent-browser"));
    expect(c.systemPrompt).toContain("Site Profile");
    expect(c.systemPrompt).toContain("example.com");
  });

  test("unknown site → compose still succeeds, no site block inlined", async () => {
    const c = await composePrompt(
      "example-smoke",
      ctx("agent-browser", "claude", "definitely-not-a-real-site"),
    );
    expect(c.systemPrompt).not.toContain("Site Profile");
    // but substitution still works
    expect(c.prompt).toContain("definitely-not-a-real-site");
  });
});
