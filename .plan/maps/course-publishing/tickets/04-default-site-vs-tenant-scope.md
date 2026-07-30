---
type: grilling
blocked_by: []
---

# Default-site vs tenant scope for publish / catalogue / self-enroll

## Question

The whole model is framed around a **tenant's** catalogue and its members. But the platform also has
the **default site** (`my-course.app`), which today lists **all** courses and whose users are
connected to the default site only. Decide, via `/grilling`, whether publish / catalogue /
self-enroll applies there too:

1. **Does a default-site user get a catalogue + self-enroll**, or is this capability
   **tenant-subdomain-only** for v1 (the default site keeps today's behaviour)?
2. If it applies to the default site, **what populates its catalogue** — all published courses
   regardless of tenant? This interacts with the parked **"default-site catalogue policy revisit"**
   fog on the whitelabel map — don't silently pre-empt it; name the interaction.
3. **`selling` on the default site** — the per-tenant `selling` flag (ticket 02) has no obvious home
   for default-site courses (no tenant row). Decide how selling is gated there, or rule it out.

A scope/policy decision, independent of the enroll mechanic.

## Done when

Whether the default site is in scope, what populates its catalogue, and how `selling` resolves there
are all decided and recorded (with the whitelabel-fog interaction named), plus a map line.

## Answer

Resolved 2026-07-19 (`/grilling`). Three sub-questions resolved:

**1 + 2 — Default site is in scope, catalogue scoped to default-site-owned courses.** The default
site **does** get the catalogue + self-enroll (discovery pain is strongest on the flagship), but its
member-facing catalogue lists **only default-site-owned published courses** (`tenantSlug` absent) —
**never** a tenant's courses (UPF, Almighty Warriors, Y-Knot). A learner who wants a tenant's course
signs up on that subdomain. This makes every catalogue **symmetric by scope**: subdomain *X* lists
`tenantSlug = X`; the default site lists `tenantSlug` absent. No cross-tenant firehose anywhere on the
member surface.

**Interaction with the parked whitelabel fog — named, not pre-empted.** This resolves **one facet** of
the whitelabel map's *"default-site lists all courses"* fog (the new member catalogue excludes tenant
courses). It does **not** resolve per-course opt-out / curation/ordering/featuring within default-site
courses (still parked on the whitelabel map), and does **not** touch existing platform-admin
cross-tenant visibility (unchanged — user confirmed).

**3 — `selling` on the default site: implicitly on, defer to the platform gate (option A).** An absent
`tenantSlug` **satisfies** the per-tenant gate, and selling falls back to the deployment-wide
`sellingEnabled()` env gate. No phantom tenant row, no new env. Implementation note for ticket 06:
`assertTenantFlag(…, "selling")` must treat `tenantSlug == null` as **pass**, not throw.

No new tickets surfaced. Resolving 04 leaves **07** and **08** as the open frontier (05 still blocked
on 07; 06 still blocked on 05).
