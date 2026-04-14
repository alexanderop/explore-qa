export const pad = (n: number) => n.toString().padStart(2, "0");

const tsStamp = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;

export const humanStamp = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

export const fmtHMS = (seconds: number) =>
  `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;

type RunPaths = {
  runId: string;
  charterDir: string;
  runDir: string;
  screenshotDir: string;
  logDir: string;
  reportPath: string;
};

export const QA_RUNS_ROOT = "qa-runs";

export function buildRunId(opts: { agent: string; browser: string; date?: Date }): string {
  return `${tsStamp(opts.date ?? new Date())}_${opts.agent}_${opts.browser}`;
}

export function resolveRunPaths(opts: {
  charter: string;
  agent: string;
  browser: string;
  runId?: string;
  runDir?: string;
}): RunPaths {
  const runId = opts.runId ?? buildRunId({ agent: opts.agent, browser: opts.browser });
  const charterDir = `./${QA_RUNS_ROOT}/charters/${opts.charter}`;
  const runDir = opts.runDir ?? `${charterDir}/_attachments/${runId}`;
  return {
    runId,
    charterDir,
    runDir,
    screenshotDir: `${runDir}/screenshots`,
    logDir: `${runDir}/logs`,
    reportPath: `${charterDir}/${runId}.md`,
  };
}
