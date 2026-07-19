# rich-media/11: Resource links — spec

**Status:** open
**Labels:** ready-for-agent
**Scopes from:** [10 — AI linking into course Resources](10-scope-resource-deep-linking.md)
**Domain:** [[Resource link]], [[Resource]], [[Lesson]], [[Viewer]], [[Guest]], [[Edition]], [[Preview]] (CONTEXT.md)

## Problem Statement

When Claude Code teaches, it grounds every [[Lesson]] in the [[Topic]]'s own uploaded
[[Resource]]s — the handbook, the scripture, the primary sources the learner actually trusts.
But today a Lesson can only *cite external URLs*. The learner's own Resources are reachable
only as whole files from the reader's sidebar, disconnected from the prose that draws on them.
A learner reading "the perfective is formed by…" has no way to jump from that sentence to the
Handbook it came from; they must remember which Resource, open the sidebar, and find it
themselves. The teacher can point at the whole world but not at the sources sitting right there
in the course.

## Solution

Let Claude Code write **[[Resource link]]s** directly into Lesson prose — an inline citation
whose target is one of the Topic's own Resources. A Lesson can say "see the Handbook" as a
link, and clicking it opens that Resource exactly as the sidebar does (a new tab for a PDF or
external URL, an in-app dialog for Markdown). The link is durable: it survives in immutable
Lesson HTML and across translation because it addresses the Resource by its stable id and the
reader mints a fresh signed URL at click time — never a baked-in expiring URL. Whole-resource
only in this cut: the link opens the Resource and the learner browses it; no page or timestamp
precision.

## User Stories

1. As a learner reading a Lesson, I want a claim's source to be a clickable link to the actual
   Resource it came from, so that I can verify it without hunting through the sidebar.
2. As a learner, I want clicking a Resource link to open the source the same way the sidebar
   does, so that the behaviour is familiar and predictable.
3. As a learner, I want a link to a PDF/external Resource to open in a new tab, so that I keep
   my place in the Lesson.
4. As a learner, I want a link to a Markdown Resource to open in the styled in-app dialog, so
   that I read it comfortably rather than as a wall of raw text.
5. As Claude Code authoring a Lesson, I want each Resource's stable link handed to me in the
   workspace, so that I can cite an owned Resource without guessing or fabricating a URL.
6. As Claude Code, I want to copy a ready-made reader path verbatim, so that I never malform an
   opaque Resource id.
7. As Claude Code, I want guidance to cite the **owned Resource** in preference to an external
   URL whenever a claim is grounded in one, so that citations point at the true, trusted source.
8. As Claude Code, I want Resource links to reuse the existing `.cite` citation convention, so
   that I introduce no new markup and the Lesson stays visually consistent.
9. As a [[Viewer]] on a shared Topic, I want Resource links to work, so that I get the same
   grounded reading experience as the owner.
10. As a [[Guest]] on a free public Topic, I want Resource links to work without an account, so
    that a shared course reads as a complete, self-contained thing.
11. As a Guest on a paid [[Edition]]'s [[Preview]], I want a Resource link to a withheld
    Resource to do nothing rather than error, so that the Preview never breaks or leaks paid
    material.
12. As a learner, I want a link to a since-deleted Resource to fail silently, so that an old
    Lesson never throws or dead-ends me.
13. As a learner reading a translated Edition, I want Resource links to keep working with the
    link text translated, so that grounding survives in my language.
14. As a Topic owner, I want the same Resource id to resolve across every Edition, so that a
    translated Lesson points at the same source as the original.
15. As a learner, I want the Lesson prose to still read sensibly even when a link is inert (e.g.
    "see the Handbook" as plain text), so that a dead link never garbles the sentence.
16. As a developer, I want the click-resolution logic to live in one pure, tested function, so
    that Resource-vs-navigate behaviour is verifiable without rendering React.
17. As a developer, I want the sidebar and the in-Lesson link to share one open-behaviour
    decision, so that "sidebar parity" is guaranteed rather than reimplemented and drifting.

## Implementation Decisions

- **Addressing.** A Resource link is `<a href="/courses/<slug>/resources/<id>">…</a>` — the same
  `/courses/<slug>/…` shape used for [[Lesson]]/[[Reference]] cross-links. It addresses the
  Resource by **id** (stable, unique, already the key the reader's in-bundle Resource list uses),
  never by filename (not guaranteed unique or stable) and never by a signed blob URL (expires;
  Lessons are immutable).
- **Click resolution — one pure seam.** Extend the existing pure link-resolver
  (`internalNavTarget`) so an internal artifact-link click resolves to a **discriminated action**
  rather than a bare path: `navigate` (a path, for lesson/reference targets, with the existing
  Guest `/share/<token>` rewrite) or `resource` (a Resource id, for `resources/<id>` targets), or
  pass-through. The Lesson-body click handler dispatches: `navigate` → router; `resource` → look
  up the id in the reader's in-bundle Resource list and open it.
- **Open behaviour — shared helper.** Extract the "new tab vs Markdown dialog" decision currently
  inline in `ResourceItem` into one pure helper (e.g. `resourceOpenMode(filename, kind)`) used by
  **both** the sidebar and the interceptor, so sidebar parity is a single source of truth.
- **Graceful no-op.** If the resolved Resource id is not present in the reader's in-bundle list
  (withheld on a paid Preview, or a since-deleted Resource), the click does nothing — no
  navigation, no thrown error, no console noise. No publish-time link stripping.
- **Authoring knowledge.** `materialiseTopic` exposes each Resource's `id`. The materialise step
  writes both `id` and a precomputed `readerPath` (`/courses/<slug>/resources/<id>`) into each
  entry of the workspace `resources/_index.json`, so Claude Code copies the path verbatim.
- **No backend read-seam changes.** The owner/[[Viewer]] seam (`listResources`) and the [[Guest]]
  seam (`publicEdition`) **already** return every Resource with a freshly-signed url in the
  reactive bundle. The reader resolves links against data it already holds. `public.ts`,
  `resources.ts`, and the `/content` route are untouched.
- **Access forks by Edition, unchanged.** On a **free** Edition a Guest receives Resource urls
  (links resolve). On a **paid** Edition the Guest Preview withholds Resources by design; a link
  there resolves to a missing id → no-op. This rides the existing withhold-list; no new gating.
- **Translation.** No code change. The translate `html` pass already preserves every tag and
  attribute exactly, so the href is untouched (only the link text is translated). Resources are
  Topic-scoped, so the same id resolves across all Editions.
- **Skill guidance.** `AUTHORING.md` §5 gains the Resource reader route beside the
  lesson/reference routes; §6 steers grounding citations to the owned Resource's `readerPath`
  when a claim came from a Resource. `SKILL.md` §Knowledge is updated to cite the owned Resource
  in preference to an external URL when grounded in one. Both the `.claude/skills/teach/` and
  `.agents/skills/teach/` trees are updated (kept in sync).

## Testing Decisions

- **Test external behaviour, not implementation.** Assert what a click *resolves to* and what the
  workspace *contains* — not internal wiring or DOM structure.
- **Primary seam — the pure click resolver** (in `readerDerive.ts`). Cover: a `resources/<id>`
  href resolves to a `resource` action carrying the id; a lesson/reference href still resolves to
  a `navigate` action (authed path and Guest `/share/<token>` rewrite both preserved); a
  non-artifact/external href passes through. This is the same pure, edge-runtime,
  no-React/no-DOM style as the existing `internalNavTarget`, `nextLessonKey`, `completedKeys`
  tests in that file — direct prior art.
- **Shared open-behaviour helper.** Unit-test `resourceOpenMode`: a `.md`/`.markdown` file →
  dialog; a PDF or `kind: "url"` → tab. Prior art: the derivation tests co-located with the
  functions they cover.
- **Backend — `materialiseTopic`.** Assert the query returns `id` per Resource, in the same style
  as the existing `routine.test.ts` materialise assertions.
- **Graceful no-op.** Covered at the resolver/handler level: a resource action whose id is absent
  from a supplied in-bundle set yields no action.
- **Translation regression.** A `buildTranslateMessages`/`html`-mode assertion (prior art in
  `translate.ts`'s existing tests) that a Resource-link href round-trips unchanged.

## Out of Scope

- **Fragment anchors** — `#page=N` (PDF) and `#t=start,end` (video). Whole-resource links only.
  Video-timestamp deep-links are deferred to ride on ticket 04 (transcript ingestion).
- **Embedding Resource *content* inside a Lesson** (rich-media/02) — this is linking, not
  embedding.
- **A dedicated in-reader Resource view / rendered route** — sidebar parity (new tab / dialog) is
  the whole interaction.
- Any change to `public.ts`, `resources.ts`, the `/content` route, or the translate logic itself.
- Transcript ingestion (04) and video-anchored teach mode (07).

## Further Notes

- Resource ids are **already public** — the Guest bundle exposes `id: v.id("resources")` — so
  baking them into immutable Lesson HTML exposes nothing new.
- This spec corrects the original scoping ticket's assumption that the Guest read seam didn't
  cover Resources: `publicEdition` already returns them with signed urls on a free Edition, which
  is why no Guest-seam work is needed.
- The mechanical surface is small (one materialise field + one interceptor branch + a shared
  helper); the substantive change — the actual intent behind "allow the teacher skill to link
  directly to resources" — is the `SKILL.md`/`AUTHORING.md` guidance that makes Claude Code
  reach for owned Resources when it cites.
