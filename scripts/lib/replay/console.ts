import type { ConsoleEntry, ConsoleLevel } from "./types.ts";

const LEVELS: ReadonlySet<ConsoleLevel> = new Set<ConsoleLevel>([
  "error",
  "warning",
  "info",
  "log",
]);

export function parseConsoleLog(raw: string): ConsoleEntry[] {
  if (!raw.trim()) return [];
  const out: ConsoleEntry[] = [];
  const lines = raw.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = /^\[(error|warning|info|log)\]\s*(.*)$/i.exec(trimmed);
    if (!m) continue;
    const level = (m[1] ?? "log").toLowerCase() as ConsoleLevel;
    const normalized: ConsoleLevel = LEVELS.has(level) ? level : "log";
    const message = (m[2] ?? "").trim();
    // The next indented line (if any) carries the source.
    const next = lines[i + 1] ?? "";
    let source: string | undefined;
    if (next.startsWith(" ") || next.startsWith("\t")) {
      const sm = /^\s*Source:\s*(.+)$/i.exec(next);
      if (sm) {
        source = (sm[1] ?? "").trim();
      } else {
        source = next.trim();
      }
      i++;
    }
    out.push(source ? { level: normalized, message, source } : { level: normalized, message });
  }
  return out;
}
