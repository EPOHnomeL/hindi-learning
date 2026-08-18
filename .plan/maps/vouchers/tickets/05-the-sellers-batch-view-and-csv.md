---
type: task
blocked_by: [02]
---
# The Seller's batch view and CSV

## Question

Can a Seller get the codes out of the platform and into the organisation's hands, and answer "how
many have been used?" without being able to answer "by whom?"

The Seller needs three things and no more: the list of batches they have minted, the take-up count
per batch, and the codes as a file they can print, mail-merge, or paste into whatever channel the
organisation already uses. The platform **sends nothing to anyone** — it has no member addresses,
which is the entire point of the feature, so delivery is the organisation's job and the Seller's
hand-off is a download.

The count is **derived** by counting voucher rows with a `redeemedAt`. There is no counter field to
drift out of step with reality.

The payment state belongs on this view too, stated plainly rather than implied: a Seller looking at
a batch whose cash has not been logged should understand that their share is not payable yet and
why, instead of filing a support question about a missing payout.

Note what the Seller cannot see, and do not add it out of helpfulness: **who** redeemed. It is not
recorded ([ADR 0029](../../../../docs/adr/0029-seller-minted-voucher-rail.md)), so there is nothing
to show — but a well-meaning join onto `entitlements` by Edition would approximate it, and must not
be written.

`/ponytail` this one. A CSV is a string with commas and newlines; it does not need a library, and
the download does not need a route if a client-side blob will do.

## Done when

- `vouchers.myBatches` returns the caller's own batches with the Edition, seat count, total,
  organisation details, derived redeemed count, and payment state. It returns nothing for another
  Seller's batches.
- `vouchers.batchCodes` returns the codes for one batch **the caller minted**, and throws for
  another Seller's batch — asserted as a server-side negative.
- A batch section in the Seller's existing selling area: the mint form (ticket 02's mutation), the
  list with counts and payment state, and a CSV download per batch.
- The CSV opens in a spreadsheet and mail-merges: one code per row, with the course and language so
  a printed card can say what it unlocks.
- No query anywhere in this ticket returns or infers who redeemed a code.

## Answer
