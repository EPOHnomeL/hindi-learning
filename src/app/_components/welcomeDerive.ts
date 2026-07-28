// Pure derivations behind the first-open welcome panel (welcome/01). Sits beside
// readerDerive (whose `resumeLessonKey` answers "which lesson next?" for both
// readers) rather than inside it: this is the welcome panel's own seam, and it is
// shared by the authed reader (CourseShell) and the Guest reader (PublicReader).
// No React, no DOM — runs in the edge-runtime test environment.

type ProgressLite = { lessonKey: string; status: "opened" | "completed" };

// A Guest's per-device completed set (localStorage, no account) shaped as progress
// rows, so `resumeLessonKey` — and not a parallel Guest-side reimplementation —
// answers "which lesson next?" on a Public link too.
export function guestProgress(completed: ReadonlySet<string>): ProgressLite[] {
  return [...completed].map((lessonKey) => ({ lessonKey, status: "completed" as const }));
}

// Strip the markdown syntax out of authored prose, keeping the words. Missions are
// written as markdown but the excerpt is plain text, so a mission opening
// "# Mission: …" used to render its own hash marks into the panel. Headings are
// matched at a line start only, so a "#1" or a "C#" mid-sentence survives; emphasis
// and inline code are matched as *pairs*, so a lone underscore in a snake_case word
// isn't silently eaten.
function stripMarkdown(text: string): string {
  return text
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, "") // "## Heading" → "Heading"
    .replace(/^[ \t]*#{1,6}[ \t]*$/gm, "") // a bare marker on its own line
    .replace(/\*\*?([^*\n]+)\*\*?/g, "$1") // **bold** / *italic*
    .replace(/_([^_\n]+)_/g, "$1") // _emphasis_
    .replace(/`([^`\n]+)`/g, "$1"); // `code`
}

// The opening line or two of the course mission, for the welcome panel. Missions
// are authored prose (hard newlines, stray double spaces), so collapse whitespace
// to one line before measuring. A blank mission — or one that was nothing but
// markdown syntax — is no mission: null, so the panel renders without an empty gap.
// Over the limit: cut on the last word boundary and mark it with an ellipsis; a
// single word longer than the limit is hard-cut, because there is nothing to break
// on.
export function missionExcerpt(mission: string | null | undefined, limit = 180): string | null {
  const text = stripMarkdown(mission ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

// Is this the reader's first open of the course? Latched, and that is the whole
// point: rendering a lesson writes an `opened` progress row (ArtifactView) and
// progress is a live query, so an unlatched `progress.length === 0` would flip to
// false a beat after the panel appeared and tear it away mid-sentence. Decide once,
// when progress first arrives, then hold: `prev` non-null is the latch, `undefined`
// progress is "still loading — no verdict yet".
export function latchFirstOpen(
  prev: boolean | null,
  progress: readonly ProgressLite[] | undefined,
): boolean | null {
  if (prev !== null) return prev;
  if (progress === undefined) return null;
  return progress.length === 0;
}
