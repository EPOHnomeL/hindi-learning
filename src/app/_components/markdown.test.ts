import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown } from "./markdown";

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
});
