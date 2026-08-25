# Shared Access Codes

<!-- Charted 2026-08-23 from a /grilling session the same day, a /research pass against
     primary sources, and /to-spec. The build contract is spec.md beside this file. -->

## Destination

An organisation buys course access with **one shared code** instead of N: the Seller mints a
capped, priced Access Code for one Edition, the organisation broadcasts it, and each member joins
with a nickname of their own choosing and a PIN, never an email. The Seller stops the code when the
agreement ends, and the organisation is billed for the seats actually taken, settled on the
existing manual EFT rail. Built, walked in a browser, and legitimate under a superseding ADR.

## Notes

- **This map carries implementation tickets, deliberately.** wayfinder's default is plan-don't-do;
  the override applies because the planning finished in the grilling and research that produced
  [spec.md](spec.md). Ticket 01 is the one exception: it is a decision artifact, and it gates
  every build ticket below it.
- **Read [spec.md](spec.md) and then [ADR 0029](../../../docs/adr/0029-seller-minted-voucher-rail.md)
  before touching any ticket.** This rail does two things ADR 0029 explicitly refused: one code with
  N uses, which sits in that ADR's *Considered and rejected*, and a stored link between a person and
  the organisation that paid for them, which is its decision 3. Neither is an oversight here and
  neither may be built before ticket 01 lands.
- **The voucher rail is not being replaced.** `.plan/maps/vouchers/` shipped and stays shipped. This
  is a second rail beside it, for a buyer who wants one code and a bill at the end rather than N
  codes and a bill upfront.
- **The evidence is in
  [`.plan/research/2026-08-23-shared-code-nameless-identity.md`](../../research/2026-08-23-shared-code-nameless-identity.md)**,
  and three of its findings are load-bearing. A capped shared code **cannot** store nothing, because
  counting returning members is itself the identifier. A self-chosen nickname is the POPIA
  mitigation and is not cosmetic: if the UI ever nudges members toward their real name, the
  mitigation is gone. And PayFast has no invoicing product at all, which is why settlement reuses
  the manual EFT rail.
- **The nickname is never a real name, in the copy as well as the code.** Any ticket touching
  `/join` copy is touching a compliance control.
- **Trap 1 from [vouchers ticket 11](../vouchers/tickets/11-guest-redemption-and-saving-it-to-an-account.md)
  is live and was re-verified against `@convex-dev/auth@0.0.80` on 2026-08-23.** A provider that
  supplies no email makes `createOrUpdateUser` insert `email: ""`, and the second such member signs
  in as the first. It fails silently and looks correct with one tester. Trap 2 does not apply to
  this rail, because a Seat never links to a Google or Password account.
- **`convex/eft.test.ts` and `convex/vouchers.test.ts` are the prior art for every test here**:
  `convexTest` at the public function boundary, authorisation negatives asserted server-side, and
  fixtures seeded only as production writes them. Never hand-insert an `accessCodes` or `seats` row.
- **`convex/lib.ts`'s grant walk should need no change.** Joining mints an ordinary Entitlement and
  the walk already treats its presence as access. A ticket editing the walk means the design has
  drifted.
- Skills: `/tdd` (every ticket carries its assertions), `/ponytail` (05, 07 and 08 are all smaller
  than they sound).

## Decisions so far

<!-- the index over resolved tickets: one line each, zoom the link for the detail.
     Open build tickets are never listed here; the frontier is derived, not written. -->

- **[01](tickets/01-supersede-adr-0029-for-shared-capped-codes.md) The rail is legitimate.**
  [ADR 0031](../../../docs/adr/0031-shared-capped-access-codes-and-nickname-seats.md) supersedes
  ADR 0029 in part: the rejection of one-code-with-N-uses, and decision 3's "records nothing about
  who redeemed". Nothing else in 0029 moved, and 0029 was not rewritten. It also settles the one
  thing the spec left implicit: the credentials provider takes a `flow` of `"join"` or `"return"`,
  because without a declared intent `access/nickname-taken` and `access/pin-wrong` are the same
  request.

## Not yet specified

- **Nobody has priced the support burden of an unrecoverable PIN.** The design promises, in writing
  on the join page, that a forgotten PIN cannot be recovered by anybody. That is true and it is the
  cost of having no second channel. What is unknown is how often it happens at the scale of a
  political party's membership, and what the operator says when the party escalates it. If the
  answer turns out to be "constantly", the rail needs a second channel and a second channel is an
  email address, which reopens the whole design.
- **What the organisation is told, and by whom.** The Seller reports take-up by hand, as they do for
  batches. A shareable read-only count is the obvious next ask and the first step towards the
  organisation entity ADR 0029 refused. Shared with the vouchers map, which carries the same patch.
- **Does a settled Access Code count as revenue in the sales report?** Inherited unchanged from the
  vouchers map: `salesOnly` excludes batch rows, which is right while unpaid and arguably wrong once
  the cash is logged. An Access Code's row is a per-seat total rather than a negotiated lump, so it
  may answer more easily than a batch's does.
- **Whether a legal opinion changes the shape.** The POPIA position rests on Information Regulator
  guidance notes and a third-party reproduction of the Act, because the Act's own PDFs would not
  text-extract and SAFLII returned 403. The consent design is built to the strictest reading, so an
  opinion is more likely to relax it than tighten it, but that is an assumption and not a finding.

## Out of scope

Everything in [spec.md](spec.md)'s Out of Scope, and in particular: replacing the voucher rail,
generating any invoice document or serial series, PayFast or Stripe for this rail, certificates on
Access Code seats, passkeys, linking a Seat to a Google or Password account, any PIN reset or seat
recovery, an organisation entity or login, restarting a stopped code, and per-seat expiry.
