import type { KeyMoment, Milestone, ReplayEvent } from "./types.ts";

// Kept deliberately in sync with battle-playground/generate.py MOMENT_RE.
export const MOMENT_RE =
  /(found|issue|bug|unexpected|anomaly|incorrect|missing|error|confirm|reprodu|notable|interesting|dropp|fail|broken|filter|closing quote|no[- ]?result\w*|zero[- ]?result\w*|H1\b|auto[- ]?navigat\w*|suspicious)/i;

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "for",
  "with",
  "via",
  "using",
  "from",
  "to",
  "on",
  "in",
  "of",
  "by",
  "is",
  "are",
  "submit",
  "enter",
  "check",
  "open",
  "verify",
  "validate",
  "test",
  "use",
  "case",
  "search",
  "query",
  "term",
]);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function encodeUmlaut(key: string): string {
  return key
    .replace(/ü/g, "(?:ü|u%CC%88|%C3%BC|ue)")
    .replace(/ö/g, "(?:ö|%C3%B6|oe)")
    .replace(/ä/g, "(?:ä|%C3%A4|ae)");
}

export function charterKeywords(charterBody: string): { label: string; pattern: RegExp }[] {
  const out: { label: string; pattern: RegExp }[] = [];
  const re =
    /(?:^|\n)\s*(?:[-*]\s*|#+\s+)?\**\s*Scenario\s+(\d+)\s*[—-]\s*([^\n*|]+?)\s*\**\s*(?::|\n|$)/gi;
  const seen = new Set<string>();
  for (const m of charterBody.matchAll(re)) {
    const num = m[1];
    const title = (m[2] ?? "").trim().replace(/\.+$/, "").trim();
    const words = title.match(/[A-Za-zäöüßÄÖÜ][\wäöüßÄÖÜ%öäü-]{2,}/g) ?? [];
    const key = words.find((w) => !STOPWORDS.has(w.toLowerCase()));
    if (!key) continue;
    const label = `Scn ${num} · ${key.toLowerCase()}`;
    if (seen.has(label)) continue;
    seen.add(label);
    const encoded = encodeUmlaut(key);
    const pattern = new RegExp(encoded === key ? escapeRe(key) : encoded, "i");
    out.push({ label, pattern });
  }
  return out;
}

export function addMilestones(
  events: ReplayEvent[],
  keywords: { label: string; pattern: RegExp }[],
): Milestone[] {
  const seen: Record<string, number> = {};
  for (const e of events) {
    if (e.kind === "think") continue;
    const blob = `${e.label} ${e.detail ?? ""}`.toLowerCase();
    for (const k of keywords) {
      if (k.label in seen) continue;
      if (k.pattern.test(blob)) seen[k.label] = e.t;
    }
  }
  const reportRe = /(write.*\.md|report\.md|final.*report|close.*browser)/i;
  for (const e of events) {
    if (e.kind === "think") continue;
    const blob = `${e.label} ${e.detail ?? ""}`.toLowerCase();
    if (!("Report" in seen) && reportRe.test(blob)) {
      seen.Report = e.t;
      break;
    }
  }
  return Object.entries(seen)
    .map(([label, t]) => ({ label, t }))
    .sort((a, b) => a.t - b.t);
}

export function extractKeyMoments(events: ReplayEvent[]): KeyMoment[] {
  const thinks = events.filter((e) => e.kind === "think");
  const scored = thinks.map((e) => {
    const text = `${e.label} ${e.detail ?? ""}`;
    const matches = text.match(new RegExp(MOMENT_RE.source, "gi")) ?? [];
    return { score: matches.length, event: e };
  });
  scored.sort((a, b) => b.score - a.score || a.event.t - b.event.t);
  const seen = new Set<string>();
  const out: KeyMoment[] = [];
  for (const { score, event } of scored) {
    if (score === 0) continue;
    const text = event.detail ?? event.label;
    const key = String(text).slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ t: event.t, text });
    if (out.length >= 5) break;
  }
  if (out.length === 0) {
    for (const e of thinks.slice(0, 3)) {
      out.push({ t: e.t, text: e.detail ?? e.label });
    }
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}
