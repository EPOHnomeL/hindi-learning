---
type: task
blocked_by: [08, 10]
---
# Build: the remaining switches

## Question

Build whatever is left of [01](01-the-tenant-switch-inventory.md)'s inventory after
[09](09-build-hide-the-existing-five.md), [10](10-build-the-selling-switch.md) and
[11](11-build-the-voucher-and-eft-switches.md) have taken the flagged five, selling, and the three
bulk rails.

The candidates from the charting audit, each of which 01 will have said yes or no to. Build only
the ones it said yes to, and record the nos in the Answer so nobody re-audits them:

- **Catalogue and publish** (`convex/catalogue.ts`, `publishedEditions`). The awkward one: publish
  is visibility, not an acquisition gate (ADR 0024), so gating it is a read-path change and read
  paths have never been flag-gated. 02 will have said whether that holds.
- **Generation Routine.** Composes with the existing per-user daily cap and the `unlimited` grant,
  which are a different grain answering a similar question.
- **Resources and uploads**, and the **emblem**.
- **The per-course manage Dashboard tab.**
- **The PWA install sheet.** Note the Samsung redirect path in `installPromptDerive.ts` renders on
  user agent alone, so a flag gate has to sit above it, not inside it.
- **The interest form and leads.**

If 01's inventory is long, this ticket is a candidate to split by feature at the point of claiming
it. Say so in the Answer rather than resolving a half-built ticket.

## Done when

- [ ] Every switch 01 said yes to and the earlier build tickets did not cover is implemented, each
      with a server gate and a hidden affordance.
- [ ] Every candidate 01 said no to is listed in the Answer with its reason, so the audit is not
      repeated.
- [ ] If catalogue and publish got a switch: the read-path question 02 settled is implemented as
      settled, and the Answer says which way it went.
- [ ] If generation got a switch: it composes with the daily cap and `unlimited` per 01's grain
      rule, tested.
- [ ] If the install sheet got a switch: the gate sits above the Samsung user-agent path, tested.
- [ ] Each new switch has a test asserting the affordance is absent when off and present when on.
- [ ] `pnpm typecheck` and the full suite are green.
