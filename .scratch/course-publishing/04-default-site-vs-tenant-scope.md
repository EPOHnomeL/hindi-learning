# course-publishing/04: Default-site vs tenant scope for publish / catalogue / self-enroll

**Status:** open
**Depends on:** —
**Labels:** wayfinder:grilling

Child of [Course publishing map](00-course-publishing-map.md).

## Question

The whole model is framed around a **tenant's** catalogue and its members. But the platform also has
the **default site** (`my-course.app`), which today lists **all** courses and whose users are
connected to the default site only (not a subdomain). Decide, via `/grilling`, whether publish /
catalogue / self-enroll applies there too:

1. **Does a default-site user get a catalogue + self-enroll**, or is this capability
   **tenant-subdomain-only** for v1 (the default site keeps today's behaviour)?
2. If it applies to the default site, **what populates its catalogue** — all published courses
   regardless of tenant? This directly interacts with the parked **"default-site catalogue policy
   revisit"** fog item on the whitelabel map ("my-course.app shows all courses", which the user
   expects to change later with curation/opt-out). Don't silently pre-empt that decision here — name
   the interaction.
3. **`selling` on the default site** — the per-tenant `selling` flag (ticket 02) has no obvious
   home for default-site courses (no tenant row). Decide how selling is gated for a default-site
   course, or rule default-site selling out.

A scope/policy decision, independent of the enroll mechanic. Resolve, comment, close, add a
Decisions-so-far line to the map.
