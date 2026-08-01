---
type: grilling
blocked_by: []
---

# Dontation functionality

## Question

Want to link where to donate to the site if users want to. Maybe make it a popup on public links for sites.

## Done when

A decision on where a donation goes (external link vs an in-app rail), which surfaces prompt for it, and whether any payment plumbing is involved — written down, then ticketed or ruled out.

<!-- Migrated 2026-07-30 from GitHub issue #45 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->

---

## Context folded from the retired `donations` map (2026-08-01)

<!-- was .plan/maps/marketplace/tickets/03-donation-link-and-prompt.md; that single-ticket map was consolidated into marketplace -->

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
- **Out of scope:** paid course sales — that is the marketplace paygate
  ([Authoring-cost funding & model-provider strategy](01-authoring-cost-and-model-provider-strategy.md)
  and ADR 0016), a different transaction with a different legal shape.
