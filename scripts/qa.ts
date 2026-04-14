#!/usr/bin/env bun
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { AGENTS, type Agent } from "./lib/agents.ts";
import { BROWSERS, type Browser } from "./lib/browsers.ts";
import { loadCharter } from "./lib/compose.ts";
import { loadLocalConfig } from "./lib/config.ts";
import { resolveRunSettings, runCharter } from "./run-charter.ts";

const REPO_ROOT = new URL("..", import.meta.url).pathname;
const CHARTER_DIR = join(REPO_ROOT, "charters");
const SITES_DIR = join(REPO_ROOT, "sites");

async function listMarkdown(dir: string): Promise<string[]> {
  try {
    const files = await readdir(dir);
    return files
      .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
      .map((f) => f.replace(/\.md$/, ""))
      .sort();
  } catch {
    return [];
  }
}

const listCharters = () => listMarkdown(CHARTER_DIR);
const listSites = () => listMarkdown(SITES_DIR);

async function printList(): Promise<void> {
  const [charters, sites] = await Promise.all([listCharters(), listSites()]);
  console.log("\nSites:");
  for (const s of sites) console.log(`  - ${s}`);
  if (sites.length === 0) console.log("  (none — run /onboard-site in a Claude Code session)");
  console.log("\nCharters:");
  for (const c of charters) console.log(`  - ${c}`);
  if (charters.length === 0) console.log("  (none — run /onboard-site or /new-charter)");
  console.log("\nAgents:");
  for (const a of AGENTS) console.log(`  - ${a}`);
  console.log("\nBrowsers:");
  for (const b of BROWSERS) console.log(`  - ${b}`);
  console.log();
}

async function pick<T extends string>(
  rl: ReturnType<typeof createInterface>,
  label: string,
  options: readonly T[],
  defaultValue: T,
): Promise<T> {
  console.log(`\n${label}`);
  options.forEach((opt, i) => {
    const marker = opt === defaultValue ? " (default)" : "";
    console.log(`  ${i + 1}) ${opt}${marker}`);
  });
  const answer = (await rl.question(`Choice [Enter = ${defaultValue}]: `)).trim();
  if (!answer) return defaultValue;
  const idx = Number(answer) - 1;
  if (Number.isFinite(idx) && idx >= 0 && idx < options.length) {
    const picked = options[idx];
    if (picked !== undefined) return picked;
  }
  if ((options as readonly string[]).includes(answer)) return answer as T;
  console.log(`Invalid — using ${defaultValue}`);
  return defaultValue;
}

async function wizard(): Promise<void> {
  const local = await loadLocalConfig();
  const [charters, sites] = await Promise.all([listCharters(), listSites()]);

  if (charters.length === 0) {
    console.error(
      "No charters found in charters/. Run /onboard-site or /new-charter in a Claude Code session first.",
    );
    process.exit(1);
  }

  const firstCharter = charters[0];
  if (!firstCharter) {
    console.error("No charters found in charters/.");
    process.exit(1);
  }
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const siteDefault = local.site ?? sites[0] ?? "example";
    const site =
      sites.length > 0 ? await pick(rl, "Pick a site:", sites, siteDefault) : siteDefault;

    const charter = await pick(rl, "Pick a charter:", charters, firstCharter);
    const { meta } = await loadCharter(charter);

    const agent: Agent = await pick(rl, "Pick an agent:", AGENTS, local.agent ?? "claude");
    const browserDefault: Browser = local.browser ?? meta.defaultBrowser ?? "agent-browser";
    const browser: Browser = await pick(rl, "Pick a browser:", BROWSERS, browserDefault);

    const charterModel = meta.defaultModel[agent] ?? "claude-opus-4-6";
    const modelDefault = local.model ?? charterModel;
    const modelAns = (await rl.question(`\nModel [Enter = ${modelDefault}]: `)).trim();
    const model = modelAns || modelDefault;

    const turnsDefault = local.maxTurns ?? meta.defaultMaxTurns;
    const turnsAns = (await rl.question(`Max turns [Enter = ${turnsDefault}]: `)).trim();
    const maxTurns = turnsAns ? Number(turnsAns) : turnsDefault;

    rl.close();

    console.log("\n--- Summary ---");
    console.log(`Site:      ${site}`);
    console.log(`Charter:   ${charter}`);
    console.log(`Agent:     ${agent}`);
    console.log(`Browser:   ${browser}`);
    console.log(`Model:     ${model}`);
    console.log(`Max turns: ${maxTurns}`);
    console.log(`\nDirect next time: bun scripts/qa.ts ${charter} ${agent} ${browser} ${site}`);
    console.log();

    const exitCode = await runCharter({
      charter,
      agent,
      browser,
      site,
      model,
      maxTurns,
    });
    if (exitCode !== 0) process.exit(exitCode);
  } finally {
    rl.close();
  }
}

const args = process.argv.slice(2);

if (args.includes("--list") || args.includes("-l")) {
  await printList();
  process.exit(0);
}

if (args.length === 0) {
  await wizard();
} else {
  // Non-interactive: charter agent browser site
  const charter = args[0];
  if (!charter) {
    console.error("Charter name missing.");
    process.exit(1);
  }
  const { meta } = await loadCharter(charter);
  const settings = await resolveRunSettings({
    charter,
    cliAgent: args[1],
    cliBrowser: args[2],
    cliSite: args[3],
    charterMeta: meta,
  });
  const exitCode = await runCharter(settings);
  if (exitCode !== 0) process.exit(exitCode);
}
