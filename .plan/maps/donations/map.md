# Donations

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

A decision on whether and how the site invites donations — an external link or a real
in-app rail, and which surfaces ask — captured well enough to build or to drop.

## Notes

- The ask, verbatim: *"Want to link where to donate to the site if users want to. Maybe make
  it a popup on public links for sites."* Two separable ideas in one sentence — the
  destination (where money goes) and the prompt (where it's asked for).
- **Ponytail posture strongly applies.** An external donation link is a hyperlink. An in-app
  donation rail is a payment integration with a payout story, tax questions, and a refund
  policy. Establish which one is actually wanted *first* — this is the whole grilling.
- Payment rails already exist here (PayFast checkout, and the manual EFT rail from the
  ywampotch launch). If a real rail is wanted, reuse, don't invent.
- A donation prompt on a Public link is aimed at a **Guest** — an anonymous, unauthenticated
  reader. That constrains anything involving an account.
- Per-tenant question: does a YWAM Potch public link solicit donations for YWAM Potch or for
  the platform? This decides whether it is one feature or a tenant-configured one.
- Skills: `/grilling`, `/ponytail`.

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

## Out of scope

- Paid course sales — that is the marketplace
  ([paid-marketplace](../paid-marketplace/map.md)), a different transaction with a different
  legal shape.
