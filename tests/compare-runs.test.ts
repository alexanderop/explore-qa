import { describe, expect, test } from "bun:test";
import { diffManifests, formatComparison } from "../scripts/compare-runs.ts";
import type { FragmentEntry } from "../scripts/lib/compose.ts";

const manifest = (fragments: FragmentEntry[]) => ({
  promptHash: "aaa111bbb222",
  fragments,
});

describe("diffManifests", () => {
  test("detects a changed fragment", () => {
    const a = manifest([
      { name: "_system", hash: "11111111" },
      { name: "_honesty-checks", hash: "22222222" },
    ]);
    const b = manifest([
      { name: "_system", hash: "11111111" },
      { name: "_honesty-checks", hash: "99999999" },
    ]);
    const diff = diffManifests(a, b);
    expect(diff.changed).toEqual(["_honesty-checks"]);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  test("detects added and removed fragments", () => {
    const a = manifest([{ name: "_system", hash: "11111111" }]);
    const b = manifest([{ name: "frag:_report-format", hash: "33333333" }]);
    const diff = diffManifests(a, b);
    expect(diff.added).toEqual(["frag:_report-format"]);
    expect(diff.removed).toEqual(["_system"]);
    expect(diff.changed).toEqual([]);
  });

  test("handles null manifests gracefully", () => {
    const diff = diffManifests(null, null);
    expect(diff.changed).toEqual([]);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });
});

describe("formatComparison", () => {
  const baseMeta = {
    charter: "smoke",
    agent: "claude",
    browser: "agent-browser",
    model: "claude-opus-4-6",
    date: "2026-04-14",
    time: "11:00:00",
    duration_s: 200,
    status: "pass",
    findings: 0,
    promptHash: "aaa111bbb222",
  };

  test("reports unchanged prompt when hashes match", () => {
    const out = formatComparison(baseMeta, baseMeta, null, null, [], []);
    expect(out).toContain("(unchanged)");
    expect(out).toContain("Results are consistent");
  });

  test("reports changed prompt with fragment diff", () => {
    const metaB = { ...baseMeta, promptHash: "ccc333ddd444", findings: 2 };
    const mA = manifest([{ name: "_system", hash: "11111111" }]);
    const mB = manifest([{ name: "_system", hash: "99999999" }]);
    const out = formatComparison(baseMeta, metaB, mA, mB, [], ["F-01 Bug"]);
    expect(out).toContain("aaa111bbb222 -> ccc333ddd444");
    expect(out).toContain("_system");
    expect(out).toContain("Review changed fragments");
    expect(out).toContain("F-01 Bug");
  });

  test("shows duration delta as percentage", () => {
    const metaB = { ...baseMeta, duration_s: 300 };
    const out = formatComparison(baseMeta, metaB, null, null, [], []);
    expect(out).toContain("200s -> 300s");
    expect(out).toContain("+50%");
  });
});
