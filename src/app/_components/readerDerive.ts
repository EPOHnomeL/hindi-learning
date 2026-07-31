// Pure derivations behind the Reader's sidebar and the course-index redirect.
// Extracted from the old monolithic Reader so the course layout, the sidebar,
// and the `/courses/[slug]` redirect can share one tested source of truth
// (ADR 0012). No React, no DOM — runs in the edge-runtime test environment.

type LessonLite = { key: string; seq: number; title: string };
type ProgressLite = { lessonKey: string; status: "opened" | "completed" };
type QuestionLite = { id: string; lessonKey: string; reply: string | null };

// The course-index redirect target: the first lesson. `listLessons` is
// seq-ascending and already drops superseded lessons, so the head is the start.
export function firstLessonKey(lessons: readonly LessonLite[]): string | null {
  return lessons[0]?.key ?? null;
}

// The course-index redirect URL: the resolved lesson path carrying the CURRENT
// query string through — dropping `purchase`/`mp` here would silently kill the
// payment-return banner (auth-first checkout). `lang` is replaced by the
// resolved Edition. An explicit "en" is KEPT (only null drops the param): an
// explicit lang pins the served Edition, and stripping "en" once let the
// resolver fall back from the paid English Edition to a free published one —
// the buyer lost the paygate entirely (see editionUrl.ts).
export function courseIndexRedirect(path: string, search: string, lang: string | null): string {
  const params = new URLSearchParams(search);
  params.delete("lang");
  if (lang) params.set("lang", lang);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

// The Frontier: the highest-seq (last) lesson — the learner's leading edge.
// `isFrontier` styling and the "fire the next lesson" offer hang off this.
export function frontierKey(lessons: readonly LessonLite[]): string | null {
  return lessons[lessons.length - 1]?.key ?? null;
}

// The lesson immediately after `currentKey` in seq order, or null when the
// current key is the last (Frontier) or isn't found. `listLessons` is
// seq-ascending, so "next" is simply the following array entry. Powers the
// reader's "Next lesson →" navigation for read-only Viewers and Guests.
export function nextLessonKey(lessons: readonly LessonLite[], currentKey: string): string | null {
  const i = lessons.findIndex((l) => l.key === currentKey);
  if (i < 0 || i + 1 >= lessons.length) return null;
  return lessons[i + 1]!.key;
}

// The course-index resume target (open-to-last-completed): the lesson *after*
// the learner's last completed one — resume where they left off — for everyone,
// owner and Viewer alike. "Last completed" is the highest-seq lesson marked
// completed; `listLessons` is seq-ascending, so the last such entry wins. When
// they've completed the final lesson there's no successor, so land on it; when
// nothing is completed yet, start at lesson 1. Completed keys not among the
// current lessons (a superseded or other-edition key) are ignored.
export function resumeLessonKey(
  lessons: readonly LessonLite[],
  progress: readonly ProgressLite[],
): string | null {
  const done = completedKeys(progress);
  let lastDoneKey: string | null = null;
  for (const l of lessons) if (done.has(l.key)) lastDoneKey = l.key;
  if (!lastDoneKey) return firstLessonKey(lessons);
  return nextLessonKey(lessons, lastDoneKey) ?? lastDoneKey;
}

// The lessonKeys the learner has completed, for the sidebar's ✓ ticks. "opened"
// is progress without completion, so it does not count as done.
export function completedKeys(progress: readonly ProgressLite[]): Set<string> {
  return new Set(progress.filter((p) => p.status === "completed").map((p) => p.lessonKey));
}

// Lessons carrying a teacher Reply the learner hasn't seen yet → a sidebar dot.
// `seen` is the set of answered-Question ids already viewed (per-device).
export function unseenReplyKeys(
  questions: readonly QuestionLite[],
  seen: ReadonlySet<string>,
): Set<string> {
  const keys = new Set<string>();
  for (const q of questions) if (q.reply && !seen.has(q.id)) keys.add(q.lessonKey);
  return keys;
}

// Resolve an internal link clicked inside an artifact to the path the app should
// route to. Lessons author cross-links as the owner's `/courses/<slug>/…` routes
// (AUTHORING.md §5). A signed-in owner/viewer routes there directly; but a Guest
// on the public reader (`/share/<token>/…`) can't open `/courses/…`, so rewrite
// a `/courses/<slug>/(lessons|references)/<key>` target into the share context,
// preserving the artifact kind + key. Non-artifact or already-share paths pass
// through unchanged.
export function internalNavTarget(targetPath: string, currentPath: string): string {
  const share = currentPath.match(/^\/share\/([^/]+)/);
  if (!share) return targetPath;
  const m = targetPath.match(/^\/courses\/[^/]+\/(lessons|references)\/(.+)$/);
  return m ? `/share/${share[1]}/${m[1]}/${m[2]}` : targetPath;
}

// What a click on an internal artifact link resolves to. A lesson/reference
// cross-link is a `navigate` (SPA route, with the Guest share rewrite folded in);
// a Resource link (`/courses/<slug>/resources/<id>`, AUTHORING.md §5) is a
// `resource` carrying its id — opened against the reader's in-bundle Resource
// list rather than navigated, so the /share context never rewrites it (Resources
// are Topic-scoped, addressed by id). Only ever called for same-origin links.
export type ArtifactClick = { kind: "navigate"; path: string } | { kind: "resource"; id: string };

export function resolveArtifactClick(targetPath: string, currentPath: string): ArtifactClick {
  const res = targetPath.match(/^\/courses\/[^/]+\/resources\/(.+)$/);
  if (res) return { kind: "resource", id: res[1]! };
  return { kind: "navigate", path: internalNavTarget(targetPath, currentPath) };
}

// How a clicked Resource opens, matching the sidebar (ResourceItem): an uploaded
// Markdown file renders in the in-app dialog; everything else — a PDF, an image,
// an external URL — opens in a new tab. A `url` Resource is always a tab even if
// its address ends `.md`.
export function resourceOpenMode(filename: string, kind: "file" | "url"): "dialog" | "tab" {
  return kind === "file" && /\.(md|markdown)$/i.test(filename) ? "dialog" : "tab";
}

// What a clicked Resource link actually opens, resolved against the Resource list
// the reader already holds (freshly-signed urls, never a baked-in expiring one).
// Null is the graceful no-op (rich-media/11): the id isn't in the bundle because
// it's withheld on a paid Preview or the Resource was deleted, the reader holds no
// list yet, or the blob URL hasn't landed. Callers do nothing on null — no
// navigation, no error, no console noise.
type ResourceLite = { id: string; filename: string; kind: "file" | "url"; url: string | null };

export function resourceTarget(
  resources: readonly ResourceLite[] | undefined,
  id: string,
): { mode: "dialog" | "tab"; filename: string; url: string } | null {
  const r = resources?.find((x) => x.id === id);
  if (!r?.url) return null;
  return { mode: resourceOpenMode(r.filename, r.kind), filename: r.filename, url: r.url };
}

// The target glossary card id from a URL hash (reference-cards/02). A Lesson
// deep-links to a card as `…/references/<key>#<cardId>`; the reference reader
// forwards this id to the iframe bridge to scroll + flash it. Strips the leading
// `#`, decodes percent-encoding, and returns null for an empty/absent hash so the
// reader treats "no fragment" and "unknown card" alike (a graceful no-op).
export function cardIdFromHash(hash: string): string | null {
  const raw = hash.replace(/^#/, "").trim();
  if (!raw) return null;
  try {
    return decodeURIComponent(raw) || null;
  } catch {
    return raw || null;
  }
}

// The shareable snippet for a glossary card (reference-cards/03): the term + its
// definition, then a branded CTA line and the public course link. Composed in one
// pure place so the format is testable and identical for the clipboard copy and the
// native share sheet. `brand` is the tenant's display name; `url` the course's
// public `/share/<token>` page (publicCourseUrl). Whitespace in term/definition is
// collapsed (the iframe hands us raw textContent, which carries authored newlines).
export function composeCardShare(input: {
  term: string;
  definition: string;
  courseTitle: string;
  brand: string;
  url: string;
}): string {
  const term = input.term.replace(/\s+/g, " ").trim();
  const definition = input.definition.replace(/\s+/g, " ").trim();
  const head = definition ? `📖 ${term}\n${definition}` : `📖 ${term}`;
  return `${head}\n\nLearn ${input.courseTitle.trim()} on ${input.brand.trim()} →\n${input.url}`;
}

// Opening a lesson counts as seeing its teacher Replies. Returns the next `seen`
// set with that lesson's replied-Question ids added — or the *same* reference
// when there's nothing new, so a React state setter can skip a re-render.
export function seenAfterOpening(
  questions: readonly QuestionLite[],
  lessonKey: string,
  seen: ReadonlySet<string>,
): Set<string> {
  const ids = questions.filter((q) => q.lessonKey === lessonKey && q.reply).map((q) => q.id);
  if (ids.every((id) => seen.has(id))) return seen as Set<string>;
  const next = new Set(seen);
  for (const id of ids) next.add(id);
  return next;
}
