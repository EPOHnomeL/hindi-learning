---
type: grilling
blocked_by: [01, 02]
---

# Define the "publish" action & course states

> **AMENDED 2026-07-28 at build time — read before the Answer.** The build replaced the course-level
> grain with a per-**Edition** `publishedEditions` row (`published: boolean`) and dropped the fourth
> `topics.status` value entirely. Rationale + full decision:
> `docs/adr/0024-publish-at-the-edition-grain.md`.
>
> - **§1 (course lifecycle status) — superseded.** No `published` status, no state-machine change, no
>   Routine gate change. Publishing is per-Edition and off the authoring axis (list English while
>   Spanish still proofs; list a still-`active` course).
> - **§2 (price/publish orthogonality) — still holds**, but its *sequence* ("price while `completed`,
>   then publish") is gone: the two axes are independent, so `setEditionPrice` keeps its own
>   `completed` gate and there is nothing to widen.
> - **§3 (owner-only) — reaffirmed.** Reconsidered during the build; the original answer stands.
> - **§4 (visibility, not an acquisition gate) — still holds**, and goes further: for a **free**
>   published Edition there is no acquisition step at all — it reads ≡ a Viewer for any signed-in
>   account, with no join click and no `enrollments` row.
> - The catalogue landed as a **section on the signed-in home**, not a route.

## Question

"Publish" is the owner action that makes a course discoverable in its tenant's catalogue and sets it
free or priced. Blocked by [ticket 01](01-model-self-enroll-grant.md) (the enroll grant's granularity
fixes what "publish" applies to — course or Edition) and [ticket 02](02-per-tenant-selling-flag.md)
(the `selling` flag gates the priced choice). Decide, via `/grilling`:

1. **What "published" *is*** — a new state/field on the topic (boolean? status?), or implied by a
   listing / catalogue membership? Per-course or per-Edition (must agree with ticket 01).
2. **Who can publish, and when** — owner-only? Does publishing free carry the same completeness bar
   as pricing (course `completed`, owner a ready Seller), or can a free course be published while in
   progress?
3. **The free-vs-priced choice at publish** — how the two combine: publish-free (→ self-enroll),
   publish-priced (→ existing `listings` + PayFast, only if the tenant `selling` flag is on).
   Reconcile "publish the course" with the existing per-Edition pricing.
4. **Relationship to what exists** — the surviving anonymous **public link** and the existing
   **`listings`**: does publishing subsume, sit beside, or reuse them?

## Done when

The nature of "published", who/when may publish, how free/priced combine, and its relationship to
public links + listings are decided and recorded, with any PRD-blocking follow-ups spun off.

## Answer

Resolved 2026-07-18 (`/grilling` + `/domain-modeling`). The user reframed the model mid-grill:
**`published` is a course lifecycle *status*, not an orthogonal flag** — folding it into the authoring
spine matches the real author journey and structurally fixes the moving-denominator progress bug.
*(Sequencing in §1/§2 was later superseded at build time — see the amendment above; the code went
per-Edition via ADR 0024.)*

1. **Course lifecycle** — `topics.status` gains a fourth value: `seeded | active | completed |
   published`, with `active ──finish──▶ completed ──publish──▶ published`, plus `unpublish`
   (→ `completed`) and `reopen` (`completed` → `active`). `completed` = content-done/generation-frozen
   editing/proofing phase (editors, internal shares), **not discoverable**; `published` = reached
   **only from `completed`**, via an **owner-only** action, lists the course in its tenant catalogue.
   `unpublish` grandfathers existing enrollments (ticket 01).
2. **Publish is orthogonal to price** — a pure `status` flip; free-vs-priced stays the existing
   per-Edition `listings`. A free course = `published` + zero listings; a priced/mixed course =
   `published` + ≥1 listing (mixed languages fine). No course-level price field. Sequence: price the
   Editions in `completed` (needs `selling` flag + `isReadySeller`), then publish.
3. **Who / when** — **owner-only** (not edition editors, not tenant admins). Publishing free requires
   only `status === completed`; publishing priced additionally needs the tenant `selling` flag +
   `isReadySeller` + a `listings` row — exactly what `setEditionPrice` already enforces, so no new
   gates.
4. **Publish = catalogue *visibility* only, NOT an acquisition gate** — self-enroll requires
   `published`; **buy works via direct link regardless** (`startCheckout` is not gated on
   `published`); free-via-link stays the anonymous public link. Both public link and `listings` sit
   **beside** publish, unchanged.

**Surfaced → new ticket (blocks the PRD):** buy/share/public links must be generated on the owning
tenant's subdomain → [ticket 08 — Tenant-domain link generation](08-tenant-domain-links.md).

**Parked → out of scope:** the learner-progress percentage/estimate pain; publishing structurally
cures only the moving-denominator half; the estimate-accuracy + in-progress %-display concerns go to
a separate effort (`lesson-estimate` / `course-completion` scratch dirs).
