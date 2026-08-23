# Spec: one shared Access Code, nickname seats, invoiced on what was used

Written 2026-08-23, from a `/grilling` session the same day. Evidence for the identity and
billing choices is in
[`.plan/research/2026-08-23-shared-code-nameless-identity.md`](../../research/2026-08-23-shared-code-nameless-identity.md).

**This spec reverses two decisions in [ADR 0029](../../../docs/adr/0029-seller-minted-voucher-rail.md)
and cannot be built until a superseding ADR is written.** ADR 0029 lists "One code with N uses"
under *Considered and rejected*, and its decision 3 is that a redemption records nothing about who
redeemed. This spec does both. The existing single-use voucher rail is **not** replaced; it stays
exactly as shipped, and this is a second rail beside it.

## Problem Statement

A political party will buy course access for its people, and two things about the deal do not fit
the voucher rail that was built for it.

**Distribution.** Handing out N distinct codes means tracking which person got which code. The
party runs on WhatsApp groups and public meetings, and it wants to broadcast one thing that works
for everybody, the way a Kahoot PIN or a Moodle enrolment key does. N single-use codes are N
objects to distribute and reconcile; the party wants one.

**Money.** The party does not know how many of its people will take the course. Buying 500 seats
upfront risks paying for 300 that go unused; buying 300 risks running out mid-campaign. It wants
to run the code for the length of the agreement, stop it, and be billed for what was actually
taken.

There is also a problem the members have. Under the current rail a member must create an account
with an email address before a code their organisation already paid for will do anything. The
operator's verdict when walking `/redeem` on 2026-08-18 was that this is too much ceremony, and
the party's members are the least likely population to push through it.

## Solution

A **Seller** mints one **Access Code** for one **Edition** of their own course: one shared string,
a seat cap agreed with the organisation, and a per-seat price. The organisation broadcasts that
one code however it likes.

A member goes to `/join`, types the code, chooses **any nickname they like** and a **PIN**, and is
in the course. No email, ever. Returning on another phone, they type the same three things and
land back in the same seat with their progress intact.

The code stops granting new seats when the cap is reached. The Seller stops it by hand when the
agreement ends. **Stopping the code is what creates the money event**: one Ledger row for
`seats consumed x per-seat price`, held `unpaid`, appearing in the admin portal's existing payouts
queue where the operator matches a bank reference exactly as they do for an EFT today. Seats
already taken keep working forever; stopping ends new joins only.

Three things about this are deliberate and each looks wrong without the reasoning:

1. **The nickname need not be a real name, and the page says so in those words.** This is the
   Kahoot model, and it is also the POPIA mitigation. A stored real name beside a political
   party's cohort is special personal information under s26 via s1(h); a self-chosen handle is
   materially weaker on that limb. It does not remove the need for consent, because the seat row
   is still a `unique identifier` under s1, but it removes the worst of it.
2. **Consent is captured explicitly at join, before the nickname box.** POPIA s27(1)(a) is the
   exception this whole design rests on, and s11(2) puts the burden of proving consent on us.
3. **The Ledger row is written on stop, not on creation.** The voucher rail writes its row at
   mint, because a batch's total is known then. An Access Code's total is unknown until it stops,
   so there is nothing to write until then.

## User Stories

### The Seller

1. As a Seller, I want to mint one Access Code for an Edition I own, so that the organisation has a single thing to broadcast.
2. As a Seller, I want to set a seat cap on the code, so that a forwarded code cannot run up a bill the organisation will refuse to pay.
3. As a Seller, I want to set the per-seat price I negotiated, so that a bulk deal is priced by the person who negotiated it and not by the Edition's listing price.
4. As a Seller, I want to record the organisation's name and billing contact on the code, so that the operator knows who to invoice when it stops.
5. As a Seller, I want to see how many seats have been taken, live, so that I can tell the organisation where they stand.
6. As a Seller, I want to see how much the code has run up so far, so that the bill is never a surprise.
7. As a Seller, I want to raise the cap on a running code, so that an organisation that fills it can carry on without a new code.
8. As a Seller, I want to stop a code, so that the agreement can end.
9. As a Seller, I want to be told in plain words, at the confirm, that stopping bills the organisation for the seats taken and does not revoke them, so that I never mistake stopping for a refund.
10. As a Seller, I want a code I stopped to stay stopped, so that a late forward cannot reopen the bill.
11. As a Seller, I want the join URL beside the code, so that I can hand the organisation something that works in a WhatsApp broadcast.
12. As a Seller, I want to mint more than one Access Code for the same Edition, so that two organisations are billed separately.
13. As a Seller, I must never see the nicknames on my own code, so that the promise made to the organisation's members holds against me too.

### The member

14. As a member, I want to type one code my organisation gave me and reach the course, so that access costs me nothing but the code.
15. As a member, I want to choose any nickname I like, and to be told plainly that it need not be my real name, so that taking the course discloses nothing about me.
16. As a member, I want to choose a PIN, so that nobody else holding the same code can walk into my seat.
17. As a member, I want to be asked for consent before I type anything, in words I can understand, so that I know what is being stored and why.
18. As a member, I want to refuse consent and still be told what my options are, so that refusing is a real choice.
19. As a member, I want to come back on a different phone with the same code, nickname and PIN, so that changing device does not cost me my progress.
20. As a member, I want to be told my nickname is already taken on this code and be asked for another, so that I am not silently signed into a stranger's seat.
21. As a member, I want a wrong PIN to be refused, so that my seat is mine.
22. As a member, I want to be told when a code has reached its cap, distinguishably from a code that never existed, so that I know to ask my organisation rather than re-check my typing.
23. As a member, I want to be told when a code has been stopped, so that I know the reason is the agreement and not my typing.
24. As a member, I want a stopped code to keep letting me back into a seat I already hold, so that stopping the deal does not take away what I was given.
25. As a member, I want to be warned that a forgotten PIN cannot be recovered by anybody, so that I take writing it down seriously.
26. As a member, I want my progress kept against my seat, so that a long course survives being put down.
27. As a member, I want to change my PIN while signed in, so that a PIN I typed in front of somebody is not permanent.
28. As a member holding a seat, I want the app never to ask me for an email, so that the promise is visible in the product and not only in a policy.

### The operator

29. As the operator, I want a stopped Access Code to appear in the payouts queue beside pending EFT intents, so that settling it is the same job I already do.
30. As the operator, I want the queue line to carry the organisation name, the billing contact, the seat count, the per-seat price and the total, so that I can raise an invoice without opening anything else.
31. As the operator, I want to log a bank reference against a stopped code, so that the Seller becomes payable exactly as they do on every other rail.
32. As the operator, I want logging the same reference twice to be harmless, so that a double click costs nothing.
33. As the operator, I want an unpaid Access Code excluded from the sales report and from owed payouts, so that money that has not arrived is never counted or paid out.
34. As the operator, I must never see which nickname belongs to which person, and there must be nothing in the database that says so, so that the promise is a fact about the schema and not a policy about my behaviour.
35. As the operator, I want a code that was stopped with zero seats taken to settle to nothing without paperwork, so that a deal that went nowhere costs no admin.

### Privacy and compliance

36. As the operator, I want the consent the member gave recorded against their seat with the wording and the timestamp, so that s11(2)'s burden of proof is discharged.
37. As the operator, I want the privacy policy to describe this seat type, so that what we hold is disclosed where POPIA expects it.
38. As a member, I want to be able to ask for my seat to be deleted, so that s11's withdrawal right is real.
39. As the operator, I want deleting a seat to leave the seat count untouched, so that a withdrawal does not silently reduce a bill that was already agreed.

## Implementation Decisions

### Vocabulary

Two new domain terms, to be added to `CONTEXT.md`:

- **Access Code**: one shared, multi-use, capped code for one Edition, minted by that Edition's Seller, carrying a per-seat price and an organisation's billing details. Distinct from a **Voucher**, which is single-use and belongs to a **Voucher Batch**.
- **Seat**: one nickname-and-PIN identity created against an Access Code. Consuming a Seat is what decrements the cap; signing back into an existing Seat does not.

The existing terms are unchanged and used as they stand: Seller, Edition, Entitlement, Ledger, Topic.

### Schema

Two new tables. Both mirror `voucherBatches` deliberately, so the shapes read as siblings.

**`accessCodes`**: `topicId`, `lang`, `sellerId`, `code`, `capacity` (number), `pricePerSeat`
(cents, ZAR), `orgName`, `orgContact`, `stoppedAt` (optional), `ledgerId` (optional, absent until
stopped), `paymentRef` (optional). Indexes: `by_code` for the join lookup, `by_seller` for the
Seller's list, `by_payment_ref` for the unpaid queue read at `eq(undefined)`, matching how
`voucherBatches` finds its pending rows.

**`seats`**: `accessCodeId`, `userId`, `nicknameKey` (the normalised nickname, trimmed and
lower-cased), `consentedAt`, `consentVersion`. Index `by_code_and_nickname` on
`[accessCodeId, nicknameKey]` for the sign-in lookup and the uniqueness check, and `by_code` for
the derived count.

The seat count is **derived** by reading `by_code`, never stored as a counter on `accessCodes`. A
stored count is a second copy of the truth and drifts; this repo already made that choice for the
voucher take-up count.

**The PIN is never stored by us.** It is the `secret` handed to Convex Auth's `createAccount`,
which hashes it with the library's own scrypt, exactly as the Password provider does. Nothing in
`seats` can verify a PIN.

**`seats.userId` is the link ADR 0029 refused.** It is the whole reason a superseding ADR is
required, and it must be named as such in that ADR rather than slipped in. What limits the damage
is that the row holds a self-chosen handle rather than a name or an address, and that no query
exposes the mapping to a Seller.

### Authentication

A new Convex Auth provider built on `ConvexCredentials`, not on `Password`. `Password` derives its
account identity from `profile.email` and writes into `users.email` and the `email` index, which
would collide with real accounts and with this repo's custom `createOrUpdateUser`.
`ConvexCredentials` is the primitive `Password` is itself built from, and it takes an account id
and a secret directly.

The provider takes `{ code, nickname, pin }` and uses `` `${accessCodeId}:${nicknameKey}` `` as the
account id, with the PIN as the secret. Existing account id: verify the secret and sign in. Absent:
check the cap, create the account, create the Seat.

`convex/auth.ts`'s `createOrUpdateUser` must branch on this provider **first, before the email is
computed**. The research re-verified on 2026-08-23 that the callback computes
`String(profile.email ?? "").trim().toLowerCase()` before any provider branch and then reads the
`email` index unconditionally, so a provider supplying no email inserts a row with `email: ""` and
the *second* such user signs in as the first. The branch inserts a fresh `users` row with no
`email` field at all, and skips `claimPendingShares`, since a Seat has no email and so has nothing
pending to claim.

This is trap 1 from [vouchers ticket 11](../vouchers/tickets/11-guest-redemption-and-saving-it-to-an-account.md),
which the research confirmed still holds verbatim against `@convex-dev/auth@0.0.80`. **Trap 2 does
not apply to this spec**, because a Seat never links to a Google or Password account. If linking is
ever wanted, note that the ticket's proposed `getAuthUserId` remedy works on the Password path but
not on Google, whose OAuth callback is an httpAction with no Convex identity.

### Access granted

Joining mints an **ordinary Entitlement** for `(userId, topicId, lang)` through the existing
`lib.hasEntitlement` guard and the existing grant path, carrying **no provenance**: no
`accessCodeId`, no `pfPaymentId`, no `eftRef`. This half of ADR 0029 is kept exactly: a Seat's
Entitlement stays byte-identical to an Admin comp. The link to the organisation lives in `seats`
and nowhere else, so removing that one row removes the link entirely.

`convex/lib.ts`'s grant walk is unchanged. If a ticket finds itself editing the walk, the design
has drifted.

### The cap

Checked and consumed inside the account-creation mutation, in the same transaction that inserts
the Seat, so two members joining simultaneously on the last seat cannot both win. A cap read in
one function and consumed in another is a race.

Raising the cap is a patch on `accessCodes.capacity` by the minting Seller. Lowering it below the
seats already taken is refused: those seats exist and cannot be un-granted.

### Stopping, and the money

`stopCode` sets `stoppedAt`, and in the same mutation writes **one** Ledger row of
`seatCount x pricePerSeat` at status `unpaid` with `kind: "batch"`, storing its id on the code.
The Ledger widening this needs already shipped as vouchers ticket 01: `status` is
`unpaid | owed | paid` and `kind` accepts `"batch"`, and `ledger.owedPayouts` reads `by_status`
for `"owed"`, so an `unpaid` row is invisible to payouts with no logic change.

`sales.ts`'s `salesOnly` allow-list already excludes batch rows from the per-course sales report,
so an Access Code's row is excluded for free. Whether a *settled* one should be counted is the
same open question the vouchers map already carries, and this spec does not answer it.

A code stopped with zero seats writes **no Ledger row at all**. There is nothing to settle and no
queue line to clear.

Stopping is one-way. There is no restart, because a restart would reopen a Ledger row the operator
may already have invoiced against.

The unpaid queue and the reference logging reuse the shapes vouchers tickets 04 and 05 built:
`pendingAccessCodes` returning no codes and no nicknames, and `logAccessCodePayment` recording the
reference and flipping the row to `owed`, idempotently.

### The invoice

**The platform does not generate an invoice document.** The admin portal surfaces the line the
operator needs (organisation, contact, seats, per-seat price, total) and the operator raises the
invoice in whatever they already use. SARS requires seven fields plus a serial and a date within
21 days of supply, and a serial series is a thing to own and never duplicate. Building a document
generator to save a copy-paste is not worth owning that.

### Surfaces

- **`/join`**: a new route on every host, outside the `(app)` group so a stranger meets the code box rather than a sign-in wall, mirroring how `/redeem` was built. Three steps on one page: consent, code, then nickname and PIN.
- **Editions dialog**: the Access Code section sits beside the existing voucher batch section, under the price control.
- **Admin portal, Payouts tab**: stopped-and-unpaid codes listed beside pending EFT intents.

### Refusals

Every refusal is a tagged `ConvexError`, never a plain `Error`. A production Convex deployment
redacts a plain `Error` to "Server Error", so carefully distinguished messages arrive at the member
as one blank, which is the lesson vouchers ticket 03 records. The client turns each tag into a
translated sentence, because the member may not be reading in English.

Tags: `access/code-unknown`, `access/code-stopped`, `access/code-full`, `access/nickname-taken`,
`access/pin-wrong`, `access/consent-required`.

`access/nickname-taken` and `access/pin-wrong` **must be distinguishable**, or a member cannot tell
"pick another nickname" from "you typed your PIN wrong". This leaks the existence of a nickname to
anybody holding the code, and that is an accepted consequence, not an oversight: it is inherent to
a name being the lookup key, it is why the nickname is self-chosen, and it belongs in the
superseding ADR's consequences.

### PIN handling

Minimum four digits, and the join page states that a forgotten PIN cannot be recovered by anybody.
That statement is true and must stay true: no reset flow, because a reset needs a second channel
and the second channel is the email this design exists to avoid.

Rate-limit failed PIN attempts per `(accessCodeId, nicknameKey)`. A shared code plus a guessable
handle plus a four-digit PIN is brute-forceable in an afternoon otherwise.

## Testing Decisions

### What makes a good test here

External behaviour at the public function boundary, never implementation detail.
`convex/eft.test.ts` and `convex/vouchers.test.ts` are the prior art for every test in this spec:
`convexTest`, authorisation negatives asserted **server-side**, and fixtures seeded only the way
production writes them. Never hand-insert an `accessCodes` or `seats` row in a test. Mint a code
through `mintAccessCode` and join through the real path.

### The seam

**One new seam: `convex/accessCodes.ts`**, holding every public function (`mintAccessCode`,
`myAccessCodes`, `raiseCapacity`, `stopCode`, `pendingAccessCodes`, `logAccessCodePayment`) and one
internal mutation the auth provider calls to check the cap and create the Seat atomically.

That internal mutation is the one place a new seam was unavoidable: the credentials provider runs
inside Convex Auth's `signIn` action and needs a transaction the provider itself cannot open. It
is the highest point the seam can sit at.

`convex/auth.ts` is **modified, not a new seam**: one provider added to the array, one branch added
at the top of `createOrUpdateUser`.

### The assertions that matter most

- **Two members joining the same code get two accounts with two Entitlements.** Trap 1 fails silently and looks correct with a single tester, so this is asserted with at least three joins, since the third is what makes `.unique()` throw today.
- **The minted Entitlement's key set is pinned exactly**, as `convex/vouchers.test.ts` pins the voucher one, with a comment naming the superseding ADR. Adding an `accessCodeId` to an Entitlement must fail a test.
- **No Seller-facing query returns a nickname or a userId.** Asserted on the returns validator, the way `pendingBatches` enforces "no codes".
- **The cap is atomic**, asserted by driving two joins against the last remaining seat.
- **Returning does not consume a seat**, asserted by joining, signing out, signing back in, and reading the count.
- **A stopped code still admits an existing Seat and refuses a new one.**
- **Stopping writes exactly one Ledger row at `unpaid`**, invisible to `ledger.owedPayouts` and to the sales report; and stopping a zero-seat code writes none.
- **`logAccessCodePayment` is idempotent** and flips the row to `owed`.
- **The wrong PIN and the taken nickname produce different tags**, and both are `ConvexError`s whose `data` survives.
- **Consent is refused server-side**, not only hidden in the UI.

`/join` is walked in a browser signed out, end to end, including a return on a fresh browser
profile. The vouchers map records that "test-covered and read correct" is not the same claim as
"somebody clicked it", and this rail's first user is a stranger with no account.

## Out of Scope

- **Replacing the voucher rail.** ADR 0029's single-use batches stay exactly as shipped. This is a second rail.
- **Generating an invoice document, PDF or serial series.** The admin portal shows the line; the operator raises the invoice elsewhere.
- **PayFast for this rail.** PayFast has no invoicing product (a case-insensitive grep for "invoice" across its entire developer-docs bundle returns zero hits) and its only post-paid primitive needs the organisation to enter a card and pass 3D Secure at the *start* of the agreement, which is a different commercial ask.
- **Stripe Invoicing or Billing Meters.** Materially lighter than building one, but gated on South Africa's undefined "Extended network" status on Stripe's own availability page, with Stripe Tax recording ZA business location as unsupported.
- **Certificates on Access Code seats.** Confirmed out for this buyer. A certificate is something a member could lose with a forgotten PIN, and there is no recovery, so shipping both together sells a promise the design cannot keep.
- **Linking a Seat to a Google or Password account later.** Not needed here, and the research found the obvious remedy does not work on the Google path.
- **Passkeys.** Best POPIA hygiene of the four options researched, but `@convex-dev/auth@0.0.80` ships no passkey provider, so it is a from-scratch WebAuthn integration.
- **PIN reset or seat recovery of any kind.** Needs a second channel, and the second channel is the email this design exists to avoid.
- **An organisation entity or login.** ADR 0029 refused it and nothing here reopens it. An organisation is still a name and a billing contact on a row.
- **Telling the organisation its take-up automatically.** The Seller reports by hand, as they do for batches.
- **Restarting a stopped code.**
- **Per-seat expiry or time-limited access.** Moodle has both; this rail grants a lifetime Entitlement like every other rail on the platform.

## Further Notes

**The superseding ADR is a prerequisite, not a follow-up.** It has to state plainly that it
reverses ADR 0029's rejection of "one code with N uses" and its decision 3, and it has to carry the
consequences honestly: a `seats` row links a person to an organisation's cohort; the operator can
enumerate a party's cohort size and handles; a nickname's existence leaks to anybody holding the
code; and a forgotten PIN is unrecoverable. ADR 0029 is never rewritten. It stands as the record of
what was decided on 2026-08-18.

**What the research changed about the premise.** The original idea was that a name is the safe
substitute for an email. Under POPIA it is the opposite: an email alone is ordinary personal
information, while a name beside a political party's cohort is special personal information under
s26, and the Information Regulator's own guidance is that "the political persuasion of a voter
relates to the fact that a voter supports a specific political party". The self-chosen nickname is
what makes the chosen design defensible, and it is load-bearing rather than cosmetic: if the UI
ever nudges members toward their real name, the mitigation is gone.

**A pseudonymous token is not de-identified.** The research is unambiguous that `seats.userId` is
personal information whatever form the identifier takes: s1(c) covers "any identifying number,
symbol ... or other particular assignment to the person", and POPIA's separate `unique identifier`
definition describes it almost word for word. There is no version of a capped shared code that
stores nothing, because counting returning members *is* the identifier. Kahoot is the only
researched product that holds no roster, and it manages that only by making its PIN die with the
session.

**Consent has to be real to be worth anything.** POPIA defines it as "any voluntary, specific and
informed expression of will", and s11(2) puts the burden of proof on us. A pre-ticked box or a
buried line in the terms discharges nothing. Storing the wording and the version alongside the
timestamp is what makes it provable a year later.

**Sourcing caveat, inherited from the research.** The Act's own PDFs would not text-extract and
SAFLII returned 403, so statutory wording came from Information Regulator guidance notes
(first-party) plus a third-party reproduction. Before the first live political-party deal, this
should have a legal opinion against the printed Act rather than a research note.
