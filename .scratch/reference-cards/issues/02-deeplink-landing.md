# reference-cards/02: Deep-link landing — scroll to card + highlight

**Status:** resolved (2026-07-19)
**Labels:** ready-for-agent
**Depends on:** [01 — card anchor contract](01-card-anchor-contract.md)
**Domain:** [[Reference]], [[Lesson]], [[Viewer]], [[Guest]] (CONTEXT.md)

## Resolution (2026-07-19)

- `lessonSrcDoc.ts`: new `REFERENCE_BRIDGE` (listens for a `scrollToCard` message →
  `scrollIntoView` + `.card-flash`) + `REFERENCE_FLASH_CSS` (theme-aware ~1.7s fade) +
  `scrollToCardMessage()`; `buildSrcDoc` gains a `reference` opt that injects both. Target is
  **not** baked → no reload on a same-reference card change.
- `ArtifactView.tsx`: `Frame` gains `reference` + `cardTarget`; posts `scrollToCard` on iframe
  `onLoad` (fresh cross-artifact nav, + a 350ms reflow-safety re-post) and via an effect on
  `cardTarget` change (same-doc hash change). `ReferenceView` reads the URL hash
  (`cardIdFromHash` + a `hashchange` listener) and passes `reference cardTarget`.
- `readerDerive.ts`: pure `cardIdFromHash(hash)` (strip `#`, decode, null on empty) — unit-tested.
- `AUTHORING.md` §5 (both trees): link a single card with `…/references/<key>#<cardId>`, copying
  the entry's existing `id` (don't recompute).
- Tests: `cardIdFromHash` cases + a hash-preservation regression on `resolveArtifactClick` /
  `internalNavTarget`. `tsc` clean; 51 tests green; authoring bundle regenerated.
- **Guest path:** the `hashchange` reader was extracted to a shared `useCardTarget(refKey)` hook
  (exported from `ArtifactView`) and applied to **both** the authed `ReferenceView` and the Guest
  `PublicReferencePane` (`PublicReader.tsx`), so a Guest `/share/<token>/references/<key>#<card>`
  link lands scrolled too. (The hook extraction landed with the 03 work, which needed the same
  seam.)
- **Not unit-testable:** the actual iframe scroll/flash — verify by driving the reader (`verify`
  skill): open a lesson card link and a Guest `/share/<token>` card link, confirm scroll + flash.

## Problem

A Lesson can link to a whole [[Reference]] but drops the reader at the top. With cards now
carrying stable ids (01), a Lesson should link `…/references/<key>#<cardId>` and land the reader
**on that card**, scrolled into view and briefly highlighted. Same-frame `#` clicks already scroll
(NAV_BRIDGE lets them through), but a **cross-artifact** link — Lesson → Reference — navigates the
parent app; the parent's URL hash never reaches the sandboxed iframe, so the card isn't scrolled to.

## Solution

Add a **reference bridge** (injected by `buildSrcDoc` for references) that scrolls to a target
card and flashes a ~1.5s fading highlight, driven two ways:

1. **On load** — the target anchor is baked into the srcDoc from the parent URL hash, so a fresh
   navigation lands scrolled + highlighted.
2. **On same-page hash change** — when the reader is already on that reference and a new `#<cardId>`
   arrives (another deep-link, no reload), the parent posts a `scrollToCard` message the bridge
   handles without a reload.

Update lesson authoring guidance so the skill links to a card with `#<cardId>` when a claim maps to
a glossary term.

## Implementation Decisions

- **Hash already survives routing.** `resolveArtifactClick`/`internalNavTarget` preserve `url.hash`
  on a cross-link and through the Guest `/share/<token>` rewrite; the Frame handler already appends
  `url.hash` on `router.push` ([ArtifactView.tsx:231](../../../src/app/_components/ArtifactView.tsx#L231)).
  No change to the resolver.
- **Reference bridge, not the quiz bridge.** References render `withBridge={false}` (that's the
  quiz bridge). Add a distinct reference bridge in
  [lessonSrcDoc.ts](../../../src/app/_components/lessonSrcDoc.ts) injected for references. Keep it
  separate from HEIGHT/NAV/THEME bridges (one concern each).
- **Thread the target hash in.** `ReferenceView` reads `window.location.hash` and passes it to
  `Frame`; `Frame`/`buildSrcDoc` bake the initial target and, on a subsequent hash change with the
  same srcDoc, post `scrollToCard`. Match the existing postMessage shape (`__lesson: true`).
- **Highlight.** Bridge adds a class to the target `.term` that animates a tinted outline/background
  fading over ~1.5s, then removes it. Theme-aware (works in the reference dark palette).
- **Graceful no-op.** Unknown/absent id (old reference, deleted term, freeform reference) → no
  scroll, no error, no console noise.
- **Height interplay.** Scrolling must happen after layout/height settle (references measure height
  for the mobile single-scroll surface) — scroll on load *and* after the height report, so a late
  reflow doesn't strand the card off-screen.

## Testing Decisions

- **Pure resolver (regression).** Assert `resolveArtifactClick`/`internalNavTarget` still preserve
  the hash on a `references/<key>#<id>` cross-link and through the `/share/<token>` rewrite — prior
  art in [readerDerive.test.ts](../../../src/app/_components/readerDerive.test.ts).
- **Bridge behaviour** is DOM/iframe-level; cover what's factorable purely (e.g. the slug/anchor
  parse, the "does this hash target an existing card id" decision) and verify scroll+highlight by
  driving the reader per the repo's `verify` skill (not a unit test of iframe internals).
- **Skill guidance** — a worked example in AUTHORING showing a Lesson linking `#<cardId>`.

## Out of Scope

- The share button (03).
- Card ids themselves (01).
- Backfill (04).
</content>
