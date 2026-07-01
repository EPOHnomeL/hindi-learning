"use client";

import { parseMarkdown, type Span } from "./markdown";

// Renders the common-subset Markdown parsed by ./markdown into React elements.
// Shared by the Mission blurb and the Q&A teacher replies so `**bold**` /
// `*italic*` show as formatting, not literal asterisks.
export function Markdown({ source, className }: { source: string; className?: string }) {
  return (
    <div className={className ?? "flex flex-col gap-3 text-sm leading-relaxed text-ink"}>
      {parseMarkdown(source).map((b, i) => {
        if (b.kind === "heading") {
          const Tag = `h${Math.min(b.level + 1, 6)}` as "h2" | "h3" | "h4" | "h5" | "h6";
          return (
            <Tag key={i} className="font-semibold text-accent">
              {renderSpans(b.spans)}
            </Tag>
          );
        }
        if (b.kind === "list") {
          const Tag = b.ordered ? "ol" : "ul";
          return (
            <Tag key={i} className={`ml-5 flex flex-col gap-1 ${b.ordered ? "list-decimal" : "list-disc"}`}>
              {b.items.map((item, j) => (
                <li key={j}>{renderSpans(item)}</li>
              ))}
            </Tag>
          );
        }
        if (b.kind === "code") {
          return (
            <pre key={i} className="overflow-x-auto rounded-lg bg-hi px-3 py-2 text-[0.8em] leading-relaxed text-ink">
              <code>{b.text}</code>
            </pre>
          );
        }
        if (b.kind === "quote") {
          return (
            <blockquote key={i} className="border-l-2 border-line pl-3 text-soft">
              {renderSpans(b.spans)}
            </blockquote>
          );
        }
        return <p key={i}>{renderSpans(b.spans)}</p>;
      })}
    </div>
  );
}

function renderSpans(spans: Span[]) {
  return spans.map((s, i) => {
    switch (s.kind) {
      case "strong":
        return <strong key={i} className="font-semibold text-ink">{s.text}</strong>;
      case "em":
        return <em key={i}>{s.text}</em>;
      case "code":
        return <code key={i} className="rounded bg-hi px-1 py-0.5 text-[0.85em]">{s.text}</code>;
      case "link":
        return (
          <a key={i} href={s.href} target="_blank" rel="noopener noreferrer" className="text-accent2 underline underline-offset-2">
            {s.text}
          </a>
        );
      default:
        return <span key={i}>{s.text}</span>;
    }
  });
}
