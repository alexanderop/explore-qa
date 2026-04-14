import { writeFile } from "node:fs/promises";
import { type Browser, browserConfig } from "./browsers.ts";

export const AGENTS = ["claude", "codex", "copilot"] as const;
export type Agent = (typeof AGENTS)[number];

export function isAgent(value: string): value is Agent {
  return (AGENTS as readonly string[]).includes(value);
}

type InvocationContext = {
  prompt: string;
  systemPrompt: string;
  runDir: string;
  runId: string;
  logDir: string;
  model: string;
  browser: Browser;
};

export type Invocation = {
  cmd: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
};

export async function buildInvocation(agent: Agent, ctx: InvocationContext): Promise<Invocation> {
  const bc = browserConfig(ctx.browser, { runId: ctx.runId, runDir: ctx.runDir });

  switch (agent) {
    case "claude":
      return {
        cmd: "claude",
        args: [
          "-p",
          ctx.prompt,
          "--model",
          ctx.model,
          "--output-format",
          "stream-json",
          "--include-partial-messages",
          "--verbose",
          "--append-system-prompt",
          ctx.systemPrompt,
          "--add-dir",
          ctx.runDir,
          "--permission-mode",
          "bypassPermissions",
        ],
        env: bc.env,
      };

    case "codex":
      await writeFile(`${ctx.runDir}/AGENTS.md`, ctx.systemPrompt);
      return {
        cmd: "codex",
        args: [
          "exec",
          "--cd",
          ctx.runDir,
          "-m",
          ctx.model,
          // --full-auto blocks DNS and remaps $HOME, which breaks both network and
          // the browser CLI's socket path. Bypass sandbox so the browser tool can run normally.
          "--dangerously-bypass-approvals-and-sandbox",
          "--json",
          "-o",
          `${ctx.logDir}/codex-last-message.txt`,
          ctx.prompt,
        ],
        env: bc.env,
      };

    case "copilot":
      await writeFile(`${ctx.runDir}/AGENTS.md`, ctx.systemPrompt);
      return {
        cmd: "copilot",
        args: [
          "-p",
          ctx.prompt,
          "--model",
          ctx.model,
          "--allow-all-tools",
          "--add-dir",
          process.cwd(),
          "--output-format",
          "json",
        ],
        cwd: ctx.runDir,
        env: bc.env,
      };
  }
}
