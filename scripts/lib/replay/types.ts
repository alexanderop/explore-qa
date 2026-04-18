import type { Agent } from "../agents.ts";
import type { Browser } from "../browsers.ts";

export type EventKind =
  | "think"
  | "tool-call"
  | "tool-result"
  | "screenshot"
  | "nav"
  | "act"
  | "inspect"
  | "write"
  | "read"
  | "todo"
  | "shot"
  | "snap"
  | "tool"
  | "done"
  | "system";

export type ReplayEvent = {
  t: number;
  kind: EventKind;
  label: string;
  detail?: string;
  result?: string;
};

export type Milestone = { label: string; t: number };

export type KeyMoment = { t: number; text: string };

export type Screenshot = {
  name: string;
  rel: string;
  precedingSnapshot?: string;
  shotAt?: number;
};

export type ConsoleLevel = "error" | "warning" | "info" | "log";

export type ConsoleEntry = {
  level: ConsoleLevel;
  message: string;
  source?: string;
};

export type Severity = "Critical" | "Major" | "Minor";

export type Confidence = "high" | "medium" | "low";

export type Verification = {
  t: number;
  kind: EventKind;
  label: string;
  detail?: string;
};

export type Finding = {
  id: string;
  severity: Severity | "Unknown";
  title: string;
  scenario?: string;
  screenshot?: string;
  screenshotBasename?: string;
  anchorT?: number;
  reproSteps: string[];
  expected?: string;
  actual?: string;
  consoleNetwork?: string;
  suspectedCause?: string;
  verifications?: Verification[];
  confidence?: Confidence;
};

export type ReplayMeta = {
  charter: string;
  runId: string;
  agent: Agent;
  browser: Browser;
  site: string;
  model: string;
  promptHash: string;
  date: string;
  time: string;
  durationS: number;
  durationHms: string;
  status: "pass" | "findings" | "error";
  verdict: string;
  timingMode: "approximate" | "real";
};

export type ReplayData = {
  meta: ReplayMeta;
  events: ReplayEvent[];
  milestones: Milestone[];
  keyMoments: KeyMoment[];
  findings: Finding[];
  screenshots: Screenshot[];
  console: ConsoleEntry[];
};
