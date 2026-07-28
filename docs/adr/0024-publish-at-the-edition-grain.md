# Publish at the Edition grain, not as a course status

> Deliverable of the course-publishing build (commits 1–4, 2026-07-28).
> Amends [course-publishing/03](../../.scratch/course-publishing/03-define-publish-action.md) and
> the [PRD](../../.scratch/course-publishing/PRD.md), both annotated in place.

## Status

accepted (2026-07-28) — implemented by the `publishedEditions` table, the owner-only
`catalogue.setEditionPublished` mutation, the resolver's published-and-free branch
([`convex/lib.ts`](../../convex/lib.ts)), the Editions panel toggle and the signed-in home's
available-courses section.

**Supersedes** course-publishing ticket 03's §1 (`published` as a fourth `topics.status` value) and
the price-then-publish sequencing that followed from it. **Reaffirms** ticket 03's §3 (publish is
**owner-only** — not edition Editors, not tenant admins) and §4 (publish is catalogue visibility, not
an acquisition gate). **Amends** [ADR 0023](0023-self-enroll-access-primitive.md): "published" is now a
row, not a status, and no self-enroll click stands between a member and a free published course.

## Context

Ticket 03 modelled publishing as a course **lifecycle status**: `seeded | active | completed |
published`. Building it surfaced two problems.

**The grain disagrees with everything around it.** Every neighbouring concept in this codebase is
per-**[[Edition]]** `(topic, lang)`: a [[Share]], an [[Entitlement]], a price (`listings`), a
[[Public link]], a translation job, an `enrollments` row. A course-level status cannot express "the
English Edition is listed, the Spanish one is still being proofread" — and a course whose Editions are
translated at different times will always be in exactly that state.

**A status conflates two independent axes.** `seeded → active → completed` describes *authoring*; being
listed in a catalogue describes *distribution*. Folding them together made publishing inherit
authoring's gates (publish only from `completed`) and forced authoring gates to grow a publishing case
(the Routine having to refuse a second frozen status, `setEditionPrice` needing its `completed` gate
widened to `completed | published`). None of that work buys anything.

The third finding was about the *acquisition* step. Ticket 01 gave a free join its own grant row
(`enrollments`) so it could be labelled honestly and grandfathered. But for a course the owner has
deliberately published *free*, the click that writes the row is pure friction: the owner has already
decided every member may read it. The grant is the publish.

## Decision

**1. `publishedEditions`, one row per Edition.** `{ topicId, lang, published: boolean }`. An absent row
and `published: false` both mean unlisted; the row is written on the first publish and flipped in place
thereafter, so unpublishing keeps the record. `topics.status` is untouched — no fourth value, no
migration, and the Routine's authoring gate is exactly as it was.

**2. Owner-only.** `catalogue.setEditionPublished` gates on `getOwnedTopic`. An Editor does not publish,
and a tenant admin does not publish another member's course: listing someone's work under the site's
brand is the author's call. (Ticket 03 said this; it was briefly reconsidered during the build and the
original answer stands.)

**3. Publishing an Edition needs the Edition to exist** — the English source, or a language with a
`ready` translation job (the same guard `setEditionPublic` uses, so a catalogue entry never advertises a
language that would serve English text under a foreign label). Unpublishing is un-gated, so a stranded
Edition can always be pulled out (mirroring `clearEditionPrice`). Publishing is **not** gated on
`status`: an owner may list a course that is still `active`.

**4. A free published Edition reads ≡ a Viewer for any signed-in account.** It joins the grant walk
(`grantsFor`) at the lowest precedence, so Shares/Entitlements/enrollments keep their own badges. Three
properties fall out of it being *live* rather than stored:

- unpublishing or pricing the Edition ends the free read — there is no row to grandfather;
- it needs an account: publishing does **not** make a course anonymously readable (that stays the
  [[Public link]]'s job, unchanged);
- everything a Viewer gets follows for free — own Progress, Resources, [[Certificate]] eligibility.

**5. Price and publish stay orthogonal.** A published *priced* Edition is listed but not free: a member
lands on its [[Preview]] and the existing paygate. `startCheckout` remains un-gated on publish
(unlisted-but-buyable via a direct link), and pricing keeps its own `completed` gate — with publishing
off the status axis there is nothing to widen.

**6. The catalogue is a section on the signed-in home**, scoped **symmetrically** to the **host being
browsed** — on `<slug>.my-course.app`, that tenant's courses; on the apex, only untenanted ones; never
cross-tenant. No public catalogue, no new route, no landing-page change.

> **Amended 2026-07-28.** As first written this said "from the member's own `tenantSlug`", and that was
> unimplementable: **nothing writes `users.tenantSlug`.** Sign-up (`convex/auth.ts`) inserts `{ email }`
> alone, and tenant membership lives on the Allowlist row (`whitelist.tenantSlug`), not the account — so
> the field read `undefined` for every real member and their catalogue was permanently empty. The
> Allowlist row is no substitute either: sign-up is open (ADR 0021), so a self-signed-up member has no
> row at all. The host is the only thing that actually knows which site someone is on, and a member may
> legitimately visit more than one. `catalogue.list` therefore takes the slug as an argument, supplied by
> `useTenantSlug()` (resolved server-side from the host per ADR 0022 §3 — the client never parses it).
> A client-supplied slug is not a privilege boundary here: tenancy is a visibility filter and a skin, not
> a hard partition, and a free published Edition already reads as a Viewer for any signed-in caller, so
> the argument reveals nothing the course URL wouldn't. `users.tenantSlug` is left in the schema, read
> only by the tenant-removal guard (whitelabel issue 22).

**7. `enrollments` (ADR 0023) stays in place** — the table, the `enrolled` level and the resolver branch
are all still honoured — but the catalogue path never writes a row. It remains the right primitive the
day a grant must *outlive* the owner's decision (a free cohort grandfathered past a price rise, an
expiring or revocable enrolment, a course leaving the catalogue without evicting its readers).

## Consequences

- Publishing is now composable rather than sequenced: an owner can list English while Spanish is still
  in proofing, and can list a course before it is finished.
- `enrollments` is dormant machinery. That is a deliberate carrying cost, not an oversight: the alternative
  (deleting it) would have to be undone by the first requirement that needs a durable free grant.
- Because the free read is live, an owner pricing a formerly-free published Edition **does** cut off
  readers who never bought it. That is the honest reading of "publishing is the grant" — and it is
  exactly the case an `enrollments` row would be introduced to soften.
- "Publish" is now overloaded three ways in this codebase: the teach→Hub push (`content/publish.ts`,
  the [[Publish]] glossary term), a per-Edition **catalogue listing** (this ADR), and the anonymous
  [[Public link]] (`setEditionPublic`, one letter away). The names are held apart in `CONTEXT.md`.
