import { describe, expect, test } from "bun:test";
import { parseFrontmatter } from "../scripts/lib/compose.ts";

const wrap = (yaml: string, body = "# Body\n\nHello") => `---\n${yaml}\n---\n${body}`;

describe("parseFrontmatter", () => {
  test("parses scalar fields", () => {
    const { meta, body } = parseFrontmatter(
      wrap("name: foo\nrunRoot: qa-runs/x\nartifact: report.md"),
    );
    expect(meta.name).toBe("foo");
    expect(meta.runRoot).toBe("qa-runs/x");
    expect(meta.artifact).toBe("report.md");
    expect(body).toContain("# Body");
  });

  test("parses nested map (defaultModel)", () => {
    const { meta } = parseFrontmatter(
      wrap("name: foo\ndefaultModel:\n  claude: claude-opus-4-6\n  codex: gpt-5.4"),
    );
    expect(meta.defaultModel.claude).toBe("claude-opus-4-6");
    expect(meta.defaultModel.codex).toBe("gpt-5.4");
  });

  test("parses list (includeFragments)", () => {
    const { meta } = parseFrontmatter(
      wrap("name: foo\nincludeFragments:\n  - _browser-workflow\n  - _report-format"),
    );
    expect(meta.includeFragments).toEqual(["_browser-workflow", "_report-format"]);
  });

  test("accepts valid defaultBrowser", () => {
    const { meta } = parseFrontmatter(wrap("name: foo\ndefaultBrowser: playwright-cli"));
    expect(meta.defaultBrowser).toBe("playwright-cli");
  });

  test("rejects invalid defaultBrowser silently (undefined, no throw)", () => {
    const { meta } = parseFrontmatter(wrap("name: foo\ndefaultBrowser: chrome-devtools"));
    expect(meta.defaultBrowser).toBeUndefined();
  });

  test("missing defaultBrowser → undefined", () => {
    const { meta } = parseFrontmatter(wrap("name: foo"));
    expect(meta.defaultBrowser).toBeUndefined();
  });

  test("throws when frontmatter delimiter is missing", () => {
    expect(() => parseFrontmatter("name: foo\nno-delimiter")).toThrow();
  });

  test("throws when frontmatter is not closed", () => {
    expect(() => parseFrontmatter("---\nname: foo\nno-closing-delimiter")).toThrow();
  });

  test("applies sensible defaults when frontmatter is minimal", () => {
    const { meta } = parseFrontmatter(wrap("name: foo"));
    expect(meta.runRoot).toBe("qa-runs");
    expect(meta.artifact).toBe("report.md");
    expect(meta.includeFragments).toEqual([]);
  });
});
