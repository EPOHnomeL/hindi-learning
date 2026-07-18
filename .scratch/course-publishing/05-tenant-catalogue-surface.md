# course-publishing/05: The catalogue surface

**Status:** open
**Depends on:** 03, 04, 07
**Labels:** wayfinder:prototype

Child of [Course publishing map](00-course-publishing-map.md).

## Question

The member-facing browse surface — the thing that makes self-enroll meaningful (a member must *see* a
course they don't yet have access to before they can join it). Blocked by
[ticket 03](03-define-publish-action.md) (what "published" means → what the catalogue lists) and
[ticket 04](04-default-site-vs-tenant-scope.md) (whether it exists on the default site too). Use
`/prototype` to raise fidelity on the layout/behaviour question, then decide:

1. **Where it lives** — a new member-facing route/tab? How a member reaches it (nav, home).
2. **What it lists** — published courses carrying the member's `tenantSlug` (per ticket 04's scope
   decision); free vs priced affordances (join now vs. price + buy); how already-enrolled / owned /
   purchased courses appear (hidden? marked "joined"?). **Cross-language courses show *disabled***
   per [ticket 07](07-language-scoped-access.md) when the tenant `translations` flag is on.
3. **The join affordance** — the one-click self-enroll for free courses (writing the ticket-01
   grant) and the buy affordance for priced ones (existing `startCheckout`), and where the learner
   lands after joining.
4. **Empty / fallback states** — a tenant with nothing published yet.

Per `/prototype` conventions: mount throwaway variants on the real route with mock data, judge, then
delete. Link the prototype as an asset. Resolve, comment, close, add a Decisions-so-far line to the
map.
