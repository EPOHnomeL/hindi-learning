# Marketplace / discover

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

A spec for the surface where a visitor **finds** courses other people have published — paid
and free — and how it relates to the tenant catalogue that already ships.

## Notes

- The ask is one line: *"Add to the landing page or another page, courses people have made
  public for paygated and non paygated courses."* Everything else here is a question, not a
  requirement.
- **Check what already exists first.** The course-publishing effort shipped a
  `publishedEditions` table, owner-only publish mutations, a per-edition Publish toggle, and an
  available-courses section on the signed-in home. A discover page may be a *query and a
  route* on top of that, not a new subsystem — see
  [course-publishing](../course-publishing/map.md).
- **Signed-in vs anonymous is the first fork.** The existing catalogue sits behind the app
  gate; a landing-page discover surface is for people with no account, which changes the read
  seam and the privacy story.
- Whitelabel: does a tenant subdomain's discover page list that tenant's courses only, or
  everything? The tenant-scope decision on
  [course-publishing](../course-publishing/map.md) already has an answer to reuse.
- Adjacent: [landing-page/02](../landing-page/tickets/02-feature-paygate-on-landing.md)
  markets the paygate; this lists the actual courses.
- Skills: `/grilling`, `/ponytail` (this may be much smaller than it sounds).

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

- **Ranking, search, and filtering.** Real questions at scale, meaningless at four tenants.
  Deliberately not ticketed yet.

## Out of scope

- The publish mechanics — already shipped on
  [course-publishing](../course-publishing/map.md).
