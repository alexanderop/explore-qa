import { describe, expect, test } from "bun:test";
import {
  applyFrontmatter,
  buildIndexRow,
  insertIndexRow,
  parseFindingsCount,
  type RunFrontmatter,
} from "../scripts/lib/index-md.ts";

const fm: RunFrontmatter = {
  charter: "search-mobile-smoke",
  agent: "claude",
  browser: "agent-browser",
  model: "claude-opus-4-6",
  date: "2026-04-14",
  time: "11:01:47",
  duration_s: 287,
  duration_hms: "00:04:47",
  status: "findings",
  findings: 3,
};

describe("applyFrontmatter", () => {
  test("prepends frontmatter to a body that has none", () => {
    const out = applyFrontmatter("# Bericht\n\nInhalt\n", fm);
    expect(out.startsWith("---\n")).toBe(true);
    expect(out).toContain("charter: search-mobile-smoke");
    expect(out).toContain("# Bericht");
  });

  test("is idempotent — replaces existing frontmatter instead of stacking", () => {
    const once = applyFrontmatter("# Bericht\n", fm);
    const twice = applyFrontmatter(once, { ...fm, findings: 5 });
    const matches = twice.match(/^---$/gm) ?? [];
    expect(matches.length).toBe(2);
    expect(twice).toContain("findings: 5");
    expect(twice).not.toContain("findings: 3");
  });
});

describe("parseFindingsCount", () => {
  test("counts data rows under ## Findings table", () => {
    const body =
      "# Report\n\n## Findings\n\n| ID | Sev | Titel |\n|---|---|---|\n| F1 | Major | a |\n| F2 | Minor | b |\n\n## Next\n";
    expect(parseFindingsCount(body)).toBe(2);
  });

  test("returns 0 when no Findings section", () => {
    expect(parseFindingsCount("# Report\n\n## Summary\nok\n")).toBe(0);
  });

  test("returns 0 when Findings section has no table rows", () => {
    expect(parseFindingsCount("# Report\n\n## Findings\n\nKeine.\n")).toBe(0);
  });
});

describe("insertIndexRow", () => {
  test("creates header + row when index is empty", () => {
    const out = insertIndexRow("", "| 2026-04-14 | … |");
    expect(out).toContain("# QA Runs");
    expect(out).toContain("| 2026-04-14 | … |");
  });

  test("inserts new row directly under the separator (newest first)", () => {
    const initial = insertIndexRow("", "| OLD |");
    const next = insertIndexRow(initial, "| NEW |");
    const newIdx = next.indexOf("| NEW |");
    const oldIdx = next.indexOf("| OLD |");
    expect(newIdx).toBeGreaterThan(-1);
    expect(newIdx).toBeLessThan(oldIdx);
  });
});

describe("buildIndexRow", () => {
  test("uses relative path from index to report and short HH:MM time", () => {
    const row = buildIndexRow(
      fm,
      "./qa-runs/README.md",
      "./qa-runs/charters/search-mobile-smoke/2026-04-14_11-01-47_claude_agent-browser.md",
    );
    expect(row).toContain("11:01");
    expect(row).not.toContain("11:01:47");
    expect(row).toContain(
      "(charters/search-mobile-smoke/2026-04-14_11-01-47_claude_agent-browser.md)",
    );
    expect(row).toContain("findings");
    expect(row).toContain("| 3 |");
  });
});
