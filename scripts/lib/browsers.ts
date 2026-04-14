export const BROWSERS = ["agent-browser", "playwright-cli"] as const;
export type Browser = (typeof BROWSERS)[number];

export function isBrowser(value: string): value is Browser {
  return (BROWSERS as readonly string[]).includes(value);
}

type BrowserConfig = {
  tool: string;
  allowToolPattern: string;
  env: Record<string, string>;
};

export function browserConfig(
  browser: Browser,
  ctx: { runId: string; runDir: string },
): BrowserConfig {
  switch (browser) {
    case "agent-browser":
      return {
        tool: "agent-browser",
        allowToolPattern: "Bash(agent-browser:*)",
        env: {},
      };

    case "playwright-cli":
      return {
        tool: "playwright-cli",
        allowToolPattern: "Bash(playwright-cli:*)",
        env: {
          PLAYWRIGHT_CLI_DEVICE: "iPhone 15 Pro",
          PLAYWRIGHT_CLI_OUTPUT_DIR: `${ctx.runDir}/.playwright-cli`,
        },
      };
  }
}
