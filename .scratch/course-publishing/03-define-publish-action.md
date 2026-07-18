# course-publishing/03: Define the "publish" action & course states

**Status:** done
**Depends on:** 01, 02
**Labels:** wayfinder:grilling

Child of [Course publishing map](00-course-publishing-map.md).

## Question

"Publish" is the owner action that makes a course discoverable in its tenant's catalogue and sets it
free or priced. Blocked by [ticket 01](01-model-self-enroll-grant.md) (the enroll grant's
granularity fixes what "publish" applies to — course or Edition) and
[ticket 02](02-per-tenant-selling-flag.md) (the `selling` flag gates the priced choice). Decide, via
`/grilling`:

1. **What "published" *is*** — a new state/field on the topic (a `published` boolean? a status?), or
   is it implied by the presence of a listing / catalogue membership? Per-course or per-Edition
   (must agree with ticket 01's granularity).
2. **Who can publish, and when** — owner-only? Pricing today requires the course be `completed` and
   the owner a ready Seller; does publishing free carry the same completeness bar, or can a free
   course be published while still in progress?
3. **The free-vs-priced choice at publish** — how the two combine: publish-free (→ self-enroll),
   publish-priced (→ existing `listings` + PayFast, only if the tenant `selling` flag is on).
   Per-Edition pricing already exists — reconcile "publish the course" with "price each Edition".
4. **Relationship to what already exists** — the surviving **anonymous public link** (kept per the
   user) and the existing **`listings`**: does publishing subsume, sit beside, or reuse them? Avoid
   two overlapping "it's free and open" notions collapsing into confusion.

Resolve, comment, close, add a Decisions-so-far line to the map.

## Resolution (2026-07-18, `/grilling` + `/domain-modeling`)

The user reframed the model mid-grill: **`published` is a course lifecycle *status*, not an orthogonal
flag** — because folding it into the authoring spine matches the real author journey and structurally
fixes the moving-denominator progress bug (see below).

### 1. Course lifecycle — `topics.status` gains a fourth value

`status` becomes `seeded | active | completed | published`:

```
active ──finish──▶ completed ──publish──▶ published
  ▲                    │  ▲                   │
  └──── reopen ────────┘  └──── unpublish ────┘
```

- **`completed`** — the author has declared the *content* done. Generation is already gated off here
  (the Routine refuses `completed`), so the **lesson count is frozen**. This is the **editing /
  proofing phase**: assign edition editors ([edition-editor-rights], existing), internally `share` to
  friends to proofread (existing shares), refine. **Not discoverable.**
- **`published`** — reached **only from `completed`**, via an **owner-only** action. Lists the course
  in its tenant catalogue. `unpublish` returns it to `completed` (existing enrollments grandfather,
  per [ticket 01](01-model-self-enroll-grant.md)); `reopen` still returns to `active`.

### 2. Publish is orthogonal to price (course-level flip; price stays per-Edition)

Publishing is a pure `status` flip. Free-vs-priced remains the existing per-Edition `listings`
(`convex/market.ts`): a **free course** = `published` + zero listings (every Edition self-enrolls); a
**priced/mixed course** = `published` + ≥1 listing (priced Editions buy, the rest self-enroll —
mixed languages are fine). No course-level price field. Sequence: price the Editions in the
`completed` phase (needs `selling` flag [ticket 02] + `isReadySeller`), then publish.

### 3. Who / when

**Owner-only** (not edition editors, not — per the user — tenant admins). Publishing free requires
only `status === completed`. Publishing priced additionally needs the tenant `selling` flag on +
`isReadySeller` + a `listings` row — exactly what `setEditionPrice`
([convex/market.ts:39](../../../convex/market.ts#L39)) already enforces, so pricing-then-publishing
composes with no new gates.

### 4. Relationship to what exists — publish = catalogue *visibility* only, NOT an acquisition gate

- **Self-enroll** (free, account-based) is a catalogue action → requires `published` (ticket 01,
  unchanged).
- **Buy works via a direct link *regardless* of publish** (user decision — "users can also buy with
  links"): `startCheckout` is **not** gated on `published`. Publish only controls whether a priced
  course *also* appears in the catalogue (unlisted-but-buyable).
- **Free-via-link** stays the existing anonymous **public link**; both it and `listings` sit
  **beside** publish, unchanged. Publish neither subsumes nor requires either.

### Surfaced → new ticket (blocks the PRD)

**Buy / share / public links must be generated on the owning tenant's subdomain**, not the
deployment-wide `SITE_URL` (user requirement — "make sure the links come from the tenant domain").
`appUrl` ([convex/payfast.ts:232](../../../convex/payfast.ts#L232)) today resolves every link off one
`SITE_URL` origin and enforces same-origin against it (an open-redirect guard feeding PayFast's
return/cancel/notify URLs). Making it tenant-aware *while preserving that guard* is a distinct
decision → [ticket 08 — Tenant-domain link generation](08-tenant-domain-links.md). Blocks
[ticket 06](06-prd-and-issue-breakdown.md).

### Parked → out of scope (separate effort)

The user surfaced the **learner-progress percentage / estimate** pain ("15/16 → 16/17 churn"; an
estimate that said ~20 and ran to 85). Publishing structurally cures the *moving-denominator* half
(a `published` course has a frozen lesson count, and members only enroll from the catalogue → the
denominator can't move). The remaining **estimate-accuracy** and **in-progress %-display** concerns
are learner-facing, orthogonal to publish/catalogue/self-enroll → parked as a **separate effort**
(existing `lesson-estimate` / `course-completion` scratch dirs), out of scope for this map.

**Unblocks:** nothing new on its own ([ticket 05](05-tenant-catalogue-surface.md) still waits on 04 +
07). Adds [ticket 08](08-tenant-domain-links.md) as a fresh PRD dependency.
