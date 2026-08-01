---
type: research
---
# Surface inventory and priority order

> `/wayfinder .plan/maps/ui-overhaul/tickets/04-surface-inventory.md`

## Question

Enumerate every surface the overhaul must cover — learner-facing (landing,
marketplace, course/lesson, quiz, progress, auth) and authoring/studio — from the
app's actual routes. For each: what it does, how hand-rolled its UI currently is,
and how it behaves at mobile widths. Rank them worst-first so tickets 02 (validation
target) and the per-surface fog have an order to graduate in.

## Done when

An inventory asset is committed under `assets/` and the Answer lists the surfaces
in priority order with a one-line justification each.

## Answer

**21 surfaces inventoried** — full detail in
[assets/surface-inventory.md](../assets/surface-inventory.md).

Three findings reshape this map:

1. **There is no design system.** The only shared primitives are `ui.tsx`
   (350 lines, 8 exports), used by ~6 of 21 surfaces. `src/design/tokens.ts` carries
   **colour only** — no spacing, radius or type scale, which is exactly why radii are
   typed by hand (`rounded-[10px]`, `rounded-[11px]`, `rounded-xl`, `rounded-2xl`)
   with no rule. The duplication is severe: **six** independent theme-toggle
   implementations, **seven** confirm-dialog implementations (one of them
   `window.confirm`), four near-identical course cards, and `PublicReader.tsx` (474
   lines) is a near line-for-line fork of `CourseShell.tsx` (591 lines).
2. **The lesson body is not React.** The highest-traffic surface renders LLM-authored
   HTML into a sandboxed iframe `srcDoc`, with four hand-written `<script>` string
   bridges (`HEIGHT_BRIDGE`, `QUIZ_BRIDGE`, `THEME_BRIDGE`, `NAV_BRIDGE`) talking over
   `postMessage`. **The quiz UI has no React surface at all** — it is
   `.quiz[data-correct]`/`.opt[data-k]` markup styled by CSS strings in
   `lessonSrcDoc.ts`, with click handlers attached by `querySelectorAll` and
   correctness normalisation duplicated in two places that a code comment admits must
   be kept in sync. No design system can reach inside that iframe.
3. **There is no PWA — verified directly.** `public/` holds only `favicon.ico`,
   `icon.svg` and a stray demo HTML file. No `manifest.json`, no service worker, no
   `next-pwa`, no `viewport`/`themeColor` export, no `apple-touch-icon`. This
   **contradicts the [pwa](../../pwa/map.md) map's Notes**, which state that its
   ticket 01 ("implement the website as a PWA") was closed on GitHub and that PWA
   groundwork is already done. Nothing shipped. That map's premise needs revisiting
   when it resumes — it is not this effort's to fix.

Mobile is thin almost everywhere: `md:` is used nearly exclusively, `sm:` in 6 files,
`lg:` in 4, `xl:` never. `SignIn`, `CourseSettings`, `SettingsDialog` and
`CoursePanes` have **zero** responsive classes. There is also a live breakpoint
conflict — the shell uses Tailwind `md` (768px) while the lesson iframe's CSS uses
`@media (min-width: 641px)`, so the two disagree between 641 and 768px.

**Priority order** (worst-first, weighing code smell × traffic × mobile weakness):

1. Lesson reader + quiz (`ArtifactView.tsx`, `lessonSrcDoc.ts`) — top traffic, quiz
   lives outside React
2. `/admin` sys-admin portal (`AdminPanel.tsx`) — 2255 lines, 46 components, zero i18n
3. Editions / publishing / selling (`Editions.tsx`) — 1274 lines in one `max-w-lg` modal
4. Paygate / checkout / EFT (`Paygate.tsx`) — the money path, `md:` ×2
5. Guest reader (`PublicReader.tsx`) — the fork; top-of-funnel for every share link
6. Dashboard / library (`Dashboard.tsx`) — 959 lines, four duplicated cards
7. Certificate (`Certificate.tsx` + ~400 lines of `globals.css`) — 55 one-off classes
8. Course shell (`CourseShell.tsx`) — best mobile work, must move with #5
9. Sign-in (`SignIn.tsx`) — zero responsive classes, `min-h-screen`
10. New course composer (`NewCourseCard`) — 190-line form inside a grid cell
11. In-place content editor (`ContentEditor`) — `document.designMode`, broken on touch
12. Tenant landing override (`YwamPotch.tsx`) — hardcoded-English fork of `Landing`
13. Course + account settings dialogs — zero breakpoints, four repeated save machines
14. Landing (`Landing.tsx`) — best-looking; needs dedup, not redesign
15. Legal pages — hardcoded brand and English on the consent path to purchase
16. Course index / status states (`CoursePanes.tsx`) — swap emoji for real icons

**Suggested validation target for ticket 02:** the Paygate (#4). It is small enough to
prototype whole, its mobile treatment is the thinnest of any learner surface, and
"checkout on a phone" is the single richest category in Mobbin's library — a fair test
of whether the references earn the subscription.
