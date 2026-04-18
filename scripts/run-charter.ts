#!/usr/bin/env bun
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
import { generateReplay } from "./lib/replay/generate.ts";
import { runWithTee } from "./lib/run.ts";

export type RunSettings = {
  charter: string;
  agent: Agent;
  browser: Browser;
  site: string;
  model?: string;
  runId?: string;
  runDir?: string;
  dryRun?: boolean;
  timeoutSec: number;
  noReplay?: boolean;
};

const DEFAULT_TIMEOUT_SEC = 1800;

export async function resolveRunSettings(opts: {
  charter: string;
  cliAgent?: string;
  cliBrowser?: string;
  cliSite?: string;
  charterMeta: CharterMeta;
  env?: Record<string, string | undefined>;
  localConfig?: LocalConfig;
  dryRun?: boolean;
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

  const envTimeout = env.TIMEOUT_SEC ? Number(env.TIMEOUT_SEC) : undefined;
  const timeoutSec =
    envTimeout !== undefined && Number.isFinite(envTimeout)
      ? envTimeout
      : (local.timeoutSec ?? DEFAULT_TIMEOUT_SEC);

  return {
    charter: opts.charter,
    agent: agentRaw,
    browser: browserRaw,
    site,
    model: env.MODEL ?? local.model,
    runId: env.RUN_ID,
    runDir: env.RUN_DIR,
    dryRun: opts.dryRun,
    timeoutSec,
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

  await writeFile(
    `${paths.logDir}/prompt-manifest.json`,
    JSON.stringify({ promptHash: composed.promptHash, fragments: composed.manifest }, null, 2),
  );

  const sessionLog = `${paths.logDir}/${settings.agent}-session.jsonl`;

  const startMs = Date.now();
  console.log(
    `Site: ${settings.site} | Charter: ${settings.charter} | Agent: ${settings.agent} | Browser: ${settings.browser} | Model: ${model}`,
  );
  console.log(`Run: ${paths.runDir}`);
  console.log(`Start: ${humanStamp(new Date(startMs))} | Timeout: ${settings.timeoutSec}s`);

  const inv = await buildInvocation(settings.agent, {
    prompt: composed.prompt,
    systemPrompt: composed.systemPrompt,
    runDir: paths.runDir,
    runId: paths.runId,
    logDir: paths.logDir,
    model,
    browser: settings.browser,
  });

  if (settings.dryRun) {
    console.log(`\n--- PROMPT HASH: ${composed.promptHash} ---\n`);
    console.log("--- MANIFEST ---\n");
    for (const f of composed.manifest) console.log(`  ${f.hash}  ${f.name}`);
    console.log("\n--- SYSTEM PROMPT ---\n");
    console.log(composed.systemPrompt);
    console.log("\n--- PROMPT ---\n");
    console.log(composed.prompt);
    console.log("\n--- INVOCATION ---\n");
    console.log(JSON.stringify({ cmd: inv.cmd, args: inv.args, cwd: inv.cwd }, null, 2));
    return 0;
  }

  const exitCode = await runWithTee(inv, sessionLog, settings.timeoutSec * 1000);
  const endMs = Date.now();
  const durationSec = Math.floor((endMs - startMs) / 1000);

  let findings = 0;
  let reportMissing = false;
  try {
    const body = await readFile(paths.reportPath, "utf8");
    if (body.trim().length === 0) {
      reportMissing = true;
    } else {
      findings = parseFindingsCount(body);
    }
  } catch {
    reportMissing = true;
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
    status: exitCode !== 0 || reportMissing ? "error" : findings > 0 ? "findings" : "pass",
    findings,
    promptHash: composed.promptHash,
  };

  try {
    await prependFrontmatter(paths.reportPath, fm);
    await appendToIndex(`./${QA_RUNS_ROOT}/README.md`, fm, paths.reportPath);
  } catch (err) {
    console.error(`Warning: could not write frontmatter/index: ${(err as Error).message}`);
  }

  if (!settings.noReplay) {
    try {
      const { body: charterBody } = await loadCharter(settings.charter);
      const replayPath = await generateReplay({
        runDir: paths.runDir,
        logDir: paths.logDir,
        screenshotDir: paths.screenshotDir,
        reportPath: paths.reportPath,
        charter: settings.charter,
        charterBody,
        runId: paths.runId,
        agent: settings.agent,
        browser: settings.browser,
        site: settings.site,
        frontmatter: fm,
      });
      console.log(`Replay: ${replayPath}`);
    } catch (err) {
      console.error(`Warning: could not generate replay.html: ${(err as Error).message}`);
    }
  }

  console.log(`Report: ${paths.reportPath}`);
  console.log(`Session log: ${sessionLog}`);
  console.log(`Duration: ${fmtHMS(Math.floor((endMs - startMs) / 1000))}`);

  return exitCode;
}

if (import.meta.main) {
  const rawArgs = process.argv.slice(2);
  const dryRun = rawArgs.includes("--dry-run");
  const noReplay = rawArgs.includes("--no-replay");
  const positional = rawArgs.filter((a) => !a.startsWith("--"));

  const charterArg = positional[0] ?? process.env.CHARTER;
  if (!charterArg) {
    console.error(
      "Usage: bun scripts/run-charter.ts <charter-name> [agent] [browser] [site] [--dry-run] [--no-replay]",
    );
    console.error(`Agents:   ${AGENTS.join(" | ")}`);
    console.error(`Browsers: ${BROWSERS.join(" | ")}`);
    process.exit(1);
  }

  const { meta: charterMeta } = await loadCharter(charterArg);
  const settings = await resolveRunSettings({
    charter: charterArg,
    cliAgent: positional[1],
    cliBrowser: positional[2],
    cliSite: positional[3],
    charterMeta,
    dryRun,
  });
  settings.noReplay = noReplay;

  const exitCode = await runCharter(settings);
  if (exitCode !== 0) process.exit(exitCode);
}
