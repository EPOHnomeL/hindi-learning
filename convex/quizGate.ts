// The **quiz-structure gate**: one implementation of "may this body replace that
// one?", asked by every path that rewrites a Lesson.
//
// The reader derives quiz identity positionally and reads `data-correct` /
// `data-answer` / `data-k` out of the authored HTML (`lessonSrcDoc`, and ADR 0035
// makes that a permanent boundary), so a body whose marker counts changed is a
// broken quiz. `quizStructureMatches` was already shared. The **policy** it serves
// was not: fetch the other body's bytes, then decide *skip* against *refuse*, was
// written out at six call sites (candidate 2 of the 2026-09-04 architecture
// review, ticket 26).
//
// Two of those six were the reason this is a module rather than a tidy-up:
//
//   - `translate.publishTranslation`'s own guard was **dead for a blob-backed
//     Lesson** and had been since source bodies moved to content blobs: a mutation
//     cannot read a blob, so `src.html` was always `undefined` and the check never
//     fired. The rule that the real guard lived in the two callers that CAN read a
//     blob was held by a comment, and by nothing else.
//   - `publishTranslation` was a public `mutation`, so that dead guard was also
//     the only thing between a direct caller and an unchecked row. 59 rows had
//     already shipped that way.
//
// An unreadable source is `unreadable`, not `ok`. That distinction is the whole
// reason the verdict has three values: silently publishing when the comparison
// cannot be made is how the guard stopped protecting the first time.

// What the gate says. Three values, because "do not publish" has two different
// causes and the callers do different things about them: a `mismatch` is the
// model or the author having changed the quiz, which is a skip with an English
// fallback or a refusal to the author; `unreadable` means the comparison could
// not be made at all, which on the edit paths is a different message and on the
// sweep paths is a row to report rather than rewrite.
export type QuizVerdict = "ok" | "mismatch" | "unreadable";

// True when the quiz-scoring markers survived unchanged. The pure core, and the
// only part that looks at the markup.
export function quizStructureMatches(source: string, out: string): boolean {
  for (const re of [/data-correct=/g, /data-answer=/g, /data-k=/g]) {
    if ((source.match(re) ?? []).length !== (out.match(re) ?? []).length) return false;
  }
  return true;
}

// The policy. `source` is `null` when its bytes could not be read, which every
// caller can produce and none of them may treat as permission.
export function quizVerdict(source: string | null, out: string): QuizVerdict {
  if (source === null) return "unreadable";
  return quizStructureMatches(source, out) ? "ok" : "mismatch";
}

// ---- the answer key ------------------------------------------------------------

// Does every quiz's answer key name an option that exists? (Ticket 35.)
//
// Ticket 02 decided the quiz stays authored HTML and **the server never scores**
// (ADR 0035). That is the right call and it has one edge: with no scoring
// downstream, nothing in the pipeline ever evaluates the answer key, so an
// authored `data-correct="d"` whose options are only `data-k="a|b|c"` publishes
// cleanly and stays wrong forever.
//
// What that costs the learner: every option is marked wrong, none is ever
// highlighted as correct, and the quiz bridge posts `correct:false` for whatever
// they picked, so the teaching loop is told they failed a question that could not
// be passed. Lessons are immutable (ADR 0003), so it cannot be repaired in place
// and needs a republish.
//
// **This is not scoring.** It is a referential check on the authored markup: the
// key must name one of the options sitting beside it. The server still never
// decides whether a learner's answer was right.
//
// Returns the keys that name nothing, so the caller can say which quiz is broken.
// Empty means every answer key resolves.
export function unresolvableAnswerKeys(html: string): string[] {
  const bad: string[] = [];
  // Each quiz block, from its `data-correct` to the start of the next one (or the
  // end of the body). Deliberately string-matching rather than parsing: the reader
  // reads these attributes out of the raw HTML too, so matching the same way keeps
  // the two in step, and a Convex runtime has no DOM.
  const blocks = html.split(/(?=data-correct=)/).slice(1);
  for (const [i, block] of blocks.entries()) {
    const key = block.match(/^data-correct=["']([^"']*)["']/)?.[1];
    if (key === undefined) continue;
    // The options belong to THIS quiz: everything up to the next `data-correct`,
    // which the split has already trimmed for us.
    const options = new Set([...block.matchAll(/data-k=["']([^"']*)["']/g)].map((m) => m[1]));
    // A key naming no option at all is the defect. An empty key is a separate
    // authoring mistake and is caught by the same test: it names nothing.
    if (!options.has(key)) bad.push(key === "" ? `(quiz ${i + 1}: empty)` : key);
  }
  return bad;
}
