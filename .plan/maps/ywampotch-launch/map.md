# Fix the funnel + manual EFT rail

<!-- INDEX, not a store. Each unit lives in its own ticket; this map gists and
     links. Load once per session, zoom into tickets on demand.
     Full reasoning and the decisions behind all of it: spec.md -->

## Destination

A stranger can land on `ywampotch.my-course.app`, understand the offer, sign in,
find Basic Tswana, pay **by card or by EFT**, and read lesson one — without the
product changing its name half way through.

Driven by two diagnosed funnel leaks: **checkout abandonment** and **sign-up
friction**. PayFast itself is live and working (5 real purchases); the rail is
not the problem and must not be touched.

## Build order

Strictly sequential — see [spec § Execution](spec.md). File overlap is high
(`SignIn.tsx` spans two units, `market.ts` and `AdminPanel.tsx` span three) and
the auth pair is hard-blocked, so parallelism buys little and costs attributable
history on a repo that now handles real money.

| # | Unit | Where | State |
|---|---|---|---|
| — | Link OAuth sign-in to an existing account by email | **GitHub [#111](https://github.com/EPOHnomeL/hindi-learning/issues/111)** | built `fbb4746` |
| — | Google provider + sign-in button | **GitHub [#112](https://github.com/EPOHnomeL/hindi-learning/issues/112)** | built `f5a3be9` |
| 01 | Brand continuity through the funnel | [01](tickets/01-brand-continuity-through-the-funnel.md) | built `1ffa433` |
| 02 | Operator bank details as an admin-editable settings record | [02](tickets/02-operator-bank-details-settings-record.md) | built `2632b7e` |
| 03 | Buyer flow — Pay by EFT intent + reference | [03](tickets/03-buyer-pay-by-eft-intent-and-reference.md) | built `3adb7e6` |
| 04 | Admin confirm queue — grant + Ledger row | [04](tickets/04-admin-eft-confirm-queue.md) | built `eb6a836` |
| 05 | EFT confirmation email | [05](tickets/05-eft-confirmation-email.md) | built `84d793a` |
| 06 | ADR for the manual EFT rail (+ glossary term) | [06](tickets/06-adr-manual-eft-rail.md) | built — [ADR 0026](../../../docs/adr/0026-manual-eft-payment-rail.md) |
| 07 | Prod-verify the security fixes | [07](tickets/07-prod-verify-security-fixes.md) | **open — needs a human on prod** |
| 08 | Fix the four known stale facts | [08](tickets/08-fix-known-stale-docs-and-tracker.md) | open |

**Before the rail can take a cent on prod**, a sys admin must open the Payouts tab
and fill in the EFT collection account, then tick "Offer Pay by EFT to buyers" —
the rail ships **off**, and the buyer-facing button does not exist until it is on.

**Why the first two are on GitHub.** They predate the 2026-07-29 tracker split
(`docs/agents/issue-tracker.md`) and are already fully specced and labelled
`ready-for-agent` / `ready-for-human`. Grandfathered — build them where they are
rather than duplicating them locally and creating two sources of truth.

**#112 carries a human step that blocks it:** Google Cloud console redirect URIs
plus `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`, set **separately on dev and prod**.
It also needs an acceptance criterion that post-dates the issue — see
[spec § 1.2](spec.md), the ADR 0025 host-preservation check.

## Rules for this build

- **`tdd` then `ponytail`** on every ticket.
- **Tests seed only states production can actually produce.** Before writing a
  fixture, name the mutation that would create it; if there isn't one, the
  fixture is fiction. This is the direct lesson from the `users.tenantSlug`
  phantom-field bug, and it matters most on the EFT path, where a fictional
  fixture means a money bug the tests approve of.
- **Never touch the PayFast code path.** It holds real money.
- `git commit --only <paths>` after `git diff` of those paths. Never `git add -A`,
  never `--amend`. Push only when asked — pushing `main` deploys prod.

## Done when

One end-to-end claim, verified **on prod against the real tenant host** — not in
tests, not on localhost:

> A stranger opens `ywampotch.my-course.app`, signs in with Google, sees Basic
> Tswana in available courses, chooses Pay by EFT, receives a reference and bank
> details, transfers the money; the operator confirms it in the admin queue; the
> buyer receives an email and can read the course. The sale appears in the Sales
> tab and is `owed` to the seller in Payouts. The app is called YWAM Potch
> throughout.

Plus `pnpm typecheck` and `pnpm test` green — noting the long-standing
`convex/sales.test.ts` flake that passes in isolation is pre-existing, not yours.
