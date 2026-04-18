import { basename } from "node:path";
import type { Agent } from "../agents.ts";
import type { EventKind, ReplayEvent } from "./types.ts";

type RawEvent = Omit<ReplayEvent, "t"> & { t?: number };

// Kinds whose tool results are worth embedding in the replay data blob.
// snap → DOM/a11y snapshot panel; inspect/shot → counter-evidence and provenance.
const CAPTURE_RESULT_KINDS: ReadonlySet<string> = new Set(["snap", "inspect", "shot"]);
const RESULT_MAX = 2000;

function coerceResultContent(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((part) => {
        const r = asRecord(part);
        if (!r) return "";
        if (typeof r.text === "string") return r.text;
        return "";
      })
      .join("\n");
  }
  const r = asRecord(raw);
  if (r && typeof r.text === "string") return r.text;
  return "";
}

function shortResult(s: string): string {
  const trimmed = s.trim();
  if (trimmed.length <= RESULT_MAX) return trimmed;
  return `${trimmed.slice(0, RESULT_MAX)}\n… [truncated ${trimmed.length - RESULT_MAX} chars]`;
}

function short(s: unknown, n = 120): string {
  return String(s ?? "")
    .replace(/\n/g, " ")
    .trim()
    .slice(0, n);
}

function classifyCmd(cmd: string, nm = ""): EventKind {
  const ls = (cmd || nm || "").toLowerCase();
  if (ls.includes("screenshot")) return "shot";
  if (ls.includes("snapshot")) return "snap";
  if (
    ls.includes("agent-browser open") ||
    ls.includes("wait --url") ||
    ls.includes("get url") ||
    ls.includes("reload")
  ) {
    return "nav";
  }
  if (
    ls.includes("fill ") ||
    ls.includes(" click ") ||
    ls.includes("click @") ||
    ls.includes(" press ") ||
    ls.includes("keyboard type")
  ) {
    return "act";
  }
  if (ls.includes(" eval ") || ls.includes('eval "') || ls.includes("eval '")) {
    return "inspect";
  }
  if (
    ls.includes("console") ||
    ls.includes("errors") ||
    ls.includes("network") ||
    ls.includes("--help")
  ) {
    return "inspect";
  }
  return "tool";
}

function parseTs(s: unknown): number | undefined {
  if (typeof s !== "string" || !s) return undefined;
  const normalized = s.replace(/Z$/, "+00:00");
  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? ms / 1000 : undefined;
}

function iterLines(raw: string): IterableIterator<unknown> {
  const lines = raw.split("\n");
  return (function* () {
    for (const line of lines) {
      if (!line) continue;
      try {
        yield JSON.parse(line) as unknown;
      } catch {
        // skip malformed lines
      }
    }
  })();
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function parseClaude(raw: string): RawEvent[] {
  const out: RawEvent[] = [];
  const pendingByToolId = new Map<string, RawEvent>();
  for (const ev of iterLines(raw)) {
    const r = asRecord(ev);
    if (!r) continue;
    const type = r.type;
    if (type === "assistant") {
      const msg = asRecord(r.message);
      const content = msg?.content;
      if (!Array.isArray(content)) continue;
      for (const item of content) {
        const it = asRecord(item);
        if (!it) continue;
        const itype = it.type;
        if (itype === "tool_use") {
          const nm = typeof it.name === "string" ? it.name : "";
          const toolId = typeof it.id === "string" ? it.id : "";
          const input = asRecord(it.input) ?? {};
          const desc = typeof input.description === "string" ? input.description : "";
          const cmd = typeof input.command === "string" ? input.command : "";
          let kind: EventKind = "tool";
          let label = nm;
          if (nm === "Bash") {
            kind = classifyCmd(cmd);
            label = desc || short(cmd, 80);
          } else if (nm === "TodoWrite") {
            kind = "todo";
            const todos = Array.isArray(input.todos) ? input.todos : [];
            const done = todos.filter((td) => asRecord(td)?.status === "completed").length;
            label = `todos ${done}/${todos.length}`;
          } else if (nm === "Write") {
            kind = "write";
            label = `write ${basename(String(input.file_path ?? ""))}`;
          } else if (nm === "Read") {
            kind = "read";
            label = `read ${basename(String(input.file_path ?? ""))}`;
          }
          const event: RawEvent = { kind, label: short(label, 90), detail: short(cmd, 240) };
          out.push(event);
          if (toolId && CAPTURE_RESULT_KINDS.has(kind)) {
            pendingByToolId.set(toolId, event);
          }
        } else if (itype === "text") {
          const text = typeof it.text === "string" ? it.text.trim() : "";
          if (text) {
            out.push({ kind: "think", label: short(text, 100), detail: short(text, 500) });
          }
        } else if (itype === "thinking") {
          const text = typeof it.thinking === "string" ? it.thinking.trim() : "";
          if (text) {
            out.push({ kind: "think", label: short(text, 100), detail: short(text, 500) });
          }
        }
      }
    } else if (type === "user") {
      const msg = asRecord(r.message);
      const content = msg?.content;
      if (!Array.isArray(content)) continue;
      for (const item of content) {
        const it = asRecord(item);
        if (!it || it.type !== "tool_result") continue;
        const toolId = typeof it.tool_use_id === "string" ? it.tool_use_id : "";
        const target = toolId ? pendingByToolId.get(toolId) : undefined;
        if (!target) continue;
        const body = coerceResultContent(it.content);
        if (body) target.result = shortResult(body);
        pendingByToolId.delete(toolId);
      }
    } else if (type === "result") {
      const dur = r.duration_ms;
      out.push({ kind: "done", label: "run complete", detail: `duration_ms=${String(dur ?? "")}` });
    }
  }
  return out;
}

function parseCodex(raw: string): RawEvent[] {
  const out: RawEvent[] = [];
  for (const ev of iterLines(raw)) {
    const r = asRecord(ev);
    if (!r) continue;
    const type = r.type;
    if (type === "item.completed") {
      const item = asRecord(r.item);
      if (!item) continue;
      const itype = item.type;
      if (itype === "agent_message") {
        const text = typeof item.text === "string" ? item.text : "";
        if (text) {
          out.push({ kind: "think", label: short(text, 100), detail: short(text, 500) });
        }
      } else if (itype === "command_execution") {
        const cmd = typeof item.command === "string" ? item.command : "";
        const kind = classifyCmd(cmd);
        const event: RawEvent = {
          kind,
          label: short(cmd, 90),
          detail: short(cmd, 300),
        };
        if (CAPTURE_RESULT_KINDS.has(kind)) {
          const output = typeof item.aggregated_output === "string" ? item.aggregated_output : "";
          if (output) event.result = shortResult(output);
        }
        out.push(event);
      }
    } else if (type === "task.completed") {
      out.push({ kind: "done", label: "run complete", detail: "" });
    }
  }
  return out;
}

function parseCopilot(raw: string): { events: RawEvent[]; firstTs: number | undefined } {
  const out: RawEvent[] = [];
  const pendingByToolId = new Map<string, RawEvent>();
  let first: number | undefined;
  for (const ev of iterLines(raw)) {
    const r = asRecord(ev);
    if (!r) continue;
    const type = r.type;
    const ts = parseTs(r.timestamp);
    if (ts !== undefined && first === undefined) first = ts;
    const rel = ts !== undefined && first !== undefined ? ts - first : undefined;
    const data = asRecord(r.data);
    if (!data) continue;
    if (type === "assistant.message") {
      const content = typeof data.content === "string" ? data.content.trim() : "";
      if (content) {
        out.push({
          t: rel,
          kind: "think",
          label: short(content, 100),
          detail: short(content, 500),
        });
      }
      const toolReqs = Array.isArray(data.toolRequests) ? data.toolRequests : [];
      for (const tr of toolReqs) {
        const t = asRecord(tr);
        if (!t) continue;
        const nm = typeof t.name === "string" ? t.name : "";
        const toolId = typeof t.toolCallId === "string" ? t.toolCallId : "";
        const args = asRecord(t.arguments) ?? {};
        const cmd =
          (typeof args.command === "string" && args.command) ||
          (typeof args.cmd === "string" && args.cmd) ||
          (typeof args.script === "string" && args.script) ||
          (typeof args.query === "string" && args.query) ||
          "";
        const desc = typeof args.description === "string" ? args.description : "";
        let kind: EventKind;
        if (nm === "sql") kind = "todo";
        else if (nm === "view" || nm === "edit" || nm === "str_replace_editor") kind = "write";
        else kind = classifyCmd(cmd, nm);
        const label = cmd ? short(cmd, 90) : desc || nm;
        const event: RawEvent = {
          t: rel,
          kind,
          label: short(label, 90),
          detail: short(cmd || desc, 300),
        };
        out.push(event);
        if (toolId && CAPTURE_RESULT_KINDS.has(kind)) {
          pendingByToolId.set(toolId, event);
        }
      }
    } else if (type === "tool.execution_complete") {
      const toolId = typeof data.toolCallId === "string" ? data.toolCallId : "";
      if (!toolId) continue;
      const target = pendingByToolId.get(toolId);
      if (!target) continue;
      const result = asRecord(data.result);
      const body =
        coerceResultContent(result?.content) ||
        coerceResultContent(result?.detailedContent) ||
        coerceResultContent(data.result);
      if (body) target.result = shortResult(body);
      pendingByToolId.delete(toolId);
    } else if (type === "interaction.completed") {
      out.push({ t: rel, kind: "done", label: "run complete", detail: "" });
    }
  }
  return { events: out, firstTs: first };
}

export type ParserResult = {
  events: RawEvent[];
  hasRealTimestamps: boolean;
};

export function parseSessionLog(agent: Agent, raw: string): ParserResult {
  switch (agent) {
    case "claude":
      return { events: parseClaude(raw), hasRealTimestamps: false };
    case "codex":
      return { events: parseCodex(raw), hasRealTimestamps: false };
    case "copilot": {
      const { events, firstTs } = parseCopilot(raw);
      return { events, hasRealTimestamps: firstTs !== undefined };
    }
  }
}

// Exported for testing
export const __test = { classifyCmd, short, parseTs };
