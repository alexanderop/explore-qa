import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type Agent, isAgent } from "./agents.ts";
import { type Browser, isBrowser } from "./browsers.ts";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const LOCAL_CONFIG_PATH = join(REPO_ROOT, "qa.local.json");

export type LocalConfig = {
  site?: string;
  agent?: Agent;
  browser?: Browser;
  model?: string;
};

export async function loadLocalConfig(): Promise<LocalConfig> {
  try {
    const raw = await readFile(LOCAL_CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: LocalConfig = {};
    if (typeof parsed.site === "string") out.site = parsed.site;
    if (typeof parsed.agent === "string" && isAgent(parsed.agent)) out.agent = parsed.agent;
    if (typeof parsed.browser === "string" && isBrowser(parsed.browser))
      out.browser = parsed.browser;
    if (typeof parsed.model === "string") out.model = parsed.model;
    return out;
  } catch {
    return {};
  }
}
