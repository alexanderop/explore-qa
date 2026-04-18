import { describe, expect, test } from "bun:test";
import type { CharterMeta } from "../scripts/lib/compose.ts";
import { resolveRunSettings } from "../scripts/run-charter.ts";

const baseCharter: CharterMeta = {
  name: "fixture",
  runRoot: "qa-runs",
  artifact: "report.md",
  defaultModel: { claude: "claude-opus-4-6" },
  includeFragments: [],
};

const call = (over: Partial<Parameters<typeof resolveRunSettings>[0]> = {}) =>
  resolveRunSettings({
    charter: "fixture",
    charterMeta: baseCharter,
    env: {},
    localConfig: {},
    ...over,
  });

describe("resolveRunSettings precedence ladder", () => {
  test("CLI arg wins over env, local config, charter, default", async () => {
    const s = await call({
      cliBrowser: "playwright-cli",
      env: { BROWSER: "agent-browser" },
      localConfig: { browser: "agent-browser" },
      charterMeta: { ...baseCharter, defaultBrowser: "agent-browser" },
    });
    expect(s.browser).toBe("playwright-cli");
  });

  test("env wins over local config, charter, default", async () => {
    const s = await call({
      env: { BROWSER: "playwright-cli" },
      localConfig: { browser: "agent-browser" },
      charterMeta: { ...baseCharter, defaultBrowser: "agent-browser" },
    });
    expect(s.browser).toBe("playwright-cli");
  });

  test("local config wins over charter and default", async () => {
    const s = await call({
      localConfig: { browser: "playwright-cli" },
      charterMeta: { ...baseCharter, defaultBrowser: "agent-browser" },
    });
    expect(s.browser).toBe("playwright-cli");
  });

  test("charter defaultBrowser wins over hardcoded fallback", async () => {
    const s = await call({
      charterMeta: { ...baseCharter, defaultBrowser: "playwright-cli" },
    });
    expect(s.browser).toBe("playwright-cli");
  });

  test("falls back to agent-browser when nothing is set", async () => {
    const s = await call();
    expect(s.browser).toBe("agent-browser");
  });

  test("agent precedence: CLI > env > local > default(claude)", async () => {
    expect((await call({ cliAgent: "codex", env: { AGENT: "copilot" } })).agent).toBe("codex");
    expect((await call({ env: { AGENT: "copilot" }, localConfig: { agent: "codex" } })).agent).toBe(
      "copilot",
    );
    expect((await call({ localConfig: { agent: "codex" } })).agent).toBe("codex");
    expect((await call()).agent).toBe("claude");
  });

  test("site precedence: CLI > env > local > default(example)", async () => {
    expect((await call({ cliSite: "acme", env: { SITE: "other" } })).site).toBe("acme");
    expect((await call({ env: { SITE: "other" }, localConfig: { site: "acme" } })).site).toBe(
      "other",
    );
    expect((await call({ localConfig: { site: "acme" } })).site).toBe("acme");
    expect((await call()).site).toBe("example");
  });

  test("MODEL env wins over local config", async () => {
    const s = await call({ env: { MODEL: "from-env" }, localConfig: { model: "from-local" } });
    expect(s.model).toBe("from-env");
  });

  test("timeout precedence: TIMEOUT_SEC env > local.timeoutSec > default 1800", async () => {
    expect(
      (
        await call({
          env: { TIMEOUT_SEC: "60" },
          localConfig: { timeoutSec: 120 },
        })
      ).timeoutSec,
    ).toBe(60);
    expect((await call({ localConfig: { timeoutSec: 120 } })).timeoutSec).toBe(120);
    expect((await call()).timeoutSec).toBe(1800);
  });

  test("throws on unknown agent with helpful message", async () => {
    expect(call({ cliAgent: "gemini" })).rejects.toThrow(/Unknown AGENT/);
  });

  test("throws on unknown browser with helpful message", async () => {
    expect(call({ cliBrowser: "chrome-devtools" })).rejects.toThrow(/Unknown BROWSER/);
  });
});
