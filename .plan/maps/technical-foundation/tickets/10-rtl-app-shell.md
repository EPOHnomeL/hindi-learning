---
type: task
blocked_by: [09]
---

# Build: flip the app shell to RTL for an RTL locale

## Question

Execute [01](09-chrome-rtl-strategy.md)'s strategy. Nothing here is a decision — if a decision
turns up mid-build, it belongs back in 01's `## Answer`, not invented here.

Expected shape (01 confirms or replaces it):

- `src/app/layout.tsx` — set `dir` from the locale instead of the hardcoded LTR, and **fix the
  stale comment** on the same line ("`dir` stays ltr — RTL is out of scope" stops being true the
  moment this lands). Swap the body font on for the Urdu script the way `isDevanagari(locale)`
  swaps in Noto Devanagari.
- Apply 01's fix pattern to the offenders it inventoried — physical margins/padding to logical
  utilities, `left`/`right` positioning, `text-left`, any `translateX`.
- Apply 01's icon-mirroring rule to the directional icons only.
- The lesson iframe keeps its **own** per-Edition `dir` (`lessonSrcDoc.ts:359`): confirm that RTL
  chrome around an LTR lesson, and LTR chrome around an RTL (Urdu/Hebrew/Arabic Edition) lesson,
  both render correctly. That cross-pair is the regression most likely to be missed.
- Keep a **pure seam** for "is this locale RTL" so the behaviour is unit-testable without a
  browser — the same reason `resolveTenantSlug` and `landingFor` were kept pure.

Verification must be honest per CLAUDE.md: say whether it was read, unit-tested, or actually
walked in a browser, and per 01's acceptance path say who looked at the Urdu.

## Done when

With the app-language set to Urdu, the learner surfaces in scope (reader, dashboard, catalogue,
auth) render right-to-left with correct alignment, correctly-mirrored directional icons and no
overlapping or clipped chrome; an LTR locale is **visually unchanged**; the RTL-locale predicate
has a unit test; and `pnpm test` is green.

<!-- Moved 2026-09-01 from `urdu-chrome-locale/03` into the technical-foundation map, which groups this repo’s scalability, refactoring and code-architecture work. Renumbered to 10 because `blocked_by` is map-local and the old numbers collided. Inbound links across `.plan/` were repointed in the same commit. -->
