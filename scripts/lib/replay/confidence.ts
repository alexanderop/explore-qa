import type { Confidence, Finding, ReplayEvent, Verification } from "./types.ts";

// Events within this many seconds AFTER a finding's anchor count as
// post-finding verification attempts. Tuned to roughly match the time an
// agent would plausibly spend confirming or re-examining a bug.
const WINDOW_S = 60;
const MAX_VERIFICATIONS = 5;
const HIGH_THRESHOLD = 3;
const MEDIUM_THRESHOLD = 1;

function scoreToConfidence(score: number): Confidence {
  if (score >= HIGH_THRESHOLD) return "high";
  if (score >= MEDIUM_THRESHOLD) return "medium";
  return "low";
}

export function scoreFinding(finding: Finding, events: ReplayEvent[]): Finding {
  if (finding.anchorT === undefined) return finding;
  const t0 = finding.anchorT;
  const cap = t0 + WINDOW_S;
  const verificationsAll: Verification[] = events
    .filter((e) => e.t > t0 && e.t <= cap)
    .filter((e) => e.kind === "inspect" || e.kind === "snap" || e.kind === "shot")
    .map((e) => ({ t: e.t, kind: e.kind, label: e.label, detail: e.detail }));
  const verifications = verificationsAll.slice(0, MAX_VERIFICATIONS);
  const confidence = scoreToConfidence(verificationsAll.length);
  return { ...finding, verifications, confidence };
}

export function scoreFindings(findings: Finding[], events: ReplayEvent[]): Finding[] {
  return findings.map((f) => scoreFinding(f, events));
}
