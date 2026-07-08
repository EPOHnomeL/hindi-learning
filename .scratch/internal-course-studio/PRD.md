# PRD: Internal Course-Studio Demo (Phase 0)

Status: partial — chrome/brand/mobile + sponsor path done; publish-gate, cost instrumentation, and shadcn remain open

> Vocabulary follows [`CONTEXT.md`](../../CONTEXT.md). Decisions respect ADRs
> [0001](../../docs/adr/0001-asynchronous-hub-mediated-teaching-loop.md) (no LLM in the web app),
> [0003](../../docs/adr/0003-immutable-lessons-mutable-references.md) (immutable Lessons / mutable References),
> [0009](../../docs/adr/0009-content-source-of-truth-in-convex-routine-pulls-context.md) (Convex is the source of truth),
> [0013](../../docs/adr/0013-public-link-shares.md) (Public link), and the forward direction in
> [0014](../../docs/adr/0014-provider-agnostic-teaching-runtime-two-lines.md) (two lines / BYOK — explicitly out of scope here).
> Roadmap context: [`../product-direction/ROADMAP.md`](../product-direction/ROADMAP.md).

## Problem Statement

I want to show this product to my company and have a handful of C-suite sponsors each build a Topic (a "course") and distribute it to the rest of the company to learn from. Today three things block that:

1. The app looks like a developer tool, not a product — the lesson artifacts are beautiful, but the surrounding chrome (dashboard, course shell, sign-in, the Seed/upload forms, admin) is unstyled and off-brand. I can't put it in front of executives.
2. A Topic's Lessons go live the moment the Routine authors them. For content that the whole company will read, a sponsor needs to **review the course and decide when it goes live** — there is no gate today.
3. I have no idea what it costs me to have the Routine author a course on my own key, so I can't reason about running this for real.

I am funding everything on my own key for now (internal first); billing, BYOK, multi-tenant orgs, and per-employee personalisation are deliberately later.

## Solution

Make the existing single-owner Topic + Share/Public-link product **demo-ready as an internal course studio**, without new architecture:

- A C-suite sponsor signs in (Allowlist), **Seeds** a Topic (title + "why" + Resources), and the existing Routine authors its Lessons (seed-and-go is unchanged — ADR 0001 holds).
- Before anyone else sees it, the course sits in a **draft** state visible only to its owner. The owner **publishes the course to readers** as an explicit action; only then do Viewers/Guests see it. Unpublishing hides it again.
- The owner **distributes** the published course to the company over the existing **Share** (account) and **Public link** (anonymous) mechanisms, surfaced as a clear "share with the company" action.
- The whole surface is **restyled** — cohesive brand, a component library (shadcn/ui) reconciled with the existing warm palette and Spectral / Noto Serif Devanagari fonts, and a mobile-tight dashboard/authoring chrome.
- Each Routine run **records its token usage** so the cost of authoring a course is measurable, not guessed.

Employees remain **read-only** in this phase (Viewer / Guest); per-employee Progress, Responses, and Questions require the deferred enrollment model and are out of scope.

## User Stories

### Sponsor onboarding & authoring
1. As an Admin, I want to add a C-suite sponsor's email to the Allowlist, so that they can create an account and start building.
2. As a sponsor, I want to sign in and land on a dashboard that looks like a finished product, so that I trust the tool enough to use it in front of the company.
3. As a sponsor, I want to Seed a Topic with a title, a free-text "why", and uploaded Resources, so that the Routine can author a grounded course.
4. As a sponsor, I want the Routine to author the course's Lessons from my Seed and Resources (seed-and-go, unchanged), so that I don't have to write lessons by hand.
5. As a sponsor, I want to edit my Topic's Mission text, so that the "why" reads the way I want before the company sees it.
6. As a sponsor, I want to upload an additional Resource to an existing Topic, so that the next authoring run is better grounded.

### Review & publish gate
7. As a sponsor, I want a newly Seeded/authored course to be a **draft** visible only to me, so that nobody sees unfinished material.
8. As a sponsor, I want to read through my course's Lessons and References in their authored order while it is still a draft, so that I can decide whether it is ready.
9. As a sponsor, I want an explicit "Publish course to readers" action, so that the company sees the course only when I say so.
10. As a sponsor, I want a clear indication of whether a course is currently a draft or published, so that I always know what the company can see.
11. As a sponsor, I want to **unpublish** a published course, so that I can pull it back to draft to revise it.
12. As a Viewer or Guest, I want to see only courses that have been published to readers, so that I never land on half-finished material.

### Distribution to the company
13. As a sponsor, I want a clear "share with the company" action on a published course, so that distributing it is obvious and not buried in settings.
14. As a sponsor, I want to grant a named colleague read-only access by email (Share), so that a specific person can read the course.
15. As a sponsor, I want to mint an anonymous **Public link** for a published course, so that the whole company can read it without each needing an account.
16. As a sponsor, I want to revoke or regenerate a Public link, so that I can cut off access when needed.
17. As an employee (Viewer/Guest), I want to open a shared course and read its Lessons and References on the web, so that I can learn from it.
18. As an employee on a phone, I want the course to read well on mobile, so that I can learn away from my desk.

### Styling & brand
19. As a sponsor, I want the dashboard, course shell, sign-in, Seed/upload forms, and admin panel to share one cohesive visual brand, so that the product feels finished.
20. As a developer, I want a component library (shadcn/ui) reconciled with the existing palette and fonts, so that future UI is consistent and faster to build.
21. As any user, I want dark mode to keep working across the restyled chrome and inside lesson iframes, so that the existing theming is not regressed.
22. As any user on a small screen, I want the dashboard and authoring chrome to be usable, so that the product is not desktop-only.

### Cost visibility (operator)
23. As the operator, I want each Routine run to record the tokens it consumed, so that I can compute the cost of authoring a course.
24. As the operator, I want to see usage aggregated per Topic, so that I can estimate per-course cost and reason about running this for the company.

## Implementation Decisions

- **No new architecture; ride existing seams.** This phase is polish + a publish gate + instrumentation on top of the shipped Topic / Share / Public-link / Routine machinery. ADR 0001 (no LLM in the web app) and ADR 0009 (Convex source of truth) are unchanged.
- **Authoring stays seed-and-go** (ADR 0001). AI-assisted editing is the separate, deferred [course-authoring issue 01](../course-authoring/issues/01-ai-assisted-course-editing.md).
- **Lessons stay immutable** (ADR 0003). The publish gate is about *visibility to readers*, not editing.

### Review/publish gate — single new seam
- Introduce a course **reader-visibility** state on the Topic (e.g. `draft` vs `published-to-readers`), distinct from the existing `seeded | active` authoring lifecycle. Default for a new/Seeded Topic is **draft**.
- The owner can always read their own draft. **Viewer and Guest read queries are filtered to published courses only** — enforced at the existing read seam (`convex/public.ts` for Guests via Public-link token; the Share/Viewer queries in `convex/shares.ts`). This is the highest seam: gate at read time, do not duplicate the check per surface.
- "Publish to readers" / "Unpublish" are owner-only mutations (reuse the owned-topic guard). They flip the visibility state; they do **not** touch Lesson content.
- A Public link for a draft course resolves to "not available" until the course is published (Guests never reach draft content).

### Distribution
- Reuse the existing `shareTopic` (account Share), `setTopicPublic` (Public link mint/turn-off/regenerate) mutations unchanged; the only change is surfacing a prominent "share with the company" entry point in the restyled course UI, and gating it so a course can only be shared once published.

### Cost instrumentation — second seam (report path)
- Extend the Routine **report** path (`reportGeneration`, per ADR 0008/0009) to persist token usage for the run (input/output/model). Store it on the run record / a usage row keyed by Topic.
- Expose a per-Topic usage aggregate to the operator (a query; minimal surfacing). No billing, no metering enforcement — measurement only.

### Styling
- Adopt **shadcn/ui** on the existing Tailwind v4 setup; reconcile its tokens with the current `@theme` palette (warm paper / rust accent) and the Spectral + Noto Serif Devanagari fonts rather than overriding them.
- Restyle the chrome surfaces (dashboard, course shell, sign-in, Seed/upload modals, admin) and tighten mobile breakpoints. Preserve the dark-mode mechanism and the app→iframe theme bridge (ADR 0011).
- Establish a minimal brand (name, logo/wordmark, colour usage, empty states). Marketing/landing page is **out of scope** (external phase).

## Testing Decisions

**What makes a good test here:** assert external behavior at the stable seams, not UI detail or styling.

- **Reader-visibility gate** (the core new logic) — test at the Convex read seam: a draft Topic's Lessons/References are **not** returned to a Guest (by Public-link token) or a Viewer (by Share), and **are** returned to the owner; after "publish to readers" they are returned to Guest/Viewer; after "unpublish" they disappear again. Owner-only publish/unpublish mutations reject non-owners. Prior art: the existing public/shares read tests and the owned-topic guard tests.
- **Cost instrumentation** — test the report path: a completed run persists a usage record associated with the right Topic; the per-Topic aggregate sums runs. Prior art: existing `reportGeneration` / generation-lock tests.
- **Distribution gating** — a course cannot be shared/made-public while it is a draft; can once published. Reuse the shares/public mutation tests.
- **Styling** is verified by eye and (where present) component tests; it is not unit-tested. Dark-mode and iframe-theme are guarded against regression by the existing theme tests.

## Out of Scope

- **Provider-agnostic runtime, gateway, BYOK, the two commercial lines** — all deferred to the external phase (ADR 0014).
- **Metering enforcement / billing / pricing** — this phase only *measures* token usage.
- **Multi-tenant orgs and roles** — flat users + Allowlist + single Admin, unchanged.
- **Per-employee Progress / Responses / Questions (enrollment)** — employees stay read-only; enrollment is deferred (Phase 2).
- **AI-assisted course editing** — separate deferred issue (course-authoring 01).
- **Community forum** — deferred (Phase 2).
- **Course/Topic terminology reconciliation** — deferred; this PRD keeps "Topic" in schema/domain and may use "course" only in user-facing copy.
- **Marketing / public landing page** — external phase.
- **Real-time notifications** — unchanged; state shows on next visit.

## Further Notes

- The publish gate is independently valuable beyond the demo: it is the prerequisite for the review/approve step in the future AI-assisted editing issue.
- Per-employee progress is the single most likely thing to get pulled forward from Phase 2 if the demo needs it; the visibility gate and read-seam filtering should be written so adding per-(user, Topic) capture for enrolled readers later is additive, not a rewrite.
- Cost instrumentation is what converts the roadmap's costing *formula* into a real per-course number; prioritise it early so pricing conversations (external phase) start from data.
