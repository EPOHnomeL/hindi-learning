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


## Answer

Done, in four places, plus a gate that keeps the first two from drifting apart.

**The consent wording lives in `convex/joinConsent.ts`**, versioned and **append only**, keyed by the
date string `seats.consentVersion` stores. It is in `convex/` rather than `src/lib/` because
`convex/` has its own tsconfig and never imports from `src/`, and the server half has to resolve the
same version the page rendered. `claimSeat` refuses a version that is not the current one, so a stale
cached page cannot record a member as agreeing to wording it never showed them.

The wording names what is stored (a nickname of the member's own choosing, a PIN, and their
progress), why (so they can return on another device, and that is the only reason), who can see it
(the organisation and the course owner see a count and never a nickname), that the nickname need not
be a real name, and that a forgotten PIN cannot be recovered by anybody. Six sentences.

**`/join` renders it translated, in five locales, and does not restate it.** That is two copies of one
legal undertaking, which is exactly the arrangement that drifts, so `messages/consent.test.ts` is the
gate: the English on the page must equal the canonical record **word for word**, and every other
locale must have the same number of sentences. The second half is not a translation check, which no
test can do; it catches the failure that actually happens, a locale quietly dropping the sentence
about the PIN or the one about the real name. Both are compliance controls, and a member who never
read them did not give informed consent.

**`src/app/(legal)/privacy/page.tsx`** gains "If you joined with a shared code from an organisation"
as its own `<h2>`, not a bullet in the collection list: this is the one account type on the platform
with no email address, and burying that in a list would understate the point of it. It states what is
held, the s27(1)(a) basis, who sees what, how to withdraw (Settings or the support address), and the
two honest consequences of withdrawing (the count does not move, and the credential goes with the
link so there is no signing in again elsewhere). Last-updated moved to 23 August 2026.

**`CONTEXT.md`** gains **Access Code** and **Seat**, each with an `_Avoid_` line distinguishing it
from Voucher and Voucher Batch, which are untouched. Seat's `_Avoid_` includes "seat in the Voucher
Batch sense", because a batch's `seats` is a count of codes and this one is an identity, and that
collision is a real trap in a codebase that now has both.

**`docs/agents/project-context.md`** gains a dated section, "Bulk access: there are TWO rails, not
one (2026-08-23)", with the rule for which applies and the six facts about the second rail that are
easy to get wrong. This is the note the CLAUDE.md rule about stale context exists for: an agent
finding one rail in the notes and two in the code will reason about the wrong deal.
