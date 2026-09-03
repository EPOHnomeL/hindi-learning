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

## Answer

Built 2026-09-03 in `7b3205b`, executing [09](09-chrome-rtl-strategy.md)'s
strategy. No decision turned up mid-build that 09 had not already closed.

### What landed

- `src/app/layout.tsx`: `dir={langDir(locale)}` on `<html>`, and the stale
  "`dir` stays ltr, RTL is out of scope" comment replaced rather than left to
  mislead the next reader. `Noto_Naskh_Arabic` is loaded beside the Devanagari
  face and applied by `isRtl(locale)` on `<body>`, with the escape-hatch comment
  rewritten to describe both hatches instead of one.
- `src/styles/globals.css`: `--font-naskh` and `.font-naskh`, mirroring the
  Devanagari pair exactly.
- The logical-utility sweep across 26 learner-facing files, per 09's inventory.
- The two cases logical utilities cannot express: the toggle knobs now pair
  `ltr:`/`rtl:` translate variants, and the reader's back arrow carries
  `rtl:-scale-x-100`.
- The pure seam is `langDir`, which already existed. Unit-tested from the chrome
  side in `src/i18n/config.test.ts`: the exact direction of all six offered
  locales, plus a guard that none is ever undefined.

### Verification, and what it does and does not establish

`pnpm typecheck` clean; `pnpm vitest run` green at 84 files / 1029 tests (1024
before, the five new ones being the direction and Accept-Language pins).

**Walked in a browser**, on a dev server on port 3100 (port 3000 belongs to an
unrelated app and was left running):

- Landing page in Urdu renders right-to-left in Naskh: brand on the right,
  sign-in and theme toggle on the left, headline right-aligned, and the primary
  CTA rightmost of the pair. Nothing clipped or overlapping at 1280px.
- `getComputedStyle` on the legal prose confirms the sweep does what it claims:
  under `ur` the list indent is `padding-right: 24px, padding-left: 0`, and
  under `en` it is back to `padding-left: 24px, padding-right: 0`.
- `<body>`'s resolved `font-family` is `Noto Naskh Arabic` under `ur`,
  `Spectral` under `en`, and the Hindi locale still gets `font-deva`, so neither
  existing locale regressed.
- SSR was checked per locale: `en` gives `lang="en" dir="ltr"` with no body
  class, `hi` gives `dir="ltr"` with `font-deva`, `ur` gives `dir="rtl"` with
  `font-naskh`.

**Not established, and deliberately not claimed:**

- **The signed-in surfaces were not walked**: dashboard, reader, manage tabs and
  the mobile bottom tab bar all need auth, and this session had no credentials.
  Their utilities were swept and typecheck passes, but that is "read and
  compiled", not "seen".
- **The two cross-pairs from 09 section 1 were not walked either.** The dev
  deployment the app reads (`judicious-marmot-580`) has **no rows in
  `publicLinks` at all**, so no Guest reader is reachable locally. The Urdu link
  that does exist lives on the **prod** deployment
  (`capable-barracuda-769`), which the `CONVEX_DEPLOY_KEY` in `.env.local` points
  the CLI at, and reaching into prod to test is not something this session did.
  Worth writing down because it cost an hour: `pnpm dlx convex data`/`run` answer
  from **prod** here while the app answers from **dev**, so a token listed by the
  CLI will not resolve in the running app, and the resulting "Urdu link opens in
  English chrome" looks exactly like a bug in the share-locale override. It is
  not one. `publicEditionLang` returns `ur` for that token on prod, and
  `offeredLocale("ur")` is now truthy, which is the single line that gated it.
- **Nobody who reads Urdu has looked at the strings.** Per 09's acceptance split
  that is not this ticket's claim to make.

The honest summary: the direction mechanism, the font swap and the sweep are
verified by browser on the public surfaces and by unit test on the seam; the
authed surfaces and the cross-pairs are verified by reading only, and want a
pass by someone who can sign in.
