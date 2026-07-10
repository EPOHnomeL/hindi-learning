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

- 2026-07-10 — Migrated to GitHub issue [#28](https://github.com/EPOHnomeL/hindi-learning/issues/28); GitHub is now the tracking home for this ticket.
