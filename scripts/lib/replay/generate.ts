import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Agent } from "../agents.ts";
import type { Browser } from "../browsers.ts";
import type { RunFrontmatter } from "../index-md.ts";
import { scoreFindings } from "./confidence.ts";
import { parseConsoleLog } from "./console.ts";
import { anchorFindings, extractSite, extractVerdict, parseFindings } from "./findings.ts";
import { addMilestones, charterKeywords, extractKeyMoments } from "./milestones.ts";
import { parseSessionLog } from "./parsers.ts";
import { renderReplay } from "./template.ts";
import { assignTimes } from "./timing.ts";
import type { Finding, ReplayData, ReplayEvent, Screenshot } from "./types.ts";

export type GenerateReplayInput = {
  runDir: string;
  logDir: string;
  screenshotDir: string;
  reportPath: string;
  charter: string;
  charterBody: string;
  runId: string;
  agent: Agent;
  browser: Browser;
  site: string;
  frontmatter: RunFrontmatter;
};

async function readOptional(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

async function listScreenshots(dir: string): Promise<Screenshot[]> {
  let entries: string[] = [];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  return entries
    .filter((n) => n.toLowerCase().endsWith(".png"))
    .sort()
    .map((name) => ({ name, rel: `./screenshots/${name}` }));
}

// Attach, per screenshot, the nearest preceding snap event's result (DOM/a11y
// snapshot) and the timestamp of the shot event that produced it. This lets
// the viewer flip between "what the agent saw" (screenshot) and "what the
// page structurally contained" (snapshot) at that moment.
function attachScreenshotContext(screenshots: Screenshot[], events: ReplayEvent[]): Screenshot[] {
  return screenshots.map((s) => {
    const shotEvent = events.find(
      (e) =>
        (e.kind === "shot" || e.kind === "screenshot") &&
        `${e.label} ${e.detail ?? ""}`.includes(s.name),
    );
    if (!shotEvent) return s;
    // Walk backwards from the shot event to find the most recent snap with a result.
    let precedingSnapshot: string | undefined;
    for (let i = events.indexOf(shotEvent) - 1; i >= 0; i--) {
      const e = events[i];
      if (!e) continue;
      if (e.kind === "snap" && e.result) {
        precedingSnapshot = e.result;
        break;
      }
    }
    return precedingSnapshot
      ? { ...s, shotAt: shotEvent.t, precedingSnapshot }
      : { ...s, shotAt: shotEvent.t };
  });
}

function stripFrontmatter(body: string): string {
  if (!body.startsWith("---\n")) return body;
  const end = body.indexOf("\n---\n", 4);
  if (end === -1) return body;
  return body.slice(end + 5);
}

export async function generateReplay(input: GenerateReplayInput): Promise<string> {
  const { runDir, logDir, screenshotDir, reportPath, frontmatter: fm } = input;

  const reportRaw = await readOptional(reportPath);
  const reportBody = stripFrontmatter(reportRaw);

  const logPath = join(logDir, `${input.agent}-session.jsonl`);
  const sessionRaw = await readOptional(logPath);

  const consoleRaw = await readOptional(join(logDir, "console_errors.log"));

  const screenshots = await listScreenshots(screenshotDir);

  const { events: rawEvents, hasRealTimestamps } = sessionRaw
    ? parseSessionLog(input.agent, sessionRaw)
    : { events: [], hasRealTimestamps: false };
  const events = assignTimes(rawEvents, fm.duration_s, hasRealTimestamps);

  const keywords = charterKeywords(input.charterBody);
  const milestones = addMilestones(events, keywords);
  const keyMoments = extractKeyMoments(events);

  const parsed = parseFindings(reportBody);
  const anchored = anchorFindings(parsed, events, screenshots);
  const findings: Finding[] = scoreFindings(anchored, events);

  const enrichedShots = attachScreenshotContext(screenshots, events);

  const site = extractSite(reportBody) ?? input.site;
  const verdict = extractVerdict(reportBody);

  const data: ReplayData = {
    meta: {
      charter: input.charter,
      runId: input.runId,
      agent: input.agent,
      browser: input.browser,
      site,
      model: fm.model,
      promptHash: fm.promptHash,
      date: fm.date,
      time: fm.time,
      durationS: fm.duration_s,
      durationHms: fm.duration_hms,
      status: fm.status,
      verdict,
      timingMode: hasRealTimestamps ? "real" : "approximate",
    },
    events,
    milestones,
    keyMoments,
    findings,
    screenshots: enrichedShots,
    console: parseConsoleLog(consoleRaw),
  };

  const html = renderReplay(data);
  const outPath = join(runDir, "replay.html");
  await writeFile(outPath, html);
  return outPath;
}
