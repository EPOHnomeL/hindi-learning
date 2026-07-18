# course-publishing/03: Define the "publish" action & course states

**Status:** open
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
