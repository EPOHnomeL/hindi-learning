---
type: grilling
blocked_by: [14]
---
# Which of the six share and sell rails survive, and what does the owner call them

> `/wayfinder .plan/maps/ui-overhaul/tickets/15-which-rails-survive.md`

## Question

`Editions.tsx` presents six rails as six sibling cards of equal weight, which is
why the panel reads as noise. Two of them are voucher rails that a reader cannot tell
apart without opening ADR 0029 and ADR 0031. Decide, with ticket 14's usage counts in
hand:

- Which rails stay visible to every owner, which hide behind a disclosure, and which
  are retired from the UI.
- Whether the two voucher rails collapse into one control with a mode, stay two cards,
  or one of them goes away. Their backends are genuinely different. One bills N codes
  upfront, the other bills the seats a shared code actually took.
- The grouping an owner reads. My prior is two groups, give it away and sell it, with
  seller and payout setup pulled out of both. Argue me out of it if the counts say
  otherwise.
- The words. Publish, public link, invite, sell, voucher, batch and access code are
  seven nouns for one act, and the glossary in CONTEXT.md is the tiebreak.

Two facts from ticket 14 bear on the verdicts and are easy to misread. The voucher
rail has never been used outside `test-course`, so it is a candidate for retirement on
usage grounds alone. Free self-enroll has granted nobody anything, but ticket 21 is
open on whether that path is broken rather than unwanted, so do not read its zero as
demand until 21 lands.

Read ADR 0029 and ADR 0031 before proposing any merge. Both encode choices that look
like bugs to a fresh reader, and a redemption deliberately records nothing about who
redeemed.

## Done when

The Answer lists every rail with a verdict of visible, disclosed or retired, settles
the two-voucher question, names the groups and the label each group carries. Retiring
a rail from the UI is in scope. Deleting its Convex tables and mutations is not, so
any teardown the verdict implies is named as a follow-up effort rather than done here.
