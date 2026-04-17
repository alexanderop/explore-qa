import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative } from "node:path";

export type RunFrontmatter = {
  charter: string;
  agent: string;
  browser: string;
  model: string;
  date: string;
  time: string;
  duration_s: number;
  duration_hms: string;
  status: "pass" | "findings" | "error";
  findings: number;
  promptHash: string;
};

const FM_OPEN = "---\n";
const FM_CLOSE = "\n---\n";

function serializeFrontmatter(fm: RunFrontmatter): string {
  const lines = [
    `charter: ${fm.charter}`,
    `agent: ${fm.agent}`,
    `browser: ${fm.browser}`,
    `model: ${fm.model}`,
    `date: ${fm.date}`,
    `time: "${fm.time}"`,
    `duration_s: ${fm.duration_s}`,
    `duration_hms: "${fm.duration_hms}"`,
    `status: ${fm.status}`,
    `findings: ${fm.findings}`,
    `promptHash: ${fm.promptHash}`,
  ];
  return `${FM_OPEN}${lines.join("\n")}${FM_CLOSE}\n`;
}

export function applyFrontmatter(existing: string, fm: RunFrontmatter): string {
  const block = serializeFrontmatter(fm);
  if (existing.startsWith(FM_OPEN)) {
    const end = existing.indexOf(FM_CLOSE, FM_OPEN.length);
    if (end !== -1) {
      const rest = existing.slice(end + FM_CLOSE.length).replace(/^\n+/, "");
      return `${block}${rest}`;
    }
  }
  return `${block}${existing.replace(/^\n+/, "")}`;
}

export async function prependFrontmatter(reportPath: string, fm: RunFrontmatter): Promise<void> {
  let existing = "";
  try {
    existing = await readFile(reportPath, "utf8");
  } catch {
    existing = "";
  }
  await writeFile(reportPath, applyFrontmatter(existing, fm));
}

export function parseFindingsCount(reportBody: string): number {
  const lines = reportBody.split("\n");
  const idx = lines.findIndex((l) => /^##\s+Findings\b/i.test(l.trim()));
  if (idx === -1) return 0;
  let count = 0;
  let sawHeader = false;
  let sawSeparator = false;
  for (let i = idx + 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (/^##\s/.test(line)) break;
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    if (!sawHeader) {
      sawHeader = true;
      continue;
    }
    if (!sawSeparator) {
      if (/^\|[\s:|-]+\|$/.test(trimmed)) {
        sawSeparator = true;
        continue;
      }
      // Header without separator — treat first row as data anyway
      sawSeparator = true;
    }
    count++;
  }
  return count;
}

const INDEX_HEADER = [
  "# QA Runs",
  "",
  "Übersicht aller Runs. Vom Runner gepflegt — neueste Zeile zuerst.",
  "",
  "| Datum | Zeit | Charter | Agent | Browser | Dauer | Status | Findings | Prompt | Report |",
  "|---|---|---|---|---|---|---|---|---|---|",
  "",
].join("\n");

export function buildIndexRow(fm: RunFrontmatter, indexPath: string, reportPath: string): string {
  const rel = relative(dirname(indexPath), reportPath);
  const shortTime = fm.time.slice(0, 5);
  const shortHash = fm.promptHash.slice(0, 6);
  return `| ${fm.date} | ${shortTime} | ${fm.charter} | ${fm.agent} | ${fm.browser} | ${fm.duration_hms} | ${fm.status} | ${fm.findings} | ${shortHash} | [↗](${rel}) |`;
}

export function insertIndexRow(existing: string, row: string): string {
  if (!existing.includes("|---|")) {
    return `${INDEX_HEADER}${row}\n`;
  }
  const lines = existing.split("\n");
  const sepIdx = lines.findIndex((l) => /^\|[\s:|-]+\|$/.test(l.trim()));
  if (sepIdx === -1) return `${INDEX_HEADER}${row}\n`;
  lines.splice(sepIdx + 1, 0, row);
  return lines.join("\n");
}

export async function appendToIndex(
  indexPath: string,
  fm: RunFrontmatter,
  reportPath: string,
): Promise<void> {
  let existing = "";
  try {
    existing = await readFile(indexPath, "utf8");
  } catch {
    existing = "";
  }
  await mkdir(dirname(indexPath), { recursive: true });
  const row = buildIndexRow(fm, indexPath, reportPath);
  await writeFile(indexPath, insertIndexRow(existing, row));
}
