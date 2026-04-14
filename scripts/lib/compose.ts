import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Agent } from "./agents.ts";
import { type Browser, isBrowser } from "./browsers.ts";

export type CharterMeta = {
  name: string;
  runRoot: string;
  artifact: string;
  defaultModel: Partial<Record<Agent, string>>;
  defaultBrowser?: Browser;
  includeFragments: string[];
};

type ComposeContext = {
  agent: Agent;
  browser: Browser;
  site: string;
  runId: string;
  runDir: string;
  screenshotDir: string;
  logDir: string;
  reportPath: string;
};

type ComposedPrompt = {
  meta: CharterMeta;
  prompt: string;
  systemPrompt: string;
};

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const CHARTER_DIR = join(REPO_ROOT, "charters");
const PROMPTS_DIR = join(REPO_ROOT, "prompts");
const SITES_DIR = join(REPO_ROOT, "sites");
const BRAIN_CORE_INDEX = join(REPO_ROOT, "brain/_core/index.md");

const ABSOLUTE_PATH_KEYS = new Set<keyof ComposeContext>([
  "runDir",
  "screenshotDir",
  "logDir",
  "reportPath",
]);

function substitute(template: string, ctx: ComposeContext): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    if (key in ctx) {
      const value = String(ctx[key as keyof ComposeContext]);
      if (ABSOLUTE_PATH_KEYS.has(key as keyof ComposeContext)) {
        return resolve(REPO_ROOT, value);
      }
      return value;
    }
    return `{{${key}}}`;
  });
}

export function parseFrontmatter(raw: string): { meta: CharterMeta; body: string } {
  if (!raw.startsWith("---\n")) {
    throw new Error("Charter must start with YAML frontmatter (---)");
  }
  const end = raw.indexOf("\n---\n", 4);
  if (end === -1) throw new Error("Frontmatter not closed");
  const yaml = raw.slice(4, end);
  const body = raw.slice(end + 5);

  const lines = yaml.split("\n");
  const out: Record<string, unknown> = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (!line.trim() || line.trim().startsWith("#")) {
      i++;
      continue;
    }
    const m = /^(\w+):\s*(.*)$/.exec(line);
    if (!m) {
      i++;
      continue;
    }
    const key = m[1] ?? "";
    const rest = m[2] ?? "";
    if (rest.length > 0) {
      out[key] = coerce(rest);
      i++;
      continue;
    }
    const child: Record<string, string> = {};
    const list: string[] = [];
    i++;
    while (i < lines.length) {
      const next = lines[i] ?? "";
      if (!/^\s/.test(next) || !next.trim()) break;
      const item = /^\s+-\s+(.*)$/.exec(next);
      const kv = /^\s+(\w+):\s*(.*)$/.exec(next);
      if (item) {
        list.push((item[1] ?? "").trim());
      } else if (kv) {
        const k = kv[1] ?? "";
        child[k] = (kv[2] ?? "").trim();
      }
      i++;
    }
    out[key] = list.length > 0 ? list : child;
  }

  const rawDefaultBrowser = typeof out.defaultBrowser === "string" ? out.defaultBrowser : undefined;
  const meta: CharterMeta = {
    name: String(out.name ?? ""),
    runRoot: String(out.runRoot ?? "qa-runs"),
    artifact: String(out.artifact ?? "report.md"),
    defaultModel: (out.defaultModel as Partial<Record<Agent, string>>) ?? {},
    defaultBrowser:
      rawDefaultBrowser && isBrowser(rawDefaultBrowser) ? rawDefaultBrowser : undefined,
    includeFragments: Array.isArray(out.includeFragments) ? (out.includeFragments as string[]) : [],
  };
  return { meta, body };
}

function coerce(value: string): string | number {
  const n = Number(value);
  return Number.isFinite(n) && value.trim() !== "" ? n : value;
}

async function readFragment(name: string): Promise<string> {
  const path = join(PROMPTS_DIR, `${name}.md`);
  return await readFile(path, "utf8");
}

async function readOptional(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

async function readSiteProfile(site: string): Promise<string> {
  const body = await readOptional(join(SITES_DIR, `${site}.md`));
  if (!body.trim()) return "";
  return ["## Site Profile", "", body.trim()].join("\n");
}

async function readBrainCore(): Promise<string> {
  const body = await readOptional(BRAIN_CORE_INDEX);
  if (!body.trim()) return "";
  return ["## Brain (core principles)", "", body.trim()].join("\n");
}

export async function loadCharter(name: string): Promise<{ meta: CharterMeta; body: string }> {
  const path = join(CHARTER_DIR, `${name}.md`);
  const raw = await readFile(path, "utf8");
  return parseFrontmatter(raw);
}

export async function composePrompt(
  charterName: string,
  ctx: ComposeContext,
): Promise<ComposedPrompt> {
  const { meta, body } = await loadCharter(charterName);

  const charterBody = substitute(body, ctx);

  const fragmentParts: string[] = [];
  for (const fragment of meta.includeFragments) {
    const text = substitute(await readFragment(fragment), ctx);
    fragmentParts.push(text);
  }

  const prompt = [charterBody.trim(), ...fragmentParts.map((p) => p.trim())]
    .filter(Boolean)
    .join("\n\n");

  const systemBase = substitute(await readFragment("_system"), ctx);
  const honesty = substitute(await readFragment("_honesty-checks"), ctx);
  const siteProfile = substitute(await readSiteProfile(ctx.site), ctx);
  const brainCore = substitute(await readBrainCore(), ctx);

  const systemPrompt = [systemBase.trim(), honesty.trim(), siteProfile.trim(), brainCore.trim()]
    .filter(Boolean)
    .join("\n\n");

  return { meta, prompt, systemPrompt };
}
