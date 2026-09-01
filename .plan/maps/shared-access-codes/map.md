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

- **Moved out 2026-09-01** in the `.plan` consolidation, which took 33 map directories
  down to 7 active maps. Ticket 05 (the `/join` page) is now
  [distribution/07](../distribution/tickets/07-the-join-page.md). It is **code-built and
  holds open for a browser walk**, which is what its own `## Progress` section says, and two
  lines of its `## Done when` are superseded rather than unbuilt (the separate consent step
  went on 2026-08-26; a linked code skips the code step). Its `blocked_by: [04]` was dropped
  rather than lost: ticket 04 here is resolved and stayed. The ten resolved tickets stay, so
  this map is closed.

  Renumbering was forced: `blocked_by` is map-local and the numbers collided across the
  donor maps. **Do not reuse the old numbers here**, they remain those tickets' identity in
  this map's history, and do not mint a replacement for a moved ticket.

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
- **Trap 1 from [vouchers ticket 11](../distribution/tickets/05-guest-redemption-and-saving-it-to-an-account.md)
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
- **The rail is built and green (2026-08-25): 26 tests in `convex/accessCodes.test.ts`, the whole
  suite at 918, `next build` clean, and `/join` a real route. One thing is outstanding and it is a
  Done-when condition, not a nicety: [05](tickets/05-the-join-page.md) has never been WALKED in a
  browser.** Nothing was listening on port 3000 in the building session and this repo never starts a
  dev server, so ticket 05 is deliberately left OPEN with a `## Progress` section instead of an
  `## Answer`. The map records elsewhere that "test-covered and read correct" is not the same claim
  as "somebody clicked it", and this rail's first user is a stranger with no account, so that walk
  is the last gate.

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
- **[02](tickets/02-mint-an-access-code.md) A Seller mints one capped, priced code.**
  `convex/accessCodes.ts` plus `accessCodeFormat.ts`. `GRP-7K4-Q2X-9MB`, a different *shape* from a
  voucher's `MYC-7K4Q-2XR9` because both rails can be live on one Edition, and 32^9 of entropy
  because a guessed Access Code grants seats up to the cap. **No Ledger row at mint.**
  `sellableTopic` is shared with `vouchers.ts` rather than copied.
- **[03](tickets/03-a-member-joins-and-is-in-the-course.md) A member joins with a nickname and a
  PIN, and no email exists anywhere.** A `ConvexCredentials` provider on
  `${accessCodeId}:${nicknameKey}`, an internal `claimSeat` that consumes the cap and mints the Seat
  and the Entitlement in one transaction, and the `createOrUpdateUser` branch that keeps trap 1
  shut. Three joins assert three accounts. The Entitlement's key set is pinned. `lucia` became a
  direct dependency for one scrypt import, and `AccessCode` needs an explicit
  `ConvexCredentialsConfig` annotation or the whole generated api collapses to `any`.
- **[04](tickets/04-return-to-a-seat-on-another-device.md) Returning costs no seat, and the PIN
  actually holds.** The return branch writes nothing, so "no seat consumed" is true by construction.
  Rate limiting is the library's own, keyed on the `authAccounts` row, which is exactly
  `(accessCodeId, nicknameKey)`: asserted to refuse the *right* PIN while it holds, and to leave
  another member on the same code signing in.
- **[06](tickets/06-stop-a-code-and-bill-what-it-used.md) Stopping is the money event.** One Ledger
  row of `seats x price` at `unpaid`, `kind: "batch"`, in the same mutation as `stoppedAt`. Zero
  seats writes none. Stopping twice is refused and there is no restart. `ledger.ts` and `sales.ts`
  were **not edited**, and the tests assert the exclusions rather than trusting them.
- **[07](tickets/07-the-operator-settles-a-stopped-code.md) The operator settles it the way they
  settle everything else.** `pendingAccessCodes` beside the EFT and batch queues in the Payouts tab,
  returning no code, no nickname and no userId (enforced in the returns validator, asserted by
  serialising the result). `logAccessCodePayment` is idempotent and flips the row to `owed`. **No
  invoice document is generated**, deliberately.
- **[08](tickets/08-the-sellers-access-code-section.md) The Seller's section, with no roster in
  it.** In the Editions dialog beside the voucher section: take-up, running total, the join URL from
  the browser's own origin, a cap raise that is absent rather than disabled on a stopped code, and a
  stop confirm that says in plain words that it bills and does not revoke. No nickname can appear
  here because no query can return one.
- **[09](tickets/09-say-what-we-hold-and-in-the-glossary.md) What we hold, said in four places and
  gated.** Versioned wording in `convex/joinConsent.ts` (append only), rendered translated by
  `/join`, with `messages/consent.test.ts` pinning the English word for word so the two copies
  cannot drift. Plus the privacy policy's own heading for the Seat, `CONTEXT.md`'s **Access Code**
  and **Seat**, and a dated two-rails section in `project-context.md`.
- **[10](tickets/10-change-a-pin.md) A change, never a reset.** `changePin` demands the old PIN,
  takes no seat argument (the Seat comes from `ctx.auth`), and goes through `retrieveAccount` so it
  shares sign-in's rate limit. Asserted by locking it out and then finding sign-in locked too.
- **[11](tickets/11-delete-a-seat.md) A withdrawal strips the row rather than deleting it.**
  `userId` and `nicknameKey` go, `consentedAt` and `consentVersion` stay, so what carries the count
  is not personal information and the bill cannot move under an operator who already raised it. The
  `authAccounts` row goes too, which kills the credential, and the honest consequence is that the
  member keeps the course only on the device they are holding. The nickname is freed for reuse,
  because retirement means keeping the handle.

## Not yet specified

- **Giving up the course, as a choice separate from withdrawing.** Deleting a Seat removes the
  personal link and deliberately leaves the Entitlement, so a member who withdraws keeps the
  course on the device they are holding and can never sign in elsewhere. Ticket 11 asked for
  "losing access" to be a *separate choice* and only the narration shipped, not a second button.
  Nobody has asked for it and stopping reading is free, so it is a small follow-up rather than a
  gap in the rail. Named here because the ticket's Answer overclaimed it before `/code-review`
  caught it.

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
