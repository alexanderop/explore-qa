import { basename } from "node:path";
import type { Finding, ReplayEvent, Screenshot, Severity } from "./types.ts";

const SEV_SET: ReadonlySet<Severity> = new Set<Severity>(["Critical", "Major", "Minor"]);

function coerceSeverity(s: string): Severity | "Unknown" {
  const v = s.trim();
  return SEV_SET.has(v as Severity) ? (v as Severity) : "Unknown";
}

function stripBody(body: string): string {
  if (body.startsWith("---\n")) {
    const end = body.indexOf("\n---\n", 4);
    if (end !== -1) return body.slice(end + 5);
  }
  return body;
}

export function extractVerdict(reportBody: string): string {
  const m = /\*\*One-sentence verdict:\*\*\s*([^\n]+)/i.exec(reportBody);
  return m ? (m[1] ?? "").trim() : "";
}

export function extractSite(reportBody: string): string | undefined {
  const m = /\*\*Site:\*\*\s*([^\s\n]+)/i.exec(reportBody);
  return m ? m[1]?.trim() : undefined;
}

function bulletValue(section: string, label: string): string | undefined {
  const re = new RegExp(`^\\s*-\\s*\\*\\*${label}:\\*\\*\\s*(.+)$`, "mi");
  const m = re.exec(section);
  return m ? (m[1] ?? "").trim() : undefined;
}

function extractReproSteps(section: string): string[] {
  const header = /\*\*Repro steps:\*\*/i.exec(section);
  if (!header) return [];
  const rest = section.slice(header.index + header[0].length);
  const steps: string[] = [];
  const lines = rest.split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // Stop at the next bold bullet (next field) or blank-then-non-indented line.
    if (/^-\s*\*\*/.test(line)) break;
    const numMatch = /^\d+\.\s+(.+)$/.exec(line);
    if (numMatch) {
      steps.push((numMatch[1] ?? "").trim());
      continue;
    }
    // tolerate dash bullets within repro steps
    const dashMatch = /^-\s+(.+)$/.exec(line);
    if (dashMatch && steps.length > 0) {
      steps[steps.length - 1] = `${steps[steps.length - 1]} ${(dashMatch[1] ?? "").trim()}`;
    }
  }
  return steps;
}

function extractScreenshot(section: string): string | undefined {
  // Prefer the **Evidence:** line which uses Markdown image syntax.
  const ev = /\*\*Evidence:\*\*\s*!\[[^\]]*\]\(([^)]+)\)/i.exec(section);
  if (ev?.[1]) return ev[1].trim();
  // Fallback: any ./screenshots/... reference in the block.
  const fb = /\.\/screenshots\/[^)\s`'"]+/.exec(section);
  return fb?.[0];
}

export function parseFindings(reportBody: string): Finding[] {
  const body = stripBody(reportBody);
  const out: Finding[] = [];
  // Split on H3 finding headers of the form: ### F-01 — Title
  const headerRe = /^###\s+F-0*(\d+)\s+[—-]\s+(.+?)\s*$/gim;
  const positions: { id: string; num: number; title: string; start: number }[] = [];
  for (const m of body.matchAll(headerRe)) {
    const idx = m.index ?? 0;
    positions.push({
      id: `F-${(m[1] ?? "").padStart(2, "0")}`,
      num: Number(m[1]),
      title: (m[2] ?? "").trim(),
      start: idx + m[0].length,
    });
  }
  for (let i = 0; i < positions.length; i++) {
    const cur = positions[i];
    if (!cur) continue;
    const next = positions[i + 1];
    // End the block at the next H2/H3, or the next finding start.
    const after = body.slice(cur.start);
    const endRe = /\n(##\s|###\s)/;
    const endMatch = endRe.exec(after);
    const endRel = next ? next.start - cur.start - 1 : endMatch ? endMatch.index : after.length;
    const section = after.slice(0, Math.max(0, endRel));

    const screenshot = extractScreenshot(section);
    out.push({
      id: cur.id,
      severity: coerceSeverity(bulletValue(section, "Severity") ?? ""),
      title: cur.title,
      scenario: bulletValue(section, "Scenario"),
      screenshot,
      screenshotBasename: screenshot ? basename(screenshot) : undefined,
      reproSteps: extractReproSteps(section),
      expected: bulletValue(section, "Expected"),
      actual: bulletValue(section, "Actual"),
      consoleNetwork: bulletValue(section, "Console/network"),
      suspectedCause: bulletValue(section, "Suspected cause"),
    });
  }
  return out;
}

export function anchorFindings(
  findings: Finding[],
  events: ReplayEvent[],
  screenshots: Screenshot[],
): Finding[] {
  const shotNames = new Set(screenshots.map((s) => s.name));
  return findings.map((f) => {
    if (!f.screenshotBasename) return f;
    const name = f.screenshotBasename;
    const exists = shotNames.has(name);
    if (!exists) return f;
    // Find the event whose label/detail references this screenshot filename.
    // Screenshot tool calls typically include the filename as `--out .../name.png`.
    const match = events.find((e) => {
      const blob = `${e.label} ${e.detail ?? ""}`;
      return blob.includes(name);
    });
    if (match) return { ...f, anchorT: match.t };
    // Fallback: keyword search in think events for a salient word from the title.
    const words = f.title.match(/[A-Za-zäöüßÄÖÜ][\w-]{3,}/g) ?? [];
    const kw = words.find((w) => w.length >= 4)?.toLowerCase();
    if (!kw) return f;
    const think = events.find(
      (e) => e.kind === "think" && `${e.label} ${e.detail ?? ""}`.toLowerCase().includes(kw),
    );
    return think ? { ...f, anchorT: think.t } : f;
  });
}
