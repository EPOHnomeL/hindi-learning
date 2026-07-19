# Reference card deep-links + share — PRD

**Status:** scoped (grilled 2026-07-19), ready to break into build issues
**Domain:** [[Reference]], [[Lesson]], [[Topic]], [[Viewer]], [[Guest]], [[Edition]], [[Preview]] (CONTEXT.md)
**Relation to rich-media:** distinct from rich-media/10's deferred *Resource* fragment anchors
(`#page=` PDF / `#t=` video). This is **intra-Reference** anchoring (HTML cards), a different
mechanism, so it lives in its own feature dir.

## Problem

Two gaps, both about the glossary/cheat-sheet [[Reference]]s a learner returns to:

1. **A lesson can only link to a *whole* Reference.** When a Lesson mentions a glossary term, a
   cross-link (`/courses/<slug>/references/<key>`) drops the reader at the top of the reference;
   they must hunt for the entry themselves. There's no way to land on the exact **card** (term).
2. **Nothing markets the course from inside it.** A learner reading a crisp definition has no way
   to share it. A shared definition — term + meaning + a link back — is free, on-brand marketing
   for the course, but the product offers no affordance for it.

## Solution

Give each glossary/reference **card** (the existing `.term` element) a stable anchor id, then:

1. **Deep-link to the card.** A Lesson links `…/references/<key>#<cardId>`; opening it scrolls the
   card into view and flashes a brief highlight so the eye finds it.
2. **Share the card.** Each card gets a hover-revealed share icon that copies a branded snippet
   (term + definition + a link to the course's public page) and, on mobile, opens the native
   share sheet — straight to WhatsApp/IG status. The link markets the course.

**New courses only.** The anchor ids come from the teach skill at authoring time; existing
References without ids degrade gracefully (no anchors, no share icons). Retrofitting old
References is a **separate backfill ticket** ([issues/04](issues/04-backfill-existing-references.md)).

## Decisions (from grilling, 2026-07-19)

| # | Decision |
|---|----------|
| 1 | **Scope = Reference entries only.** A "card" is one `.term` glossary/cheat-sheet entry. No "course-map" surface; whole-artifact cross-links already exist. |
| 2 | **Authoring-time stable id.** The teach skill emits a stable slug `id` on each `.term` (from the source term). Language-stable — translations keep the same id, exactly like Resource-link ids. Render-time slugging rejected (breaks on localised term text). |
| 3 | **Landing = scroll + brief highlight.** Scroll the card into view and flash a ~1.5s fading tint/outline. |
| 4 | **New courses only; backfill deferred.** Existing References without ids get no anchors/share (graceful). Backfill = separate ticket. |
| 5 | **Share payload = formatted text + link, + native share sheet.** Copies term + definition + branded CTA + public link; invokes Web Share on mobile. Image/story-card generation deferred. |
| 6 | **Share link target = the course's public page** (`/share/<publicToken>`, tenant-domain, whitelabel-aware). Not a per-card public URL. |
| 7 | **Gating = show share only when the course has a public link** (publicly shared / marketplace), to owner, [[Viewer]], and [[Guest]] alike. No auto-publish of a private course. |
| 8 | **Affordance = per-card hover share icon** (mirrors the edit pencil). Click → parent does clipboard + Web Share + "Copied" toast. The sandboxed iframe only posts the intent out. |
| 9 | **Snippet format:** `📖 <Term>` / `<definition>` / `Learn <Course> on <Brand> →` / `<link>`. |

## Mechanism (grounded in the current code)

- **Card = `.term` or `.word`.** The reference design system
  ([reference-head.html](../../lessons/_partials/reference-head.html)) renders each glossary entry
  as a `.term` card (`.name` + `.def` + `.avoid`) or a compact `.word` row (`.w` headword + `.g`
  gloss). We add **only** `id="<slug>"` to each entry — `.def` already exists; no new wrapper. The
  reader selects entries as `.term[id], .word[id]`.
- **Hash already flows through navigation.** `resolveArtifactClick` → `internalNavTarget`
  preserves `url.hash` on a cross-link and through the Guest `/share/<token>` rewrite
  ([readerDerive.ts](../../src/app/_components/readerDerive.ts#L68), and the Frame handler at
  [ArtifactView.tsx:231](../../src/app/_components/ArtifactView.tsx#L231)).
- **In-reference anchor clicks already scroll.** NAV_BRIDGE returns early on `#` hrefs so a
  same-frame anchor click scrolls natively ([lessonSrcDoc.ts:85](../../src/app/_components/lessonSrcDoc.ts#L85)).
  The new work is only **cross-artifact** landing: the parent URL hash must reach the iframe.
- **New reference bridge.** References render with `withBridge={false}` today (that's the *quiz*
  bridge). Add a small **reference bridge** injected by `buildSrcDoc` for references that:
  (a) on load, scrolls to a baked target anchor and flashes the highlight; (b) listens for a
  `scrollToCard` postMessage for a same-page hash change (no reload); (c) injects a share icon
  into each `.term` and posts `{type:'shareCard', term, definition}` to the parent on click.
- **Parent composes the snippet.** The iframe knows nothing about brand/course/link. `Frame`
  receives the `shareCard` intent, composes the tenant-aware snippet (course title from
  `header`, brand from tenant context, public link from the course's `publicToken`), runs
  `navigator.clipboard` + `navigator.share`, and shows a toast. Gated: no share icons injected
  when the course has no public link.

## Out of scope

- **Backfill of existing References** — separate ticket (04).
- **Image / story-card generation** for status — deferred (bigger build: canvas / server render).
- **Per-card *public* deep-link** — the share link targets the course's public page, not the card.
- **"Course map" surface** — not a real object; whole-artifact links already exist.
- **Resource fragment anchors** (`#page=`, `#t=`) — rich-media/10, different mechanism.

## Issues

1. [01 — Card anchor contract](issues/01-card-anchor-contract.md): stable `.term` ids + `.def`
   markup; GLOSSARY-FORMAT / AUTHORING / skill updates so new glossaries emit anchorable cards.
2. [02 — Deep-link landing](issues/02-deeplink-landing.md): reference bridge scroll-to-card +
   highlight (cross-artifact + same-page); lesson authoring guidance to link `#<cardId>`.
3. [03 — Card share button](issues/03-card-share-button.md): per-card hover share icon, intent
   bridge, parent-composed branded snippet, clipboard + Web Share + toast, public-link gating.
4. [04 — Backfill existing References](issues/04-backfill-existing-references.md): **deferred** —
   retrofit ids into old References.
</content>
</invoke>
