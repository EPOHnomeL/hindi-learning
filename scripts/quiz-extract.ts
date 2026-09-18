// The pure half of the quiz export (scripts/export-quizzes.ts): pull the authored
// quizzes out of one Lesson body. No I/O and no Convex here, so the parsing rules
// are directly testable.
//
// It reads the SAME markers the reader scores on (`.quiz[data-correct]` /
// `.quiz.fill[data-answer]` / `.opt[data-k]`, ADR 0035), and by string-matching
// rather than parsing, for the same reason convex/quizGate.ts does: the reader
// takes them out of the raw HTML too, so matching the same way keeps the two in
// step, and nothing here needs a DOM.

export type Quiz = {
  /** 1-based position within the Lesson, the same positional identity the reader uses. */
  index: number;
  kind: "choice" | "fill";
  question: string;
  /** The correct answer as prose: the winning option's text, or the fill-in word. */
  answer: string;
  /** Every option as "a. text", in authored order. Empty for a fill-in. */
  options: string[];
  /** `data-correct` / `data-answer` verbatim, the key the reader scores against. */
  answerKey: string;
  /** `data-alt`: a second accepted spelling for a fill-in. */
  answerAlt?: string;
  feedbackCorrect?: string;
  feedbackWrong?: string;
};

// The handful of named entities the authored lessons actually use. Anything else
// is left as written rather than guessed at.
const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: String.fromCodePoint(0x2014),
  ndash: String.fromCodePoint(0x2013),
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
};

/** Markup to plain cell text: tags out, entities decoded, whitespace collapsed. */
export function plain(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&(\w+);/g, (m, name: string) => ENTITIES[name] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`, "i"));
  return m ? plain(m[1]!) : undefined;
}

/**
 * Every quiz in one Lesson body, in authored order.
 *
 * A quiz block runs from its opening `<div class="quiz...">` to the `<div class="fb">`
 * that closes it, which is the feedback slot every authored quiz ends with and a
 * cheaper anchor than balancing the block's nested divs.
 */
export function extractQuizzes(html: string): Quiz[] {
  const out: Quiz[] = [];
  const block = /<div class="quiz([^"]*)"([^>]*)>([\s\S]*?)<div class="fb"/g;
  for (const m of html.matchAll(block)) {
    const classes = m[1]!;
    const tag = m[2]!;
    const inner = m[3]!;
    const fill = /\bfill\b/.test(classes);
    const question = plain(inner.match(/<div class="q">([\s\S]*?)<\/div>/)?.[1] ?? "");
    const options: string[] = [];
    let answer = "";
    let answerKey = "";
    if (fill) {
      answerKey = attr(tag, "data-answer") ?? "";
      answer = answerKey;
    } else {
      answerKey = attr(tag, "data-correct") ?? "";
      for (const o of inner.matchAll(/<button class="opt" data-k="([^"]*)"[^>]*>([\s\S]*?)<\/button>/g)) {
        const k = o[1]!;
        const text = plain(o[2]!);
        options.push(`${k}. ${text}`);
        if (k === answerKey) answer = text;
      }
      // An answer key naming no option is the broken-quiz case convex/quizGate.ts
      // reports (`unresolvableAnswerKeys`). Say so in the cell rather than leaving
      // it blank, so a reader of the sheet can tell it apart from a missing quiz.
      if (!answer) answer = answerKey ? `(unresolved key "${answerKey}")` : "";
    }
    out.push({
      index: out.length + 1,
      kind: fill ? "fill" : "choice",
      question,
      answer,
      options,
      answerKey,
      answerAlt: fill ? attr(tag, "data-alt") : undefined,
      feedbackCorrect: attr(tag, "data-ok"),
      feedbackWrong: attr(tag, "data-no"),
    });
  }
  return out;
}
