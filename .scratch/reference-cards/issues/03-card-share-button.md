# reference-cards/03: Card share button — copy branded snippet + native share

**Status:** resolved (2026-07-19)
**Labels:** ready-for-agent
**Depends on:** [01 — card anchor contract](01-card-anchor-contract.md)
**Domain:** [[Reference]], [[Topic]], [[Viewer]], [[Guest]], [[Edition]] (CONTEXT.md)

## Resolution (2026-07-19)

- `lessonSrcDoc.ts`: the reference bridge is now `referenceBridge(share)`; when `share`, it injects a
  hover share `<button>` into each `.term[id] / .word[id]`, reads term/definition by shape, and posts
  a `shareCard` intent. `REFERENCE_CARD_CSS` adds the hover-revealed `.card-share` affordance
  (faintly persistent on touch). `buildSrcDoc` gains `refShare` (implies `reference`).
- `readerDerive.ts`: pure `composeCardShare()` builds the branded snippet (📖 term / definition /
  `Learn <Course> on <Brand> →` / link), collapsing the raw textContent whitespace — unit-tested.
- `ArtifactView.tsx` `Frame`: `share?: {courseTitle, url}` prop; `shareable` (boolean) drives srcDoc
  so the object changing never reloads the iframe. A `shareCard` handler composes the snippet (brand
  from `useTenant().displayName`) and runs `navigator.share` (mobile → status) else clipboard + a
  "Copied" toast; a cancelled share sheet (`AbortError`) does NOT fall back to copy.
- `editionUrl.ts`: shared `publicCourseUrl(shareToken, tenantSlug)` (canonical-host `/share/<token>`);
  `Certificate.tsx` refactored to reuse it (removes its private copy — no drift).
- **Authed reader** (`ReferenceView`): `share` from new `courseHeader.publicLink`. **Guest reader**
  (`PublicReferencePane`): `share` from the current token's `/share/<token>` page. Both hidden when
  there's no public link.
- Backend: `courseHeader` returns `publicLink: {shareToken, tenantSlug} | null` from `topic.publicToken`
  (ADR 0013), mirroring the certificate. Tested (private → null; shared → link).
- `tsc` clean; **517 tests green** (added `composeCardShare` + `courseHeader.publicLink` cases; fixed
  the exact-shape assertion in `sharing-readonly.test.ts`).
- **Not unit-testable:** the injected button + clipboard/share/toast — verify by driving the reader
  (`verify` skill): hover a glossary card, confirm the icon, copy, and toast; check it's hidden on a
  private course.

## Problem

A learner reading a crisp definition has no way to share it. A shared term + definition + a link
back to the course is free, on-brand marketing — but the product offers no affordance. Cards render
inside a sandboxed `allow-scripts` iframe, so clipboard/Web Share can't run there; and a shared link
only markets anything if it points somewhere a stranger can open.

## Solution

Give each card a **hover-revealed share icon** (mirroring the edit pencil). Clicking it posts a
`shareCard` intent to the parent, which composes a tenant-aware snippet and runs clipboard + the
native share sheet, then shows a "Copied" toast. The icon is only injected when the course has a
**public link** (publicly shared / marketplace), so it never produces a dead-end URL.

Snippet:
```
📖 Perfective aspect
An action viewed as a complete whole, not its internal unfolding.

Learn Hindi on Y-Knot →
https://<tenant-domain>/share/<publicToken>
```

## User Stories

1. As a learner, I want to share a single definition to my status with one tap, so my friends see
   what I'm learning.
2. As a learner, I want the shared post to carry a link to the course, so a friend can start it.
3. As the operator, I want the link + brand to reflect the tenant (whitelabel), so shares market
   the right storefront.
4. As a [[Guest]] on a public course, I want to share a card without an account, so a shared course
   spreads itself.
5. As an owner of a private/unshared course, I want **no** share icon, so I never hand out a link
   that dead-ends for the recipient.

## Implementation Decisions

- **Injection, gated.** The reference bridge injects a share `<button>` into each entry
  (`.term[id], .word[id]`) **only when the parent tells it the course has a public link.** Pass a
  `shareable` flag (+ nothing else secret) into `buildSrcDoc`/the bridge. No flag → no icons (also
  covers old references with no ids to hang them on).
- **Intent out, composition in the parent.** On click the bridge reads the card's term + definition
  by shape (`.term` → `.name`/`.def`; `.word` → `.w`/`.tr` + `.g`) and posts
  `{__lesson:true, type:'shareCard', term, definition}`. The
  iframe knows nothing about brand/course/link. `Frame` (or `ReferenceView`) composes the snippet
  from: course title (`header.title`), brand name (tenant context), and the public link.
- **Public link source.** Guests already hold the token in-URL (`/share/<token>`). The authed
  reader needs the course's `publicToken` — reuse the query behind the existing course-level share
  UI ([Editions.tsx:337](../../../src/app/_components/Editions.tsx#L337) builds `origin/share/<token>`).
  `shareable = publicToken != null` (or on a marketplace Edition). Confirm the exact query during
  build.
- **Copy + share.** `navigator.clipboard.writeText(snippet)` always; additionally
  `navigator.share({ text, url })` when available (mobile) inside the click's user-activation.
  Fall back to clipboard-only where `share` is absent. Toast on success.
- **Whitelabel.** Brand name from `useTenant()`; the link uses `window.location.origin`, already the
  tenant domain — so no hardcoded brand/host.
- **Affordance.** Small corner icon on each `.term`, hover-revealed on desktop / faintly persistent
  on mobile, styled like the edit pencil. Must not overlap the deep-link highlight (02).

## Testing Decisions

- **Snippet composition** — factor the "compose snippet from term/definition/course/brand/link"
  into a pure function and unit-test it (format, trimming, the `Learn <Course> on <Brand>` line,
  link append). Prior art: co-located pure-derivation tests.
- **Gating** — `shareable` false → bridge injects no icons; assert at the factorable seam.
- **End-to-end** clipboard/share/toast verified by driving the reader (repo `verify` skill), not a
  unit test of iframe internals.

## Out of Scope

- Image / story-card generation (deferred).
- A per-card *public* deep-link (share targets the course's public page).
- Deep-link landing (02) and card ids (01).
- Auto-enabling a public link (never publish a private course on share).
</content>
