# Onboarding & marketing video

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

A decision set for a product demo that shows a stranger what this thing does before it asks
them to sign up and pay — including the call on **interactive page vs video file**.

## Notes

- **The named tool is a material constraint:** the `html-demo-wizard` skill builds standalone
  high-fidelity HTML demos and autoplay flow simulations. That biases the deliverable toward
  an *interactive page*, not an mp4 — establish deliberately whether a real file is ever
  needed (WhatsApp and social want a file; a landing-page embed does not). Convex actions
  cannot run ffmpeg.
- **Onboarding and marketing are different jobs** — convincing a stranger vs orienting a new
  account. Ticket 01 insists this be decided deliberately: one artifact doing both will do
  neither well.
- **The whitelabel question decides whether this is one build or four:** must a YWAM Potch
  demo look like YWAM Potch? One demo reading `tenants.theme`, or hand-authored per tenant
  like `src/app/_landing/registry.ts`.
- **Staleness is the honest risk.** A hand-authored demo drifts from the real UI silently. A
  guided tour over the real app is the always-current alternative and should be priced, not
  dismissed.
- Deliberately distinct from three neighbours (all named in the ticket):
  [course-media/01](../course-media/tickets/01-scope-course-trailer.md) (per-course, generated
  from course data), [course-media/02](../course-media/tickets/02-scope-course-audio.md)
  (learner-facing), and [onboarding/01](../onboarding/tickets/01-improve-onboarding-flow.md)
  (in-product first run). A shared rendering approach may still fall out of the trailer work.
- Skills: `html-demo-wizard`, `/grilling`, `/prototype`.

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

## Out of scope

- Per-course generated trailers ([course-media/01](../course-media/tickets/01-scope-course-trailer.md)).
- Paid-ads or distribution tooling.
- **Actually building it** — this map's deliverable is the decision set.
