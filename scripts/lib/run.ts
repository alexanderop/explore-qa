import type { Invocation } from "./agents.ts";

export async function runWithTee(inv: Invocation, logPath: string): Promise<number> {
  const proc = Bun.spawn({
    cmd: [inv.cmd, ...inv.args],
    cwd: inv.cwd,
    env: inv.env ? { ...process.env, ...inv.env } : process.env,
    stdout: "pipe",
    stderr: "inherit",
  });

  const writer = Bun.file(logPath).writer();
  for await (const chunk of proc.stdout) {
    writer.write(chunk);
    process.stdout.write(chunk);
  }
  await writer.end();
  return await proc.exited;
}
