#!/usr/bin/env bun
import { mkdir, readFile } from "node:fs/promises";
import { AGENTS, type Agent, buildInvocation, isAgent } from "./lib/agents.ts";
import { BROWSERS, type Browser, isBrowser } from "./lib/browsers.ts";
import { type CharterMeta, composePrompt, loadCharter } from "./lib/compose.ts";
import { type LocalConfig, loadLocalConfig } from "./lib/config.ts";
import {
  appendToIndex,
  parseFindingsCount,
  prependFrontmatter,
  type RunFrontmatter,
} from "./lib/index-md.ts";
import { fmtHMS, humanStamp, pad, QA_RUNS_ROOT, resolveRunPaths } from "./lib/paths.ts";
import { runWithTee } from "./lib/run.ts";

export type RunSettings = {
  charter: string;
  agent: Agent;
  browser: Browser;
  site: string;
  model?: string;
  maxTurns?: number;
  runId?: string;
  runDir?: string;
};

export async function resolveRunSettings(opts: {
  charter: string;
  cliAgent?: string;
  cliBrowser?: string;
  cliSite?: string;
  charterMeta: CharterMeta;
  env?: Record<string, string | undefined>;
  localConfig?: LocalConfig;
}): Promise<RunSettings> {
  const env = opts.env ?? process.env;
  const local = opts.localConfig ?? (await loadLocalConfig());

  const agentRaw = opts.cliAgent ?? env.AGENT ?? local.agent ?? "claude";
  if (!isAgent(agentRaw)) {
    throw new Error(`Unknown AGENT '${agentRaw}' (use: ${AGENTS.join(" | ")})`);
  }

  const browserRaw =
    opts.cliBrowser ??
    env.BROWSER ??
    local.browser ??
    opts.charterMeta.defaultBrowser ??
    "agent-browser";
  if (!isBrowser(browserRaw)) {
    throw new Error(`Unknown BROWSER '${browserRaw}' (use: ${BROWSERS.join(" | ")})`);
  }

  const site = opts.cliSite ?? env.SITE ?? local.site ?? "example";

  return {
    charter: opts.charter,
    agent: agentRaw,
    browser: browserRaw,
    site,
    model: env.MODEL ?? local.model,
    maxTurns: env.MAX_TURNS ? Number(env.MAX_TURNS) : local.maxTurns,
    runId: env.RUN_ID,
    runDir: env.RUN_DIR,
  };
}

export async function runCharter(settings: RunSettings): Promise<number> {
  const paths = resolveRunPaths({
    charter: settings.charter,
    agent: settings.agent,
    browser: settings.browser,
    runId: settings.runId,
    runDir: settings.runDir,
  });

  await mkdir(paths.screenshotDir, { recursive: true });
  await mkdir(paths.logDir, { recursive: true });

  const composed = await composePrompt(settings.charter, {
    agent: settings.agent,
    browser: settings.browser,
    site: settings.site,
    runId: paths.runId,
    runDir: paths.runDir,
    screenshotDir: paths.screenshotDir,
    logDir: paths.logDir,
    reportPath: paths.reportPath,
  });

  const model = settings.model ?? composed.meta.defaultModel[settings.agent] ?? "claude-opus-4-6";
  const maxTurns = settings.maxTurns ?? composed.meta.defaultMaxTurns;

  const sessionLog = `${paths.logDir}/${settings.agent}-session.jsonl`;

  const startMs = Date.now();
  console.log(
    `Site: ${settings.site} | Charter: ${settings.charter} | Agent: ${settings.agent} | Browser: ${settings.browser} | Model: ${model}`,
  );
  console.log(`Run: ${paths.runDir}`);
  console.log(`Start: ${humanStamp(new Date(startMs))}`);

  const inv = await buildInvocation(settings.agent, {
    prompt: composed.prompt,
    systemPrompt: composed.systemPrompt,
    runDir: paths.runDir,
    runId: paths.runId,
    logDir: paths.logDir,
    model,
    maxTurns,
    browser: settings.browser,
  });

  const exitCode = await runWithTee(inv, sessionLog);
  const endMs = Date.now();
  const durationSec = Math.floor((endMs - startMs) / 1000);

  let findings = 0;
  try {
    const body = await readFile(paths.reportPath, "utf8");
    findings = parseFindingsCount(body);
  } catch {
    findings = 0;
  }

  const startDate = new Date(startMs);
  const fm: RunFrontmatter = {
    charter: settings.charter,
    agent: settings.agent,
    browser: settings.browser,
    model,
    date: `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`,
    time: `${pad(startDate.getHours())}:${pad(startDate.getMinutes())}:${pad(startDate.getSeconds())}`,
    duration_s: durationSec,
    duration_hms: fmtHMS(durationSec),
    status: exitCode !== 0 ? "error" : findings > 0 ? "findings" : "pass",
    findings,
  };

  try {
    await prependFrontmatter(paths.reportPath, fm);
    await appendToIndex(`./${QA_RUNS_ROOT}/README.md`, fm, paths.reportPath);
  } catch (err) {
    console.error(`Warning: could not write frontmatter/index: ${(err as Error).message}`);
  }

  console.log(`Report: ${paths.reportPath}`);
  console.log(`Session log: ${sessionLog}`);
  console.log(`Duration: ${fmtHMS(Math.floor((endMs - startMs) / 1000))}`);

  return exitCode;
}

if (import.meta.main) {
  const charterArg = process.argv[2] ?? process.env.CHARTER;
  if (!charterArg) {
    console.error("Usage: bun scripts/run-charter.ts <charter-name> [agent] [browser] [site]");
    console.error(`Agents:   ${AGENTS.join(" | ")}`);
    console.error(`Browsers: ${BROWSERS.join(" | ")}`);
    process.exit(1);
  }

  const { meta: charterMeta } = await loadCharter(charterArg);
  const settings = await resolveRunSettings({
    charter: charterArg,
    cliAgent: process.argv[3],
    cliBrowser: process.argv[4],
    cliSite: process.argv[5],
    charterMeta,
  });

  const exitCode = await runCharter(settings);
  if (exitCode !== 0) process.exit(exitCode);
}
