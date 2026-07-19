# course-publishing/04: Default-site vs tenant scope for publish / catalogue / self-enroll

**Status:** done
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

---

## Resolution (2026-07-19)

Grilled with the user (`/grilling`). Three sub-questions resolved:

**1 + 2 — Default site is in scope, catalogue scoped to default-site-owned courses.** The default
site **does** get the catalogue + self-enroll — the discovery pain is strongest on the flagship, where
the bulk of learners live; excluding it would gut the feature. But its **member-facing catalogue lists
only default-site-owned published courses** (`tenantSlug` absent) — **never** a tenant's courses (UPF,
Almighty Warriors, Y-Knot). A learner who wants a tenant's course signs up on that tenant's subdomain.

This makes every catalogue **symmetric by scope**: subdomain *X* lists `tenantSlug = X`; the default
site lists `tenantSlug` absent. No cross-tenant firehose anywhere on the member surface. It answers
sub-question 2 ("what populates the default-site catalogue") directly: **default-site courses only**.

**Interaction with the parked whitelabel fog — named, not silently pre-empted.** The whitelabel map
parks *"Default-site catalogue curation (`my-course.app` lists all courses for v1 — revisit later)"*.
This ticket resolves **one facet** of that fog: the new **member self-enroll catalogue** excludes
tenant courses (tightens the "lists all courses" default in the exclude direction). It does **not**
resolve the rest of that fog — per-course opt-out, curation/ordering/featuring *within* default-site
courses stay parked on the whitelabel map. And it does **not** touch existing **platform-admin**
cross-tenant visibility (admins already see across tenants; that is unchanged, not a new "admin sees
all" catalogue mode — user confirmed).

**3 — `selling` on the default site: implicitly on, defer to the platform gate (option A).** A
default-site course has no `tenants` row, so the per-tenant `selling` flag (ticket 02) has nowhere to
read from. Rule: **an absent `tenantSlug` satisfies the per-tenant gate**, and selling then falls back
to the single existing deployment-wide `sellingEnabled()` env gate (PayFast vars + `PAYFAST_MODE`). No
phantom tenant row, no new env. Matches the fact that the paid marketplace already exists platform-wide
(ADR 0016) and that any real selling still requires the live platform PayFast rail. Implementation
note for ticket 06: `assertTenantFlag(…, "selling")` must treat `tenantSlug == null` as **pass**, not
throw.

No new tickets surfaced; nothing to graduate from the fog. Resolving 04 leaves **07** and **08** as the
open frontier (05 still blocked on 07; 06 still blocked on 05).
