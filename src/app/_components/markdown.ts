// ponytail: common-subset Markdown (headings, bold, italic, inline code, links,
// bullet/numbered lists, paragraphs) parsed to a small block tree — enough for a
// Mission blurb. No dep; the renderer turns these into React elements, so there's
// no raw HTML and no XSS surface. Ceiling: no tables/blockquotes/nested lists —
// if Missions ever need those, swap in react-markdown instead of growing this.

export type Span =
  | { kind: "text"; text: string }
  | { kind: "strong"; text: string }
  | { kind: "em"; text: string }
  | { kind: "code"; text: string }
  | { kind: "link"; text: string; href: string };

export type Block =
  | { kind: "heading"; level: number; spans: Span[] }
  | { kind: "para"; spans: Span[] }
  | { kind: "list"; ordered: boolean; items: Span[][] };

// Order matters: code first (so * inside `code` isn't read as bold), then bold,
// then italic, then links.
const INLINE = /(`[^`]+`)|(\*\*[\s\S]+?\*\*|__[\s\S]+?__)|(\*[\s\S]+?\*|_[\s\S]+?_)|(\[[^\]]+\]\([^)\s]+\))/g;
const SAFE_HREF = /^(https?:\/\/|mailto:|\/)/i;

export function parseInline(text: string): Span[] {
  const spans: Span[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const i = m.index ?? 0;
    const tok = m[0];
    if (i > last) spans.push({ kind: "text", text: text.slice(last, i) });
    if (m[1]) spans.push({ kind: "code", text: tok.slice(1, -1) });
    else if (m[2]) spans.push({ kind: "strong", text: tok.slice(2, -2) });
    else if (m[3]) spans.push({ kind: "em", text: tok.slice(1, -1) });
    else {
      const close = tok.indexOf("](");
      const href = tok.slice(close + 2, -1);
      if (SAFE_HREF.test(href)) spans.push({ kind: "link", text: tok.slice(1, close), href });
      else spans.push({ kind: "text", text: tok }); // unsafe scheme → render literally
    }
    last = i + tok.length;
  }
  if (last < text.length) spans.push({ kind: "text", text: text.slice(last) });
  return spans;
}

// A clean plain-text preview of a Mission for the course-card blurb: the first
// paragraph of prose (the actual "why"), with the redundant "# Mission: X" heading
// and all Markdown markers stripped. The card clamps it to two lines. Falls back to
// the first meaningful heading/list item, then to the raw text with markers removed.
export function missionPreview(src: string): string {
  const blocks = parseMarkdown(src);
  const text = (spans: Span[]) => spans.map((s) => s.text).join("").trim();

  for (const b of blocks) {
    if (b.kind === "para") {
      const t = text(b.spans);
      if (t) return t;
    }
  }
  for (const b of blocks) {
    if (b.kind === "heading") {
      const t = text(b.spans);
      if (t && !/^mission\b/i.test(t)) return t;
    } else if (b.kind === "list" && b.items.length) {
      const t = text(b.items[0]!);
      if (t) return t;
    }
  }
  return src.replace(/[#*_`>]+/g, " ").replace(/\s+/g, " ").trim();
}

export function parseMarkdown(src: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { kind: "list"; ordered: boolean; items: Span[][] } | null = null;

  // Headings and lists are their own blocks even with no blank line around them
  // (Missions often pack a `## heading` straight onto its list), so parse line by
  // line and flush the open paragraph/list when a new block kind starts.
  const flushPara = () => {
    if (para.length) blocks.push({ kind: "para", spans: parseInline(para.join(" ")) });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const line of src.replace(/\r\n/g, "\n").split("\n")) {
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      flushList();
      blocks.push({ kind: "heading", level: h[1]!.length, spans: parseInline(h[2]!) });
      continue;
    }
    const item = /^\s*(?:(\d+\.)|[-*])\s+(.*)$/.exec(line);
    if (item) {
      flushPara();
      const ordered = item[1] != null;
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { kind: "list", ordered, items: [] };
      }
      list.items.push(parseInline(item[2]!));
      continue;
    }
    // Plain text: soft line breaks collapse to spaces (CommonMark soft break).
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return blocks;
}
