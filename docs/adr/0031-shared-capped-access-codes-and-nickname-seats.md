---
status: accepted
supersedes_in_part: 0029
---

# Shared capped Access Codes, nickname Seats, and a bill for what was used

Decided 2026-08-23.

**This ADR supersedes [ADR 0029](0029-seller-minted-voucher-rail.md) in part, and only in part.**
Two things in that ADR are reversed:

1. Its *Considered and rejected* entry **"One code with N uses"**. This ADR builds exactly that.
2. Its **decision 3**, "A redemption records that it happened, and nothing about who". A **Seat** on
   an Access Code records a self-chosen nickname against a `users` row, which is a link between a
   person and the organisation that paid for them.

Everything else in ADR 0029 stands unchanged, including the whole single-use **Voucher** rail: its
batches, its codes, its `redeemedAt`-and-nothing-else redemption, the Seller minting it, and the
sysadmin logging the reference. That rail is not replaced and not deprecated. This is a **second
rail beside it**, for a buyer who wants one code and a bill at the end rather than N codes and a
bill upfront. ADR 0029 itself is not edited; it stands as the record of what was decided on
2026-08-18.

## Context

The buyer ADR 0029 was written for (a political party) came back with two things about the deal that
the voucher rail cannot do.

**Distribution.** N distinct codes means tracking which person got which code. The party runs on
WhatsApp groups and public meetings and wants to broadcast *one* thing that works for everybody, the
way a Kahoot PIN or a Moodle enrolment key does.

**Money.** The party does not know how many of its people will take the course. 500 seats upfront
risks paying for 300 that go unused; 300 risks running out mid-campaign. It wants to run the code
for the length of the agreement, stop it, and be billed for what was actually taken.

There is also a problem the *members* have, found by walking `/redeem` on 2026-08-18: a member must
create an account with an email address before a code their organisation already paid for does
anything. That is too much ceremony for this population, which is the least likely of any on the
platform to push through it.

### The reasons that were not available on 2026-08-18

ADR 0029 rejected one-code-with-N-uses for two stated reasons, and each now has an answer:

- *"One forward drains the paid-for seats to non-members."* A **seat cap** bounds the drain at the
  number the organisation already agreed to pay for. A forwarded code stops granting at the cap.
- *"There is no refund rail to make the buyer whole."* **Post-paid settlement** means nothing has
  been paid, so nothing needs refunding. The bill is written when the code stops, for the seats
  actually taken.

### Why decision 3 has to go

Counting returning members **is** a per-person identifier. A capped shared code cannot reduce to a
counter unless it is willing to miscount a member returning on a second phone as a new seat, which
makes the bill a lie and makes the cap unusable. There is no cryptographic dodge, because the threat
model includes the operator and the operator has the database. POPIA agrees: s1(c) covers "any
identifying number, symbol ... or other particular assignment to the person", and its separate
`unique identifier` definition describes a pseudonymous token almost word for word. A pseudonymous
token is not de-identified data.

Of the products researched, Kahoot is the only one that holds no roster at all, and it manages that
only by making its PIN die with the session, which a course worked through over months cannot do.

Evidence: [`.plan/research/2026-08-23-shared-code-nameless-identity.md`](../../.plan/research/2026-08-23-shared-code-nameless-identity.md).

## Decision

A **Seller** mints one **Access Code** for one **Edition** of their own course. A member joins it
with a nickname and a PIN and is in the course. The Seller stops the code when the agreement ends,
and that is what bills the organisation.

1. **A seat cap, agreed with the organisation, and checked in the same transaction that consumes
   it.** The cap is what makes a shared code safe to broadcast: a forward cannot run up a bill
   beyond it. It is read and consumed in one mutation, never read in one function and consumed in
   another, so two members arriving on the last seat cannot both win. The minting Seller may raise
   it on a live code, and may not lower it below the seats already taken.

2. **A self-chosen nickname, and the page says in those words that it need not be a real name.**
   This is the Kahoot model and it is also the POPIA mitigation (below). It is load-bearing rather
   than cosmetic: if the UI ever nudges members toward their real name, the mitigation is gone.

3. **A PIN, hashed by Convex Auth and never stored by us.** The PIN is the `secret` handed to
   `createAccount`, hashed with the library's own scrypt exactly as the `Password` provider does.
   Nothing in the `seats` table can verify a PIN. Failed attempts are rate-limited per
   `(accessCodeId, nickname)`, because a shared code plus a guessable handle plus four digits is
   otherwise brute-forceable in an afternoon by anybody who was ever given the code, which is
   everybody.

4. **No email, ever.** Not at join, not at return, not anywhere in the app for a member holding a
   Seat. This is the half of the design the members get, and it is why the ceremony that lost them
   on `/redeem` is absent here.

5. **The Ledger row is written on stop, not at mint.** A Voucher Batch's total is known when it is
   created, so its money event is the batch. An Access Code's total is unknown until somebody
   decides the agreement is over, so **stopping is the money event**: one Ledger row of
   `seats consumed x per-seat price`, held `unpaid`, `kind: "batch"`, settled on the existing manual
   EFT rail in the admin portal's Payouts tab. A code stopped with zero seats writes no row at all.
   Stopping is one-way: a restart would reopen a row the operator may already have invoiced against.

6. **Stopping is neither a refund nor a revocation, and the confirm says so in plain words.** Seats
   already taken keep working forever. Stopping ends *new joins* only.

7. **The Entitlement still carries no provenance.** No `accessCodeId`, no `pfPaymentId`, no
   `eftRef`. This half of ADR 0029's decision 3 is kept exactly: a Seat's Entitlement is
   byte-identical to an Admin comp, and the link to the organisation lives in the one `seats` row
   and nowhere else. `lib.ts`'s grant walk is unchanged: a Seat mints an ordinary Entitlement and
   the walk already treats its presence as access.

8. **The platform generates no invoice document.** The queue line carries organisation, billing
   contact, seat count, per-seat price and total; the operator raises the invoice in whatever they
   already use. SARS requires seven fields plus a serial and a date within 21 days of supply, and a
   serial series is a thing to own forever and never duplicate. That is not worth owning to save a
   copy-paste.

9. **The organisation is still not an entity.** ADR 0029 refused it and nothing here reopens it. An
   organisation is a name and a billing contact on a row. It holds no account and is shown nothing
   automatically; the Seller reports take-up by hand.

10. **The Seller never sees a nickname.** No Seller-facing query can return one, enforced in the
    returns validators rather than by which page chooses to render what. The organisation's members
    were promised nobody can see who they are, and the Seller is the party with the commercial
    interest in knowing.

## The POPIA position

The legal basis is **s27(1)(a) consent**, captured explicitly at join, before the nickname box, and
stored against the Seat with its wording version and timestamp, because s11(2) puts the burden of
proving consent on us, and POPIA defines consent as "any voluntary, specific and informed expression
of will". A pre-ticked box or a line buried in the terms discharges nothing.

What makes consent necessary is s26 via s1: a real name stored beside a political party's cohort is
**special personal information**, and the Information Regulator's own guidance is that "the political
persuasion of a voter relates to the fact that a voter supports a specific political party". The
research changed the premise here, and it is worth stating plainly: the original idea was that a name
is the safe substitute for an email. Under POPIA it is the opposite. An email alone is ordinary
personal information, while a name beside this cohort is not. The **self-chosen nickname** is what
makes the design defensible on that limb. It does not remove the need for consent, because the Seat
row is still a `unique identifier` under s1, but it removes the worst of it.

**Sourcing caveat, stated out loud.** The statutory wording above came from Information Regulator
guidance notes (first-party) plus a third-party reproduction of the Act, because the Act's own PDFs
would not text-extract and SAFLII returned 403. Before the first live political-party deal this
should have a legal opinion against the printed Act rather than a research note. The consent design
is built to the strictest reading, so an opinion is more likely to relax it than tighten it, but
that is an assumption, not a finding.

## Considered and rejected

Three identity shapes lost, and each lost for a reason that is worth keeping written down:

- **A nameless, device-bound guest.** The best privacy answer and it cannot count. A returning member
  on a second phone is indistinguishable from a new one, so either the cap is unusable or the bill is
  wrong. This is the finding that forced decision 3 to go.
- **A personal recovery code, one per member.** One forward from being a shared code, which puts us
  back where the cap already is, with a second secret for the member to lose.
- **Passkeys.** The best POPIA hygiene of the four shapes researched (no shared secret to store at
  all), but `@convex-dev/auth@0.0.80` ships no passkey provider, so it is a from-scratch WebAuthn
  integration rather than a provider in an array.
- **PayFast for this rail.** It has no invoicing product at all (a case-insensitive grep for
  "invoice" across its whole developer-docs bundle returns zero hits), and its only post-paid
  primitive needs the organisation to enter a card and pass 3D Secure at the *start* of the
  agreement, which is a different commercial ask.
- **Stripe Invoicing or Billing Meters.** Materially lighter than building one, but gated on South
  Africa's undefined "Extended network" status on Stripe's own availability page, with Stripe Tax
  recording ZA business location as unsupported.
- **A stored seat counter on the code.** A second copy of the truth that drifts. The count is derived
  by reading the `seats` index, the same choice this repo already made for the voucher take-up count.

## Consequences

Each of these is **accepted**, not overlooked:

- **A `seats` row links a person to an organisation's cohort.** This is the reversal of ADR 0029's
  decision 3 and the whole reason this ADR is required. What limits it: the stored handle is
  self-chosen, the Entitlement carries no provenance, and the entire link lives in one row, so
  deleting that row deletes the link.
- **The operator can enumerate a cohort's size and its handles.** They have the database, so this
  follows from the row existing at all. It is why the handle is not a name.
- **A nickname's existence leaks to anybody holding the code.** "That nickname is taken" and "that
  PIN is wrong" must be distinguishable, or a member cannot tell "pick another" from "you mistyped".
  This is inherent to a name being the lookup key, and it is a second reason the nickname is
  self-chosen.
- **A forgotten PIN is unrecoverable by anybody, forever.** There is no reset flow, because a reset
  needs a second channel and the second channel is the email this design exists to avoid. The join
  page says so in those words. The support burden of this at the scale of a party's membership is
  unpriced; if it turns out to be constant, the rail needs a second channel and that reopens the
  whole design.
- **A Seat cannot be linked to a Google or Password account later.** Not needed for this buyer, and
  the obvious remedy (`getAuthUserId` inside `createOrUpdateUser`) works on the Password path but not
  on Google's, whose OAuth callback is an httpAction with no Convex identity.
- **There are now two bulk-access rails**, and an agent auditing bulk sales must look at both. A
  `voucherBatches` row and an `accessCodes` row are deliberately shaped as siblings so they read as
  two ways of doing one thing.
- **A fifth Entitlement writer exists and is invisible in the data.** As with ADR 0029's fourth, a
  Seat's Entitlement files under "Admin grant or legacy row" when audited by provenance. That is the
  point, and this ADR is why the next reader must not "fix" it.
- **No certificate on a Seat.** Confirmed out for this buyer: a certificate is something a member
  could lose with a forgotten PIN, and there is no recovery, so shipping both together would sell a
  promise the design cannot keep.

## Addendum, 2026-08-25: two decisions reversed after walking the rail

The rail above was built and walked. Two of its decisions did not survive contact, and both are
reversed here rather than in the text above, which stands as the record of what was decided on
2026-08-23.

**1. A Seat may now adopt an email and a password.** The Out of Scope list said "linking a Seat to a
Google or Password account later"; the operator asked for it after using the rail, because the one
thing the design cannot otherwise offer is any way back from a lost PIN, and "your progress is gone"
is a support conversation nobody wants to have at the scale of a party's membership. It is built
**password only**: Google's callback is an httpAction with no Convex identity, so `getAuthUserId`
returns null there and the adoption has nothing to adopt onto. That limitation is the research
finding this ADR already recorded, unchanged.

It is **opt-in, unprompted, and it does not create a PIN reset.** Nothing in the product asks for an
address, nothing nags, and a member who never touches the control is never worse off. The join page's
promise stays literally true: a forgotten PIN cannot be recovered. A member who added an email signs
in the other way and changes the PIN; a member who did not still cannot.

The **cost is real and accepted**: a Seat that adopts an address is an ordinary personal
identifier sitting beside a political party's cohort, which is what this design was shaped to avoid.
What limits it is that the member chooses it, one at a time, for a benefit they can name. The
mitigation the rail rests on is unchanged for everybody who declines.

The adoption branch lives in `convex/auth.ts` and is the narrow version of the remedy vouchers ticket
11 warned about. Three guards, all load-bearing and all tested: the caller must already be signed in,
their `users` row must have **no** email (so an ordinary account can never be repointed), and the
target address must not already exist on a `users` row (so two people can never be merged into one
account, which is the #111 failure).

**2. The consent wording was shortened, as a new version.** The 2026-08-23 wording was six long
sentences, which on a phone in front of somebody who has never seen the site is a wall people scroll
past, and **consent nobody read is not "informed" however carefully it was drafted**. Version
2026-08-25 is three short lines carrying the three facts POPIA needs stated, and `/join` links the
Terms and the Privacy Policy for the rest. The Terms gained a full section for it.

The old version is kept in `convex/joinConsent.ts` rather than edited, so a `seats` row stamped
2026-08-23 still resolves to exactly what that member saw. That is what the versioning was for.

**Not reversed, and worth saying so:** the seat cap, the self-chosen nickname, the derived count, the
Ledger row written on stop, the provenance-free Entitlement, and the rule that no Seller-facing query
can return a nickname. All still hold.

**Renamed, 2026-08-25.** In the product this rail is an **Organisation Voucher** and the single-use
rail is **Bulk Vouchers**. The code identifiers (`accessCodes`, `seats`, `mintAccessCode`) were left
alone: renaming a Convex table is a data migration and a word is not worth one. The mapping is in
`docs/agents/project-context.md`. This ADR keeps the old names throughout.

### Addendum, 2026-08-26: the no-Certificate consequence was not enforced

"No certificate on a Seat" is listed above under Consequences as accepted, and it was
never implemented. A Seat mints an **ordinary Entitlement**, which is exactly the point
of the design, and `claimCertificate` gates on `getViewableTopic` plus completion. So a
Seat that finished a course could claim one. Found by asking on 2026-08-26; guard added
the same day, in `isEligible` so that all four claim surfaces stop offering it, plus the
server-side refusal in `claimCertificate`.

**The reason this mattered more than the stated one.** The Consequences section gives
the forgotten-PIN argument: a Certificate is a thing a member could lose, and there is
no recovery, so issuing one sells a promise the design cannot keep. True, and the
smaller half. The sharper problem is that **a Certificate prints a name the learner
types and stores it on the row**. A real name beside a political party's cohort is
precisely the special personal information (s26 via s1) that the self-chosen nickname
exists to keep out of the database, so this rail's one mitigation could have been undone
by a member being helpfully honest in a name box. That argument was not in the original
text and belongs here.

A Seat that adopts an email and a password is **still** refused: it still holds a Seat,
so the name argument still applies. The day that changes should change deliberately,
with the name question answered, rather than falling out of an unrelated feature.

Certificates **already earned** are left resolvable rather than revoked, which is this
codebase's posture throughout (`claimCertificate` returns an existing row before every
gate). If any Seat certificate exists on a real deployment it holds a typed name; that is
a data question to look at rather than a code one, and nothing here deletes it.

**The general lesson, worth more than the fix:** an Out of Scope line is not a control.
Three of this rail's guarantees are enforced by tests that fail loudly (the pinned
Entitlement key set, the atomic cap, no nickname in a Seller-facing validator) and this
one was enforced by a sentence in a document. It is the only one that was wrong.
