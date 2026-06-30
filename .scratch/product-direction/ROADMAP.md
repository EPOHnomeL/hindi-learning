# Product Direction & Roadmap — "Served Teach" as a product

Source: grilling session, 2026-06-30. Vocabulary: [`CONTEXT.md`](../../CONTEXT.md). Architecture decision: [ADR 0014](../../docs/adr/0014-provider-agnostic-teaching-runtime-two-lines.md).

## Sharpened objective

An **AI course studio** where a non-engineer author (a C-suite sponsor) builds an interactive, grounded course once, and a population of learners (the rest of the company) consumes it. The expensive, "personalised" intelligence lives at **authoring time**; **serving** the finished course to many people is cheap. Learner support is **community/author** (a future forum), not AI-per-learner.

Two commercial lines (external phase — see [ADR 0014](../../docs/adr/0014-provider-agnostic-teaching-runtime-two-lines.md)):

- **Managed line** — we run it on Claude, quality-guaranteed, billed to the customer. "Easy and expensive."
- **BYOK line** — the customer brings any OpenAI-compatible key + model and configures it. Claude is guaranteed; other models are reachable but their quality is the customer's. "Configure it yourself."

**Near-term target: internal first, external later.** v1 is an internal tool for our own company, funded on our own key. The two lines / BYOK / billing / multi-tenancy are designed now (ADR 0014) and built in the external phase.

## Decisions banked this session

| Decision | Verdict | Where |
|---|---|---|
| What each employee gets | **Shared fixed course** (not per-employee-personalised lessons) | this doc |
| Learner support | **Community forum** (peer + author) — deferred | Phase 2 below |
| Course vs Topic rename + per-learner enrollment | **Deferred** — reuse existing Topic + Share/Public-link | Phase 2 below |
| "Different models as drop-in" | **BYOK gateway, Claude guaranteed** | [ADR 0014](../../docs/adr/0014-provider-agnostic-teaching-runtime-two-lines.md) |
| Internal vs external | **Internal first, external later** | this doc |
| Authoring UX | **Seed-and-go now**; AI-assisted editing later | [issue](../course-authoring/issues/01-ai-assisted-course-editing.md) |
| Styling | App chrome + brand, component library, landing page, mobile — **all four** | Phase 0 / 1 below |

## Already shipped (don't re-build)

Async teaching loop, multi-topic foundation, Convex as source of truth, immutable lessons / mutable references, Routine gate+lock, Share (account) + Public link (anonymous), Allowlist + Admin portal, URL-addressable routes, quiz capture, Q&A loop, dark mode, lesson design system. (See the codebase map / ADRs 0001–0013.)

---

## Phase 0 — Internal company demo (ship this first)

The goal: a C-suite sponsor builds a course and shows it to the company, on our key, looking like a real product.

1. **Onboard multiple authors.** Add the C-suite sponsors to the Allowlist; confirm each can sign in, Seed a Topic, upload Resources, and fire authoring. *(Largely works today — verify end-to-end with a non-engineer.)*
2. **Review/approve gate before company-wide publish.** Today Lessons auto-publish. For company content, the author should review a course and explicitly publish it to readers. *(New — also a prerequisite for the AI-editing issue.)*
3. **Styling — app chrome + brand polish.** Dashboard, course shell, sign-in, seed/upload forms, admin panel; a cohesive brand (name, logo, colour, empty states). Lessons already look great. **Highest demo impact.**
4. **Styling — adopt a component library (shadcn/ui).** Do this *before/with* the chrome work so it accelerates rather than follows it; reconcile with the existing warm palette + Spectral/Noto fonts.
5. **Styling — mobile polish** of the dashboard/authoring chrome (the reader is already mobile-first).
6. **Costing instrumentation.** Capture real tokens-per-lesson per authoring run so the cost model below stops being a guess. *(See Costing.)*
7. **Distribution UX for a course.** Make "share this course with the company" a clear, obvious action on top of the existing Share/Public-link plumbing.

> ⚠️ Honest note on "employee progress": per-employee progress/Q&A needs the **enrollment** model that was deferred (today non-owners are read-only Viewers/Guests who write nothing). For the demo, employees are **read-only**. If per-person progress matters for the demo, pulling that one slice of enrollment forward is the exception to make — flag it.

## Phase 1 — External productisation ([ADR 0014](../../docs/adr/0014-provider-agnostic-teaching-runtime-two-lines.md))

The spine that turns the internal tool into a sellable product.

1. **Port the teach loop off Claude Code** onto a programmatic, provider-configurable agent runtime (Agent SDK or equivalent). **This is the biggest single engineering item** — both lines depend on it.
2. **OpenAI-compatible gateway** (LiteLLM / OpenRouter) so "add a vendor" is a model string + key field.
3. **BYOK key storage + security.** Per-owner encrypted secrets (Convex env vars are deployment-wide, not per-user). Never logged, scoped to owner. New security surface.
4. **Metering + billing** for the Managed line (per-customer token/usage accounting; pricing model — see Costing).
5. **Multi-tenant orgs + roles.** An Org, an Author/sponsor role, a Learner role, course assignment. (Today: flat users + Allowlist + single Admin.)
6. **Styling — marketing/landing page** (deferred from Phase 0 because internal-first).

## Phase 2 — Personalisation & community upgrades

1. **Per-learner enrollment** — each employee gets their own progress / Responses / Questions on the shared lessons (the deferred Course-vs-Topic + enrollment modeling). *(Backlog issue to be written.)*
2. **AI-assisted course editing** — the "direct and build" upgrade. → [`course-authoring/issues/01`](../course-authoring/issues/01-ai-assisted-course-editing.md)
3. **Community forum** — peer + author Q&A, so learner support scales without AI-per-learner. *(Backlog issue to be written.)*
4. **Course / Topic terminology reconciliation** — code says `/courses`, glossary says "Topic / avoid Course". Resolve once enrollment lands. *(Backlog issue to be written.)*

---

## Costing

**Where cost lives:** authoring, not serving. Serving a finished course to N readers is ~free (static HTML from Convex). Each **Lesson** is one **agent run** (read Resources + prior Lessons + learning records → author interactive HTML → publish), so:

```
course cost ≈ (lessons per course) × (tokens per lesson run) × (model price)
```

**Cost controls already in place or cheap to add:**
- The **Frontier buffer-of-one** + on-demand **cooldown** gate already throttle how often authoring fires.
- **Model tier** is the main knob: cheap tier (Haiku) for drafts, premium (Opus) for hard topics.
- **Prompt-cache the Resources** (they're re-read every run) to cut input cost sharply.

**Action:** the per-lesson token figure is currently a guess — **instrument it** (Phase 0, item 6) before promising any price. Once measured, plug current Claude tier pricing into the formula for a real per-course cost, and (external phase) set the Managed-line price as that cost + margin. *Ask me to pull current model pricing when you want a hard number.*

## Open questions for next time

- Does the demo need **per-employee progress** (the one slice of enrollment to pull forward), or is read-only fine?
- Product **name + brand** — "Served Teach" / "hindi-learning" are placeholders.
- For AI-assisted editing: **async edit-intents** vs **live chat-to-build studio** (the wow option). See the [issue](../course-authoring/issues/01-ai-assisted-course-editing.md).
