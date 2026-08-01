---
type: grilling
blocked_by: []
---

# Marketplace/discover component

## Question

Add to the landing page or another page, courses people have made public for paygated and non paygated courses

## Done when

The discover surface is specced — where it lives, what it lists (paid and free), and how it relates to the tenant catalogue that already ships — with implementation tickets opened.

<!-- Migrated 2026-07-30 from GitHub issue #79 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->

---

## Context folded from the retired `marketplace-discover` map (2026-08-01)

<!-- was .plan/maps/marketplace/tickets/02-marketplace-discover-component.md; that single-ticket map was consolidated into marketplace -->

- The ask is one line: *"Add to the landing page or another page, courses people have made
  public for paygated and non paygated courses."* Everything else here is a question, not a
  requirement.
- **Check what already exists first.** The course-publishing effort shipped a
  `publishedEditions` table, owner-only publish mutations, a per-edition Publish toggle, and an
  available-courses section on the signed-in home. A discover page may be a *query and a
  route* on top of that, not a new subsystem — see
  [course-publishing](../../course-publishing/map.md).
- **Signed-in vs anonymous is the first fork.** The existing catalogue sits behind the app
  gate; a landing-page discover surface is for people with no account, which changes the read
  seam and the privacy story.
- Whitelabel: does a tenant subdomain's discover page list that tenant's courses only, or
  everything? The tenant-scope decision on
  [course-publishing](../../course-publishing/map.md) already has an answer to reuse.
- Adjacent: [Feature the paygate on the landing page](04-feature-paygate-on-landing.md)
  markets the paygate; this lists the actual courses.
- Skills: `/grilling`, `/ponytail` (this may be much smaller than it sounds).
- **Fog:** ranking, search, and filtering — real questions at scale, meaningless at four
  tenants. Deliberately not ticketed yet.
- **Out of scope:** the publish mechanics — already shipped on
  [course-publishing](../../course-publishing/map.md).
