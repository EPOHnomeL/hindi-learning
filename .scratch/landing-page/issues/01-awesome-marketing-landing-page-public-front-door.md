# landing-page/01: Awesome marketing landing page (public front door)

**Status:** done
**Imported:** from GitHub #28 on 2026-07-15 (created 2026-07-10, closed 2026-07-12; GitHub issue deleted after import)

> Migrated from [`.scratch/landing-page/issues/01-marketing-landing-page.md`](https://github.com/EPOHnomeL/hindi-learning/blob/93ad1e399b426e882c40d9422d8691e1dfb3a46b/.scratch/landing-page/issues/01-marketing-landing-page.md) on 2026-07-10. Relative links in the text resolve against that file's location.

# 01 — Awesome marketing landing page (public front door)

Status: needs-triage (to-scope — captured 2026-07-08; not built)

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (Topic, Lesson, Reference, Mission, Resource, Edition, Share, Public link, Certificate, Seller, Entitlement). Relates to [ADR 0012](../../../docs/adr/0012-app-router-url-addressable-navigation.md) (URL-addressable routes / auth gate) and the [roadmap](../../product-direction/ROADMAP.md) Phase 1 item 6 (**marketing/landing page — deferred from Phase 0 because internal-first**).

## Want

An **awesome public landing page** — the front door a logged-out visitor sees, marketing the AI course studio ("seed a topic, an AI authors a grounded interactive course, learn and earn a certificate"). Modern, polished, with tasteful motion: 21st.dev-style components, [motion.dev](https://motion.dev) scroll/entrance animations, and an atmospheric background that reuses the certificate stage's aurora + gold-fleck motifs so it reads as the same product.

## Acceptance (to refine at triage)

- **Routing.** Public, ungated route: logged-out `/` shows the landing; logged-in `/` shows the existing Dashboard; a primary "Get started / Sign in" CTA leads into the existing sign-in flow ([`SignIn`](../../../src/app/_components/SignIn.tsx)). Today `/` is inside the `(app)` group and `AppGate` shows `SignIn` to logged-out users — this needs a public home route.
- **Sections that market the real product** (accurate to the glossary):
  - Hero — headline + subhead + CTAs, animated background.
  - **Grounded in your reading** — upload Resources; lessons never trust ungrounded knowledge over them.
  - **Interactive lessons** — self-contained HTML Lesson artifacts with quizzes.
  - **Ask anything** — the Q&A loop (learner asks a Question → Claude Code writes a Reply).
  - **Any language** — multi-language Editions (course-translation).
  - **Share & Public links** — account-bound Shares + anonymous Public links.
  - **Certificates** — a premium, printable Certificate on Completion (reuse the certificate visuals as a showcase).
  - **Paid marketplace / paygate** — see [issue 02](02-feature-paygate-on-landing.md).
- **Design system.** Use the warm paper palette + Spectral / Noto Serif Devanagari fonts already in [`globals.css`](../../../src/styles/globals.css); theme-aware (light/dark via `data-theme` / `useTheme`); mobile-first.
- **Motion.** Respect `prefers-reduced-motion` (as the certificate + `pop-in` already do). If `motion.dev` is adopted, add the `motion` dependency (pnpm); otherwise the atmospheric effects can be pure CSS in the existing tradition.
- A Devanagari heritage nod (the app's origin) **without** implying it's Hindi-only — the product is "teach me anything."

## Depends on

- A routing decision for a public home (root `/` public vs the current `AppGate` behaviour).
- Optional: the `motion` (motion.dev) dependency.

## Notes

- Roadmap deferred this to **Phase 1** (external productisation) — internal-first, so it was never built for the Phase 0 demo.
- Copy must respect `CONTEXT.md` vocabulary: user-facing "course" maps to a **Topic**; the URL is `/courses/[slug]` (ADR 0012). Prefer Lesson / Reference / Edition / Certificate / Seller / Entitlement.
- To-scope only — nothing in this ticket is built yet.

## Comments

### EPOHnomeL — 2026-07-10

Verified 2026-07-10 (main @ 1b2db94) — still outstanding as written: `/` renders `<Dashboard/>` inside `<AppGate>`, which shows the sign-in form to signed-out visitors (AppGate.tsx:20-23). No public marketing route exists; the layout comment itself says the ungated public route "will live outside this group".

### EPOHnomeL — 2026-07-12

Shipped in 53cc9e9 (with the `chat` icon in 8cb7b84).

**What landed**
- `/` moved out of the auth-gated `(app)` group into a public root page: signed out → the marketing landing, signed in → the Dashboard, same URL, no redirect (`src/app/page.tsx`).
- Landing (`src/app/_components/Landing.tsx`): hero on the certificate stage's aurora + gold-fleck atmosphere (`.cert-stage` reused), a 3-step how-it-works, six feature cards (grounded in your reading, interactive lessons, ask anything, living References, Editions in any language, Shares & Public links), a live demo `CertificateCard` (tilt + foil and all), and the existing `SignIn` flow embedded at `#get-started` as the CTA target. Warm-paper palette + Spectral/Noto Serif Devanagari, theme-aware, mobile-first. Devanagari heritage nod (अ in the hero, नमस्ते in the footer) without implying Hindi-only.
- Motion is pure CSS (`.land-rise` staggered entrance; `.land-reveal` scroll reveals behind `@supports (animation-timeline: view())`), all suppressed under `prefers-reduced-motion` — the **motion.dev dependency was not added**, per the issue's own fallback.

**Deliberately omitted**
- The paid-marketplace / pricing section — gated by #29 on the `feat/paid-marketplace` merge; the feature grid has an obvious slot for it when that lands.
