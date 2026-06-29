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

export function parseMarkdown(src: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of src.replace(/\r\n/g, "\n").trim().split(/\n{2,}/)) {
    if (!chunk.trim()) continue;
    const lines = chunk.split("\n");
    const ordered = lines.every((l) => /^\s*\d+\.\s+/.test(l));
    const bullet = lines.every((l) => /^\s*[-*]\s+/.test(l));
    if (ordered || bullet) {
      const items = lines.map((l) => parseInline(l.replace(/^\s*(?:\d+\.|[-*])\s+/, "")));
      blocks.push({ kind: "list", ordered, items });
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(lines[0] ?? "");
    if (h && lines.length === 1) {
      blocks.push({ kind: "heading", level: h[1]!.length, spans: parseInline(h[2]!) });
      continue;
    }
    // Paragraph: soft line breaks collapse to spaces (CommonMark soft break).
    blocks.push({ kind: "para", spans: parseInline(lines.join(" ")) });
  }
  return blocks;
}
