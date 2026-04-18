#!/usr/bin/env bun
import { readFile } from "node:fs/promises";
import { AGENTS, type Agent, isAgent } from "./lib/agents.ts";
import { BROWSERS, type Browser, isBrowser } from "./lib/browsers.ts";
import { loadCharter } from "./lib/compose.ts";
import type { RunFrontmatter } from "./lib/index-md.ts";
import { QA_RUNS_ROOT, resolveRunPaths } from "./lib/paths.ts";
import { generateReplay } from "./lib/replay/generate.ts";

function parseReportFrontmatter(raw: string): Record<string, string> {
  if (!raw.startsWith("---\n")) return {};
  const end = raw.indexOf("\n---\n", 4);
  if (end === -1) return {};
  const yaml = raw.slice(4, end);
  const out: Record<string, string> = {};
  for (const line of yaml.split("\n")) {
    const m = /^(\w+):\s*(.*)$/.exec(line);
    if (!m) continue;
    const k = m[1] ?? "";
    const v = (m[2] ?? "").trim().replace(/^"(.*)"$/, "$1");
    out[k] = v;
  }
  return out;
}

type Target = {
  charter: string;
  runId: string;
  agent: Agent;
  browser: Browser;
};

function parseTarget(arg: string): Target {
  // Accept either "<charter>/<runId>" or separate env vars.
  const slash = arg.indexOf("/");
  if (slash === -1) {
    throw new Error(`Expected <charter>/<runId>, got: ${arg}`);
  }
  const charter = arg.slice(0, slash);
  const runId = arg.slice(slash + 1);
  // runId format: YYYY-MM-DD_HH-MM-SS_<agent>_<browser>
  const m = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_([a-z]+)_(.+)$/.exec(runId);
  if (!m) {
    throw new Error(`Could not parse agent/browser from runId: ${runId}`);
  }
  const agent = m[1] ?? "";
  const browser = m[2] ?? "";
  if (!isAgent(agent)) {
    throw new Error(`Unknown agent '${agent}' (use: ${AGENTS.join(" | ")})`);
  }
  if (!isBrowser(browser)) {
    throw new Error(`Unknown browser '${browser}' (use: ${BROWSERS.join(" | ")})`);
  }
  return { charter, runId, agent, browser };
}

export async function generateReplayForRun(target: Target, siteOverride?: string): Promise<string> {
  const paths = resolveRunPaths({
    charter: target.charter,
    agent: target.agent,
    browser: target.browser,
    runId: target.runId,
  });

  const reportRaw = await readFile(paths.reportPath, "utf8").catch(() => "");
  const fmRaw = parseReportFrontmatter(reportRaw);

  const { body: charterBody } = await loadCharter(target.charter);

  const status =
    fmRaw.status === "pass" || fmRaw.status === "findings" || fmRaw.status === "error"
      ? fmRaw.status
      : "error";

  const fm: RunFrontmatter = {
    charter: fmRaw.charter ?? target.charter,
    agent: fmRaw.agent ?? target.agent,
    browser: fmRaw.browser ?? target.browser,
    model: fmRaw.model ?? "",
    date: fmRaw.date ?? "",
    time: fmRaw.time ?? "",
    duration_s: Number(fmRaw.duration_s ?? 0) || 0,
    duration_hms: fmRaw.duration_hms ?? "",
    status,
    findings: Number(fmRaw.findings ?? 0) || 0,
    promptHash: fmRaw.promptHash ?? "",
  };

  return await generateReplay({
    runDir: paths.runDir,
    logDir: paths.logDir,
    screenshotDir: paths.screenshotDir,
    reportPath: paths.reportPath,
    charter: target.charter,
    charterBody,
    runId: target.runId,
    agent: target.agent,
    browser: target.browser,
    site: siteOverride ?? "unknown",
    frontmatter: fm,
  });
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith("--"));
  const arg = positional[0];
  if (!arg) {
    console.error(
      `Usage: bun scripts/generate-replay.ts <charter>/<runId>\n` +
        `Example: bun scripts/generate-replay.ts otto-search/2026-04-18_12-00-00_claude_agent-browser\n` +
        `Run artifacts must already exist under ./${QA_RUNS_ROOT}/charters/<charter>/_attachments/<runId>/`,
    );
    process.exit(1);
  }
  try {
    const target = parseTarget(arg);
    const out = await generateReplayForRun(target);
    console.log(`wrote ${out}`);
  } catch (err) {
    console.error(`error: ${(err as Error).message}`);
    process.exit(1);
  }
}
