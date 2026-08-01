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

// A whole heading line, marker and words both — matched at a line start only, so a
// "#1" or a "C#" mid-sentence survives. A bare marker with no words is a heading too.
const HEADING_LINE = /^[ \t]*#{1,6}(?:[ \t].*)?$/gm;
// Just the marker, leaving the heading's words behind.
const HEADING_MARKER = /^[ \t]*#{1,6}[ \t]*/gm;

// Flatten authored markdown prose to the one plain-text line the panel renders.
// Emphasis and inline code are matched as *pairs*, so a lone underscore in a
// snake_case word isn't silently eaten.
function flatten(text: string): string {
  return text
    .replace(/\*\*?([^*\n]+)\*\*?/g, "$1") // **bold** / *italic*
    .replace(/_([^_\n]+)_/g, "$1") // _emphasis_
    .replace(/`([^`\n]+)`/g, "$1") // `code`
    .replace(/\s+/g, " ")
    .trim();
}

// The opening line or two of the course mission, for the welcome panel. Missions
// are authored prose (hard newlines, stray double spaces), so collapse whitespace
// to one line before measuring. A blank mission — or one that was nothing but
// markdown syntax — is no mission: null, so the panel renders without an empty gap.
// Over the limit: cut on the last word boundary and mark it with an ellipsis; a
// single word longer than the limit is hard-cut, because there is nothing to break
// on.
//
// Headings are dropped, not flattened. Collapsing to one line used to glue a
// mission's own title onto the paragraph beneath it — "…hearing God's voice Why I
// want a living, day-to-day walk…", two sentences with no punctuation between them —
// and that title was usually the course name restated, which the panel already shows
// directly above the excerpt. Excerpt the prose instead. A mission that is *nothing*
// but headings falls back to their words, since that is all the prose there is.
export function missionExcerpt(mission: string | null | undefined, limit = 180): string | null {
  const raw = mission ?? "";
  const text = flatten(raw.replace(HEADING_LINE, "")) || flatten(raw.replace(HEADING_MARKER, ""));
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
//
// `lessonCount` is the other half of the verdict, and it is the same latching
// argument run forwards: a course with no lessons yet is one being *created*, and
// the owner sitting on "Preparing your first lesson…" got a welcome panel over an
// empty course announcing "0 lessons" with nothing to start — orientation for a
// course that doesn't exist yet. Zero is a hard no, and because the verdict latches,
// the panel doesn't then ambush them the instant generation lands lesson 1.
// `undefined` is "lessons still loading", same as progress: no verdict yet.
export function latchFirstOpen(
  prev: boolean | null,
  progress: readonly ProgressLite[] | undefined,
  lessonCount: number | undefined,
): boolean | null {
  if (prev !== null) return prev;
  if (progress === undefined || lessonCount === undefined) return null;
  return progress.length === 0 && lessonCount > 0;
}

// Which panel — if any — owns the reader's opening moment (ywampotch-launch 17).
// One panel, not two: the card buyer coming back from PayFast used to get a
// "confirming your payment" *banner* that rendered only while the ITN was in
// flight, and since the ITN lands in seconds the happy path acknowledged nothing
// at all — the generic first-open welcome filled the silence with a course intro,
// having no idea money had just changed hands. So the purchase states are variants
// OF this panel and they win outright.
//
// `checkout` is `market.checkoutStatus`, reactive: undefined while loading, null
// when the URL's token names no intent, else the intent's state. Undefined holds
// the panel back a beat rather than guessing "confirming" — the buyer whose
// payment is already through is the common case and must not see it flash.
export type WelcomeVariant = "purchase-complete" | "purchase-confirming" | "first-open" | null;

export function welcomeVariant({
  purchaseToken,
  checkout,
  firstOpen,
  dismissed,
  onReference,
}: {
  // `?mp=` from a `?purchase=return` landing — null when this isn't one.
  purchaseToken: string | null;
  checkout: { state: "awaiting-payment" | "granted" } | null | undefined;
  firstOpen: boolean | null;
  dismissed: boolean;
  onReference: boolean;
}): WelcomeVariant {
  if (dismissed) return null;
  if (purchaseToken) {
    if (checkout === undefined) return null;
    // Deliberately not gated on `firstOpen` or `onReference`: a buyer who read the
    // free Preview before paying carries progress, and the acknowledgement is not
    // orientation — it's a receipt.
    if (checkout) return checkout.state === "granted" ? "purchase-complete" : "purchase-confirming";
  }
  if (onReference) return null;
  return firstOpen === true ? "first-open" : null;
}
