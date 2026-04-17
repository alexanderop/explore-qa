#!/usr/bin/env bun
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { FragmentEntry } from "./lib/compose.ts";

type ReportMeta = {
  charter: string;
  agent: string;
  browser: string;
  model: string;
  date: string;
  time: string;
  duration_s: number;
  status: string;
  findings: number;
  promptHash: string;
};

type Manifest = {
  promptHash: string;
  fragments: FragmentEntry[];
};

function parseReportFrontmatter(raw: string): ReportMeta {
  if (!raw.startsWith("---\n")) throw new Error("Report has no frontmatter");
  const end = raw.indexOf("\n---\n", 4);
  if (end === -1) throw new Error("Frontmatter not closed");
  const yaml = raw.slice(4, end);
  const out: Record<string, string> = {};
  for (const line of yaml.split("\n")) {
    const m = /^(\w+):\s*"?([^"]*)"?\s*$/.exec(line);
    if (m) out[m[1] as string] = m[2] as string;
  }
  return {
    charter: out.charter ?? "",
    agent: out.agent ?? "",
    browser: out.browser ?? "",
    model: out.model ?? "",
    date: out.date ?? "",
    time: out.time ?? "",
    duration_s: Number(out.duration_s ?? 0),
    status: out.status ?? "",
    findings: Number(out.findings ?? 0),
    promptHash: out.promptHash ?? "",
  };
}

function resolveManifestPath(reportPath: string): string {
  const dir = dirname(reportPath);
  const base = reportPath.replace(/\.md$/, "").split("/").pop() ?? "";
  return join(dir, "_attachments", base, "logs", "prompt-manifest.json");
}

async function loadManifest(reportPath: string): Promise<Manifest | null> {
  const path = resolveManifestPath(reportPath);
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

function parseFindingIds(raw: string): string[] {
  const lines = raw.split("\n");
  const idx = lines.findIndex((l) => /^##\s+Findings\b/i.test(l.trim()));
  if (idx === -1) return [];
  const ids: string[] = [];
  for (let i = idx + 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (/^##\s/.test(line)) break;
    const m = /^###\s+(F-\d+)\s*[—–-]\s*(.*)$/i.exec(line.trim());
    if (m) ids.push(`${m[1]} ${m[2]}`);
  }
  return ids;
}

export function diffManifests(
  a: Manifest | null,
  b: Manifest | null,
): { changed: string[]; added: string[]; removed: string[] } {
  if (!a || !b) return { changed: [], added: [], removed: [] };
  const mapA = new Map(a.fragments.map((f) => [f.name, f.hash]));
  const mapB = new Map(b.fragments.map((f) => [f.name, f.hash]));
  const changed: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];
  for (const [name, hash] of mapB) {
    const prev = mapA.get(name);
    if (prev === undefined) added.push(name);
    else if (prev !== hash) changed.push(name);
  }
  for (const name of mapA.keys()) {
    if (!mapB.has(name)) removed.push(name);
  }
  return { changed, added, removed };
}

export function formatComparison(
  metaA: ReportMeta,
  metaB: ReportMeta,
  manifestA: Manifest | null,
  manifestB: Manifest | null,
  findingsA: string[],
  findingsB: string[],
): string {
  const lines: string[] = [];

  lines.push("=== Prompt Changes ===");
  if (metaA.promptHash === metaB.promptHash) {
    lines.push(`  promptHash: ${metaA.promptHash} (unchanged)`);
  } else {
    lines.push(`  promptHash: ${metaA.promptHash} -> ${metaB.promptHash}`);
    const diff = diffManifests(manifestA, manifestB);
    if (diff.changed.length) lines.push(`  Changed fragments: ${diff.changed.join(", ")}`);
    if (diff.added.length) lines.push(`  Added fragments:   ${diff.added.join(", ")}`);
    if (diff.removed.length) lines.push(`  Removed fragments: ${diff.removed.join(", ")}`);
    if (!manifestA) lines.push("  (run A has no prompt-manifest.json)");
    if (!manifestB) lines.push("  (run B has no prompt-manifest.json)");
  }

  lines.push("");
  lines.push("=== Results Delta ===");
  const durDelta = metaB.duration_s - metaA.duration_s;
  const durPct = metaA.duration_s > 0 ? Math.round((durDelta / metaA.duration_s) * 100) : 0;
  const sign = durDelta >= 0 ? "+" : "";
  lines.push(`  Duration:  ${metaA.duration_s}s -> ${metaB.duration_s}s  (${sign}${durPct}%)`);
  lines.push(`  Findings:  ${metaA.findings} -> ${metaB.findings}`);
  lines.push(`  Status:    ${metaA.status} -> ${metaB.status}`);
  lines.push(`  Agent:     ${metaA.agent} -> ${metaB.agent}`);
  lines.push(`  Model:     ${metaA.model} -> ${metaB.model}`);

  lines.push("");
  lines.push("=== Findings Diff ===");
  const setA = new Set(findingsA);
  const setB = new Set(findingsB);
  const both = findingsA.filter((f) => setB.has(f));
  const newInB = findingsB.filter((f) => !setA.has(f));
  const gone = findingsA.filter((f) => !setB.has(f));
  if (both.length) lines.push(`  Both runs:  ${both.join("; ")}`);
  if (newInB.length) lines.push(`  New in B:   ${newInB.join("; ")}`);
  if (gone.length) lines.push(`  Gone in B:  ${gone.join("; ")}`);
  if (!both.length && !newInB.length && !gone.length) lines.push("  (no findings in either run)");

  lines.push("");
  lines.push("=== Verdict ===");
  if (metaA.promptHash === metaB.promptHash) {
    if (metaA.findings === metaB.findings) {
      lines.push("  Same prompt, same finding count. Results are consistent.");
    } else {
      lines.push("  Same prompt, different findings. Likely agent variance or site change.");
    }
  } else {
    lines.push("  Prompt changed. Review changed fragments to assess impact.");
  }

  return lines.join("\n");
}

if (import.meta.main) {
  const [pathA, pathB] = process.argv.slice(2);
  if (!pathA || !pathB) {
    console.error("Usage: bun scripts/compare-runs.ts <report-A.md> <report-B.md>");
    process.exit(1);
  }

  const [rawA, rawB] = await Promise.all([readFile(pathA, "utf8"), readFile(pathB, "utf8")]);
  const metaA = parseReportFrontmatter(rawA);
  const metaB = parseReportFrontmatter(rawB);
  const [manifestA, manifestB] = await Promise.all([loadManifest(pathA), loadManifest(pathB)]);
  const findingsA = parseFindingIds(rawA);
  const findingsB = parseFindingIds(rawB);

  console.log(formatComparison(metaA, metaB, manifestA, manifestB, findingsA, findingsB));
}
