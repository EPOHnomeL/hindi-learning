# 05 — Read-seam paid/free fork + the Preview gate

Status: needs-triage

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (**Preview**, **Entitlement**, **Guest**, **Public link**, **Edition**). Spec: [`../PRD.md`](../PRD.md). Decision: [ADR 0016](../../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md).

> **Edition update:** the fork is per-**Edition** `(Topic, language)`. The
> course-translation feature already serves reads per Edition (owner, language-scoped
> Share, per-Edition Public link) and returns content in `lang`; this issue adds the
> paid branch on top of *its* seams — the Preview/locked gate for a caller who does not
> hold a paid Edition.

## Want

Wire the read seams to the Edition-aware `resolveEditionAccess` (issue 02) so a **paid**
Edition reveals only its **Preview** to callers who don't hold it, while **free**
Editions and all owner/Viewer/entitled reads are unchanged. This is the only new
read-fork.

## Acceptance

- **Authed reader** ([`convex/content.ts`](../../../convex/content.ts)) — `getLesson`
  / `getReference` / `listLessons` / `listReferences`, for the requested `lang`:
  - On a **free** Edition: unchanged (owner / language-scoped Viewer, plus the
    translation feature's Edition serving).
  - On a **paid** Edition: an **entitled** caller (and owner / language-scoped Viewer)
    reads everything in that language; any other signed-in caller gets **`preview`**
    access — the **Preview** Lesson's HTML (in `lang`) is returned, every other
    Lesson/Reference returns a **locked** marker (not `null`), and the ToC still lists
    titles so the UI can show what's behind the paygate.
- **Guest seam** ([`convex/public.ts`](../../../convex/public.ts)) — the per-Edition
  Public-link reads (`publicLinks`):
  - On a **free** Edition link: unchanged (full mirror in `lang`, ADR 0013 + translation).
  - On a **paid** Edition link: the course bundle still returns the **ToC** + `title`
    (in `lang`) as a teaser; the lesson read returns HTML **only** for the **Preview**
    key and a **locked** marker otherwise; references are locked. Keep the **explicit
    output allowlist** discipline — a Guest never receives paid HTML.
- **A `locked` shape** distinct from `null`: `null` still means "no such
  Topic/Lesson/Edition" (privacy-preserving for bad tokens); `locked` means "exists, buy
  to read" so the reader renders a paygate/buy affordance (PRD story 14), not a 404.
- **Buy affordance data**: the course header / public bundle expose the Edition's
  `price` + whether the caller is entitled to *this* Edition, so the reader knows to
  show "Buy" vs full content, per language.

## Depends on

- **02** (`resolveEditionAccess`, per-Edition price listing, Preview helper, entitled ≡
  language-scoped Viewer) and, through it, the **course-translation** feature's
  per-Edition read seams.
- Soft: **04** provides the checkout URL the buy affordance links to (the gate itself
  works without it — locked content just can't be unlocked yet).

## Notes

- Gate at these two seams **only** — do not re-check per React component (mirrors the
  internal-studio PRD's "gate at read time" rule). The reader trusts what the seam
  returns.
- The Preview must be readable by **everyone** on a paid Edition — including a
  signed-in user who hasn't bought — so the buy flow works whether or not they're
  logged in. That's why `preview` is a distinct level in `resolveEditionAccess`, not
  just "Guest".
- Tests mirror `public.test.ts` + `sharing-readonly.test.ts` + the course-translation
  per-Edition read tests: paid Edition → Preview HTML only (in `lang`) for Guest /
  unentitled-authed, full for entitled / owner / language-scoped Viewer; free Edition
  unchanged; an `es` entitlement does not unlock `ur`; `locked` vs `null` asserted; the
  Guest allowlist never leaks paid HTML.
