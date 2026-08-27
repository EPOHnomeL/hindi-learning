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

## Answer

Decided 2026-08-27 by grilling the operator against ticket 14's counts, ADR 0029,
ADR 0031 and the `EditionPanel` render at
[Editions.tsx:297-322](../../../../src/app/_components/Editions.tsx#L297-L322).
**Decided, NOT built.** Ticket 19 ships it.

### The panel is six cards, and two of them are already conditional

`EditionPanel` renders, in order: `InviteByEmail`, `PublishToggle`,
`PublicLinkToggle`, the Topic-level `TeacherQaToggle` on the source tab,
`SellEdition`, then `VoucherBatches` and `AccessCodes` behind a `completed` gate.
Both voucher components return `null` outright unless `sellerStatus === "ready"`,
so the six-card panel the ticket describes is what a granted Seller sees. Everyone
else already sees four, one of which is a dashed setup prompt.

That matters more than it sounds. `SellEdition` renders `PayoutDetailsForm` inside
itself, so for a non-Seller the sell rail *is* the setup form. Pulling seller and
payout setup out of the rails is not tidying. It is the move that makes a sell group
collapsible at all, because today collapsing it would hide the only path to becoming
a Seller.

### Verdicts

| Rail | Verdict | Why |
| --- | --- | --- |
| Publish to catalogue | **Visible**, in its own group | 4 Topics, and 3 of 8 rows flipped back to `false`, so owners work this control both ways |
| Public link | **Visible** | The broadest rail on the panel: 19 Topics on English plus 3 on translations |
| Invite by email | **Visible** | 68 Shares over 14 Topics, 25 of them `editor`. The most-used rail, and the roster rides with it |
| Set a price | **Visible to a ready Seller, inside the group-3 disclosure otherwise** | 1 Topic priced, but 17 paid seats. Every rand the platform has earned came through here |
| Bulk Vouchers | **Merged into one voucher control, as a mode** | Never minted outside `test-course` |
| Organisation Voucher | **Merged into one voucher control, as the other mode** | 1 real customer, 2 seats taken, the freshest activity on the panel at 2026-08-25 |
| Free self-enroll | **No card today and none added here** | It has never had a control. Enrollment is a consequence of Publish plus no price, so there is nothing on this surface to retire. Ticket 21 decides whether the path is broken; if it is, the fix ticket that follows 21 owns whatever control it needs, and that is not a rail retirement |

Nothing is retired from the UI, which makes the map's Out of scope line about tearing
down a retired rail's backend moot rather than wrong. Teacher Q&A and the access
roster are not rails. Both are ticket 17's to place.

### The two voucher rails collapse into one control with a mode

I argued for retiring Bulk Vouchers outright. One batch ever minted, on
`test-course`, and the political party ADR 0029 was written for came back on
2026-08-23 asking for the other rail instead, which is about as clear a verdict as
usage evidence gets. The operator overruled it, and the reason holds up: a buyer who
wants N codes billed upfront is a deal the platform can still close, and dropping the
control means minting by hand for the next one. So both survive as modes of a single
card, and I am recording the cost rather than pretending there is none.

**The mode axis is distribution, not billing.** ADR 0031's Context puts the party's
two asks in order, and distribution comes first: they wanted one thing to broadcast
to a WhatsApp group, the way a Kahoot PIN works. Money was the second ask. So the
owner picks between:

- **One shared code**, which is the Organisation Voucher. Capped seats, members join
  with a nickname and a PIN, billed for the seats taken when the owner stops it.
- **One code each**, which is Bulk Vouchers. N single-use codes, billed upfront for
  the whole batch.

Each mode's copy states its billing as a consequence of the distribution choice, so
the owner never picks between "upfront" and "post-paid" in the abstract. That framing
is mine, taken from ADR 0031's own ordering, and it is the reason the merge does not
read as an accounting question.

**The mode picker must disclose the identity difference in one line each.** This is
the sharpest consequence of merging and it is easy to lose. A Bulk Voucher redemption
records `redeemedAt` and nothing else (ADR 0029 decision 3). An Organisation Voucher
writes a `seats` row carrying a self-chosen nickname, a POPIA s27(1)(a) consent stamp
and its wording version (ADR 0031, and the whole reason 0031 supersedes 0029 in part).
One radio button now decides whether the buyer's members consent to anything and
whether a roster of handles exists. The owner signed the deal and is the only person
who can answer for that, so the picker tells them. Two short lines, not a link to an
ADR.

The backends stay two backends. `voucherBatches` and `accessCodes` are untouched, per
the map's Out of scope.

### Groups the owner reads

Three, each a question rather than a category, because a category invites the reader
to work out which bucket a control falls in and a question does not.

1. **Who can find it** holds Publish alone. It is a thin group and I considered folding
   it into give-it-away, which was the operator's original prior. It cannot go there.
   [CONTEXT.md:51](../../../../CONTEXT.md#L51) says Publishing is "orthogonal to price,
   and never an acquisition gate": a priced published Edition is listed *and*
   paygated. Filing Publish under give-it-away is false for `prophetic-school`, the
   one course that earns money. Whatever ticket 17 rules as a discovery control has an
   obvious home here.
2. **Who you hand it to** holds Public link and Invite, with the access roster under
   them. Both grant one Edition to a named or token-bearing reader, which is one act
   with two credentials.
3. **What it costs** holds the price control and the voucher control. For anyone who
   is not a ready Seller it is one collapsed row saying selling is off, and the seller
   grant and payout details live inside that row rather than inside the price card.

### The words

Seven nouns go down to four, and the glossary is the tiebreak throughout.

- **Publish** stays. [CONTEXT.md:46-52](../../../../CONTEXT.md#L46-L52) warns that
  "publish" unqualified collides with the teach-to-Hub push, but that push has no
  control in this dialog, and the group heading carries the disambiguation. Its Avoid
  list rules out "List", which belongs to the price row.
- **Public link** stays verbatim. It is the glossary's own term and its Avoid list
  kills "public share".
- **Invite** stays as a verb on a button, never as a noun. A pending invite is still a
  Share ([CONTEXT.md:92](../../../../CONTEXT.md#L92)), so the surface never says "an
  invite" and never implies a second kind of grant.
- **Price** is what the owner sets. The glossary's noun for the row is Listing, which
  it also warns reads as catalogue listing, so it stays out of owner-facing copy.
- **Voucher** is the one bulk noun, which the glossary already makes the parent of both
  rails ([CONTEXT.md:202](../../../../CONTEXT.md#L202)).

**Batch** and **access code** both retire from owner-facing copy. "Batch" becomes the
"one code each" mode and "access code" becomes "one shared code". Both keep their
glossary entries and their table names, exactly the split ADR 0031 already made on
2026-08-25 when it named the product Organisation Voucher while leaving `accessCodes`
alone. Ticket 19 carries the CONTEXT.md edit that adds the two mode names to the Avoid
lists on the Bulk Vouchers and Organisation Voucher entries, since a word this surface
stops saying should not stay listed as the word it says.

### Correction to ticket 14, same date

Ticket 14's answer reads the `topics.publicToken` versus `publicLinks` split as
legacy storage against new, and calls retiring the legacy field a data migration. It
is neither legacy nor a migration. `shares.setEditionPublic` branches on
`lang === SOURCE_LANG`: English writes `topics.publicToken`, every translation writes a
`publicLinks` row. Both shapes are current and one control writes both. The 19-to-3
gap just says 19 owners shared English and 3 shared a translation. `setTopicPublic`
still exists but only tests call it. Corrected on ticket 14 in the same commit as this
answer.
