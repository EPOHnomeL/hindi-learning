---
type: task
blocked_by: [01]
---
# Say what we hold, and in the glossary

> `/wayfinder .plan/maps/shared-access-codes/tickets/09-say-what-we-hold-and-in-the-glossary.md`

## Question

Two audiences, one job: say what this rail stores, to the member in the consent step and to the
world in the privacy policy, and give the team the words for it.

**The consent wording is the artifact this ticket exists for.** POPIA defines consent as "any
voluntary, specific and informed expression of will", and s11(2) puts the burden of proving it on
us. Specific means naming what is stored (a nickname of the member's own choosing, a PIN, and their
progress) and why (so they can return to the course on another device). Informed means saying who
can see it and who cannot. A pre-ticked box, or a line buried in the terms, discharges nothing.

It is **versioned** because a year from now the question will be which wording a particular member
agreed to, and `seats.consentVersion` is only worth storing if something on the other end resolves
it.

`docs/agents/project-context.md` gets the rail too, because the next agent to touch payments would
otherwise find two bulk-access rails in the code and one in the notes.

## Done when

- A versioned consent wording exists in one place, resolvable from `seats.consentVersion`, and
  ticket 05's page renders it rather than restating it.
- The wording names what is stored, why, and who can see it. It says the nickname need not be a real
  name, and that a forgotten PIN cannot be recovered.
- `src/app/(legal)/privacy/page.tsx` describes the Seat: what is held, on what basis (s27(1)(a)
  consent), and how a member asks for it to be deleted.
- `CONTEXT.md` gains **Access Code** and **Seat**, each distinguishing itself from Voucher and
  Voucher Batch, which stay exactly as they are.
- `docs/agents/project-context.md` records that there are now two bulk-access rails and when each
  applies, with the date.
