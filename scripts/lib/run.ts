import type { Invocation } from "./agents.ts";

export async function runWithTee(
  inv: Invocation,
  logPath: string,
  timeoutMs?: number,
): Promise<number> {
  const proc = Bun.spawn({
    cmd: [inv.cmd, ...inv.args],
    cwd: inv.cwd,
    env: inv.env ? { ...process.env, ...inv.env } : process.env,
    stdout: "pipe",
    stderr: "inherit",
  });

  let timedOut = false;
  let killTimer: ReturnType<typeof setTimeout> | null = null;
  const timer =
    timeoutMs && timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          console.error(`\nTimeout after ${Math.round(timeoutMs / 1000)}s — killing agent.`);
          proc.kill("SIGTERM");
          killTimer = setTimeout(() => proc.kill("SIGKILL"), 5000);
        }, timeoutMs)
      : null;

  const writer = Bun.file(logPath).writer();
  for await (const chunk of proc.stdout) {
    writer.write(chunk);
    process.stdout.write(chunk);
  }
  await writer.end();
  const exitCode = await proc.exited;
  if (timer) clearTimeout(timer);
  if (killTimer) clearTimeout(killTimer);
  return timedOut ? 124 : exitCode;
}
