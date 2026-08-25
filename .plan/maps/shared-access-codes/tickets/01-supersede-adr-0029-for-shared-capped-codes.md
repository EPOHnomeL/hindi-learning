---
type: task
---
# Supersede ADR 0029 for shared capped codes

> `/wayfinder .plan/maps/shared-access-codes/tickets/01-supersede-adr-0029-for-shared-capped-codes.md`

## Question

ADR 0029 lists "One code with N uses" under *Considered and rejected*, and its decision 3 is that a
redemption records nothing about who redeemed. This rail does both. Write the ADR that says so, or
none of the tickets below it are legitimate.

The decision itself is already made and recorded in [spec.md](../spec.md); this ticket is not
re-litigating it. What the ADR has to do is state the reversal plainly, give the reasons that were
not available on 2026-08-18, and carry the consequences honestly rather than burying them.

**The reasons that are new.** ADR 0029 rejected one-code-with-N-uses because "one forward drains
the paid-for seats to non-members" and "there is no refund rail to make the buyer whole". A seat
cap answers the first: a forwarded code stops granting at the agreed number, so the drain is
bounded by the thing the organisation already agreed to pay for. Post-paid settlement answers the
second: nothing has been paid, so nothing needs refunding.

**Why decision 3 has to go.** Counting returning members *is* a per-person identifier. The research
established that a capped shared code cannot reduce to a counter unless it is willing to miscount a
returning member as a new seat. There is no cryptographic dodge, because the threat model includes
the operator and the operator has the database.

**What limits the damage, and belongs in the ADR as the reason this is acceptable.** The stored
handle is self-chosen and the page says in those words that it need not be a real name; the
Entitlement still carries no provenance, so it stays byte-identical to an Admin comp; and the whole
link lives in one `seats` row, so deleting that row deletes the link.

**ADR 0029 is not edited.** It stands as the record of what was decided on 2026-08-18.

## Done when

- A new ADR exists under `docs/adr/`, numbered next in sequence, accepted, dated 2026-08-23.
- It names ADR 0029 as superseded **in part**, and says exactly which parts: the rejection of one
  code with N uses, and decision 3's "records nothing about who redeemed". Everything else in
  ADR 0029, including the whole single-use voucher rail, stands unchanged.
- ADR 0029 gains a pointer to it and **nothing else in that file changes**.
- The Decision section states the seat cap, the self-chosen nickname, the PIN, the post-paid Ledger
  row written on stop, and that the Entitlement still carries no provenance.
- The Consequences section states each of these as accepted rather than overlooked: a `seats` row
  links a person to an organisation's cohort; the operator can enumerate a cohort's size and its
  handles; a nickname's existence leaks to anybody holding the code, because a taken nickname and a
  wrong PIN must be distinguishable; and a forgotten PIN is unrecoverable by anybody, forever.
- The POPIA position is stated with its basis: s26 via s1, cured by s27(1)(a) consent, mitigated by
  the nickname being self-chosen. It cites the research note and says out loud that the statutory
  wording came from Information Regulator guidance rather than the printed Act.
- A Considered and rejected section covers the three identity shapes that lost: nameless
  device-bound guest (cannot count returning members), personal recovery code (one forward from
  being a shared code), and passkeys (no provider in `@convex-dev/auth@0.0.80`).

## Answer

[ADR 0031](../../../../docs/adr/0031-shared-capped-access-codes-and-nickname-seats.md), accepted,
dated 2026-08-23. It supersedes ADR 0029 **in part** and names the two parts: the *Considered and
rejected* entry "One code with N uses", and decision 3's "records nothing about who redeemed".
Everything else in 0029, including the whole single-use voucher rail, is stated as standing
unchanged.

ADR 0029 gained a `superseded_in_part_by: 0031` line in its frontmatter with a four-line comment
naming what was reversed, and **nothing else in that file changed**. It was not rewritten.

The Decision section carries all ten points: the seat cap consumed in the same transaction, the
self-chosen nickname (with the load-bearing note that a UI nudging toward a real name removes the
mitigation), the PIN as Convex Auth's `secret` with rate limiting per `(accessCodeId, nickname)`, no
email ever, the Ledger row written on stop rather than at mint (with the zero-seat case writing
none, and stopping being one-way), stopping as neither refund nor revocation, the Entitlement
carrying no provenance and `lib.ts`'s grant walk unchanged, no invoice document, the organisation
still not an entity, and no Seller-facing query able to return a nickname.

The Consequences section states each cost as accepted: the `seats` row linking a person to a cohort,
the operator being able to enumerate a cohort's size and handles, a nickname's existence leaking to
anybody holding the code (because taken-nickname and wrong-PIN must be distinguishable), and a
forgotten PIN being unrecoverable by anybody forever. It also carries the unpriced support burden of
that last one as the thing that would reopen the whole design.

The POPIA position is its own section: s27(1)(a) consent as the basis, s26 via s1 as what makes it
necessary, the self-chosen nickname as the mitigation, and an explicit paragraph saying the statutory
wording came from Information Regulator guidance plus a third-party reproduction rather than the
printed Act, because the Act's PDFs would not text-extract and SAFLII returned 403.

Considered and rejected covers the three identity shapes that lost (nameless device-bound guest,
personal recovery code, passkeys) plus PayFast, Stripe, and a stored seat counter.

**One thing the ADR settles that the spec left implicit**, and every ticket below inherits it: the
provider takes a **`flow` of `"join"` or `"return"`**, the way `Password` takes `signUp`/`signIn`.
Without it, `access/nickname-taken` and `access/pin-wrong` cannot be distinguished at all, because
a code plus an existing nickname plus a wrong PIN is *the same request* whether the member believes
they are new or returning. The spec requires those two tags be distinguishable, and an intent
declared by the member is the only thing that separates them.
