import { describe, expect, it } from "vitest";
import { missionPreview, parseInline, parseMarkdown } from "./markdown";

describe("parseInline", () => {
  it("splits bold from surrounding text", () => {
    expect(parseInline("a **b** c")).toEqual([
      { kind: "text", text: "a " },
      { kind: "strong", text: "b" },
      { kind: "text", text: " c" },
    ]);
  });

  it("keeps safe links but renders unsafe schemes literally (no XSS)", () => {
    expect(parseInline("[site](https://x.com)")).toEqual([{ kind: "link", text: "site", href: "https://x.com" }]);
    expect(parseInline("[x](javascript:alert)")).toEqual([{ kind: "text", text: "[x](javascript:alert)" }]);
  });
});

describe("parseMarkdown", () => {
  it("parses headings, paragraphs, and lists", () => {
    expect(parseMarkdown("# Goal\n\nRead daily.\n\n- one\n- two")).toEqual([
      { kind: "heading", level: 1, spans: [{ kind: "text", text: "Goal" }] },
      { kind: "para", spans: [{ kind: "text", text: "Read daily." }] },
      { kind: "list", ordered: false, items: [[{ kind: "text", text: "one" }], [{ kind: "text", text: "two" }]] },
    ]);
  });

  it("starts a heading/list even with no blank line before it", () => {
    expect(parseMarkdown("## Success\n- one\n- two\nMore.")).toEqual([
      { kind: "heading", level: 2, spans: [{ kind: "text", text: "Success" }] },
      { kind: "list", ordered: false, items: [[{ kind: "text", text: "one" }], [{ kind: "text", text: "two" }]] },
      { kind: "para", spans: [{ kind: "text", text: "More." }] },
    ]);
  });
});

describe("missionPreview", () => {
  it("returns the first prose paragraph, stripping the Mission heading and markers", () => {
    const src = "# Mission: Hindi\n## Why\nRead the **Hindi Bible** in its _original_ form.";
    expect(missionPreview(src)).toBe("Read the Hindi Bible in its original form.");
  });

  it("falls back to the first non-Mission heading when there's no paragraph", () => {
    expect(missionPreview("# Mission: Hindi\n## Why I want this\n- a\n- b")).toBe("Why I want this");
  });

  it("falls back to the first list item when there's no paragraph or other heading", () => {
    expect(missionPreview("# Mission: Hindi\n- first goal\n- second goal")).toBe("first goal");
  });
});
