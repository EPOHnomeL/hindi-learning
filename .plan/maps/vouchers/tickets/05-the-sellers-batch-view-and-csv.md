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
organisation already uses. The platform **sends nothing to anyone** - it has no member addresses,
which is the entire point of the feature, so delivery is the organisation's job and the Seller's
hand-off is a download.

The count is **derived** by counting voucher rows with a `redeemedAt`. There is no counter field to
drift out of step with reality.

The payment state belongs on this view too, stated plainly rather than implied: a Seller looking at
a batch whose cash has not been logged should understand that their share is not payable yet and
why, instead of filing a support question about a missing payout.

Note what the Seller cannot see, and do not add it out of helpfulness: **who** redeemed. It is not
recorded ([ADR 0029](../../../../docs/adr/0029-seller-minted-voucher-rail.md)), so there is nothing
to show - but a well-meaning join onto `entitlements` by Edition would approximate it, and must not
be written.

`/ponytail` this one. A CSV is a string with commas and newlines; it does not need a library, and
the download does not need a route if a client-side blob will do.

## Done when

- `vouchers.myBatches` returns the caller's own batches with the Edition, seat count, total,
  organisation details, derived redeemed count, and payment state. It returns nothing for another
  Seller's batches.
- `vouchers.batchCodes` returns the codes for one batch **the caller minted**, and throws for
  another Seller's batch - asserted as a server-side negative.
- A batch section in the Seller's existing selling area: the mint form (ticket 02's mutation), the
  list with counts and payment state, and a CSV download per batch.
- The CSV opens in a spreadsheet and mail-merges: one code per row, with the course and language so
  a printed card can say what it unlocks.
- No query anywhere in this ticket returns or infers who redeemed a code.

## Answer

**Done 2026-08-18. Verified by reading the code and by a green suite**; the CSV download and the
batch section were exercised in the dev app while walking ticket 06, but the Seller's own view was
not clicked through end to end in a browser - it is composed of the same controls as the price
editor beside it.

`vouchers.myBatches` returns the caller's own batches with the Edition, seat count, total,
organisation details, a **derived** redeemed count (voucher rows carrying a `redeemedAt`, so there
is no counter to drift) and `paymentRef` - null while the cash has not been logged, which is the
whole of "is my share payable". `vouchers.batchCodes` refuses any batch the caller did not mint,
asserted server-side for another Seller, a Guest and the sysadmin alike.

The UI is a batch section under the price control in the Editions dialog, gated on the same
`sellerStatus === "ready"` the mint mutation enforces, with the mint form, the list with counts and
payment state, and a per-batch CSV download. `/ponytail` held: the CSV is a string with commas and
newlines built client-side, the download is a blob, and there is no library and no route.

**Two judgement calls worth naming.** The codes are fetched on the download click rather than
subscribed to, because a page that holds every code of every batch open is a page that leaks them
into a screen-share. And the payment state is stated in a full sentence rather than as a badge,
because the Seller's actual question is "why has nobody paid me" and a badge does not answer it.

Nothing in this ticket returns or infers who redeemed. The tempting query - joining `entitlements`
by Edition to approximate it - is named in the code comments as the thing that must not be written.
