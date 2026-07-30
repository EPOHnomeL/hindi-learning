# PRD — ywampotch launch: fix the funnel, add a manual EFT rail

**Created:** 2026-07-29 · **Grilled and agreed:** 2026-07-29 · **Status:** scoped, not started

## The objective

A stranger can land on `ywampotch.my-course.app`, understand the offer, sign in,
find Basic Tswana, pay **by card or by EFT**, and read lesson one — without
meeting a different product name half way through, and without abandoning at the
gateway.

Every item below is filtered by "does the ywampotch launch need it". Everything
else in the backlog stays out.

## Why now — the state that motivated this

PayFast is **live** and **5 real purchases** have completed. This corrects
`docs/agents/project-context.md:158-166`, which still says the merchant is
pending FICA and selling is paused via `PAYFAST_MODE=off`. The "monetisation is
cold" framing that shaped earlier scoping is dead.

The problem is not the rail. The diagnosis, from the operator: **checkout
abandonment** and **sign-up friction** — two adjacent leaks in one funnel.

ywampotch is the tenant chosen because it is furthest along: a real authored
course (Basic Tswana), brand assets on prod, and the only bespoke landing page
in the registry (`src/app/_landing/registry.ts:20`).

## Non-goals

- Changing the PayFast rail. It works and it holds real money; the EFT work must
  not touch its code path.
- Per-tenant or per-course configuration of the EFT rail. Money lands in one
  account regardless of which tenant sold the course, so there is nothing
  tenant-specific to configure. Build the toggle when a second course wants a
  different answer.
- Paying sellers automatically. Payouts stay manual EFT via the existing Payouts
  tab.
- Refunds. Unchanged: `market.revokeEntitlement` remains the only valve.
- The onboarding/marketing video (deferred, own issue — see Follow-ups).
- The git-history docs sweep (deferred — `.scratch/docs-reconciliation/HANDOFF.md`).

---

## Part 1 — The auth funnel

### 1.1 Link OAuth sign-in to an existing account by email (**#111**)

Already fully specced on the issue. Reworks `convex/auth.ts`'s
`createOrUpdateUser` to link on the normalised email instead of unconditionally
inserting, so a Google click from an existing password user doesn't fork their
account away from their purchases, progress and certificates.

Hard blocker for 1.2. Ships first, alone.

### 1.2 Google provider + sign-in button (**#112**)

Already fully specced on the issue: `Google` from `@auth/core/providers/google`
(already a dependency), a "Continue with Google" button above the email/password
form in `SignIn.tsx`, shown in both toggle states, with i18n copy.

**Human step, blocking:** Google Cloud console authorised redirect URIs plus
`AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` set **separately on dev and prod**.

**New acceptance criterion not on the issue.** ADR 0025 (per-tenant session
isolation) landed on 2026-07-29, *after* #112 was written, and reverses ADR 0022
§4a: no cookie carries a `Domain` any more, sessions are host-only per subdomain.
The OAuth round trip therefore has to preserve the host. Add:

> Initiating Google sign-in from `ywampotch.my-course.app` returns the user to
> `ywampotch.my-course.app` signed in, with a host-only session cookie on that
> host — not on the apex, and not on the default site.

Verify this on a real subdomain, not on localhost. This is the single most
likely thing to be quietly broken, because the redirect URI is registered
per Convex deployment while the session is now per app host.

### 1.3 Brand continuity through the funnel

`<Brand>` is used only by the landing nav. `SignIn`, `Dashboard`, `CourseShell`
and `PublicReader` still hardcode "My Course" and the book `Logo`
(`.scratch/whitelabel/TODO.md`). So a YWAM Potch learner meets a YWAM-branded
landing page, signs in, and arrives in a product with a different name — mid
funnel, immediately before being asked for money.

Route all four through `<Brand>`. Not polish: a name change at the payment step
is a trust break, and it sits squarely on the path this PRD exists to fix.

---

## Part 2 — The manual EFT rail

Money lands in the **operator's** bank account, preserving sole
merchant-of-record. A manual sale produces a real Ledger row so it stays visible
to the Sales tab and correctly `owed` in Payouts — which the bare
`market.grantEntitlement` path does not.

### 2.1 Operator bank details as an admin-editable settings record

A single global settings record, sys-admin-only to edit, with an explicit
enabled toggle. Fields: bank name, account name, account number, branch code,
`enabled`.

Global, not per-tenant. Edited in `AdminPanel.tsx`.

*Note:* the grilling first recommended Convex env vars (mirroring
`payfastConfigured`, changeable with no deploy, zero UI); the operator chose an
admin-editable record for self-sufficiency on prod. Recorded so the trade is
visible, not to relitigate it.

The buyer-facing read exposes bank details to any signed-in user while the rail
is enabled. That is intentional — bank details are printed on invoices, not
secret — but it *is* a deliberate disclosure decision, so state it in the query's
comment rather than leaving a future reader to wonder.

### 2.2 Buyer flow — intent and reference

On a priced Edition's paygate, alongside the existing PayFast button and only
when the rail is enabled: **"Pay by EFT"**. It writes an intent row and shows the
bank details plus a unique reference.

**Reference format:** short, human-readable, unambiguous on a bank statement —
e.g. `TSW-4F2K` (topic-derived prefix + random suffix). Deliberately *not* the
PayFast `m_payment_id` UUID: a human types this into a banking app, and a
mistyped reference is an unmatchable payment.

**Deviation from the grilling, flagged for approval.** The grilling agreed to
reuse `checkoutIntents`. On inspection that table is read by the live ITN path
(`market.checkoutIntentByRef`, `fulfillPurchase`) and has no status field —
adding one, plus an EFT reference, means editing a table on the working money
path that currently holds 5 real purchases. **Use a separate `eftIntents` table
instead**: `{ ref, userId, topicId, lang, amount, status: pending | confirmed |
dismissed }`, indexed by `ref` and by `status`. It is less code than widening
`checkoutIntents`, and its blast radius on the PayFast rail is zero. Same shape
the grilling agreed to; different table.

### 2.3 Admin confirm queue

A pending-EFT list in `AdminPanel.tsx` (Payouts or Sales area — reuse, don't add
a sixth tab unless it reads badly). Each row shows reference, buyer email, course,
Edition, amount. Two actions:

- **Confirm** — mints the Entitlement and writes a Ledger row, atomically, in one
  mutation, mirroring `fulfillPurchase`'s ordering and its idempotency guarantees.
  `fee: 0`, `net == gross` (no gateway took a cut), split 50/50 via the existing
  `splitNet`. Idempotent per `(buyer, Topic, language)` and per reference.
- **Dismiss** — for an intent that never gets paid. Stale intents are litter, not
  errors; without this the queue silts up and stops being read, which is how a
  real payment gets missed.

**Schema change.** `ledger.pfPaymentId` is currently required
(`convex/schema.ts`). Widen it to optional and add an optional `eftRef`; exactly
one of the two is present on any row. Do the same on `entitlements` (its
`pfPaymentId` is already optional — just add `eftRef`). This gives every
Entitlement and every Ledger row unambiguous provenance: you can always tell
which rail sold a seat.

**Prod sequencing.** Widening a field is safe to deploy on push. *Narrowing* one
later is not — it needs the data stripped of the field in an earlier merge
(`docs/agents/project-context.md`). Widen now; don't paint in a narrowing.

### 2.4 Buyer wait experience

An EFT clears in hours or days and admin confirmation may be slower. The buyer
will have closed the tab, and if nothing reaches them they will assume they have
been robbed.

- **In-app:** a pending state, reusing the reactive `market.checkoutStatus`
  pattern — it already drives the awaiting-payment banner and resolves the moment
  the grant lands, regardless of which rail granted it.
- **Email:** exactly **one** Resend send, on confirmation — "your access is live,
  here's the link". Via the existing `convex/email.ts` + `convex/inviteEmail.ts`
  pattern (which already no-ops with a warning when Resend is unconfigured, so it
  can't break a confirmation).

No "we've recorded your intent" email at click time: it tells the buyer nothing
they don't already know and doubles the surface for politeness.

### 2.5 An ADR

A second payment rail with the operator collecting out-of-band and access granted
by human confirmation is a real architectural decision, not an implementation
detail. Record it (next free number — 0025 is taken by per-tenant session
isolation). It should state: operator remains sole merchant-of-record; the manual
rail mints a Ledger row at `fee: 0` so reporting stays whole; provenance is
carried by `eftRef` vs `pfPaymentId`; and the PayFast path is deliberately
untouched.

`CONTEXT.md` may also need a term — the glossary currently has no name for a
purchase that arrives without a gateway.

---

## Part 3 — Ride-alongs

### 3.1 Prod-verify the security fixes

Five privilege holes were closed and eleven gates tightened, and **nobody has
checked on a live account**. That surface now carries real buyers and real
Entitlements. Two checks, minutes each, on prod:

- A **sys admin** still has full Admin-panel function. The risk of a tightening
  pass is over-tightening and silently losing your own operator surface.
- As a **tenant admin**, the `courseAssignment` response carries **no** `available`
  array of other users' course titles — proving the leak is closed server-side
  and not merely hidden in the UI.

### 3.2 Fix the four known stale facts

Inline, no issue: the PayFast lines in `docs/agents/project-context.md:158-166`;
close #52 and #53 (both built — `convex/sales.ts:17`,
`src/app/_components/AdminPanel.tsx:61`); close #113 (shipped as a modal in
`da02161`); give #46 real scope or close it as a stub.

The *systematic* sweep is out of scope and handed off separately.

---

## Definition of done

One end-to-end claim, verified on prod against the real tenant host — not in
tests, and not on localhost:

> A stranger opens `ywampotch.my-course.app`, signs in with Google, sees Basic
> Tswana in available courses, chooses Pay by EFT, receives a reference and bank
> details, transfers the money; the operator confirms it in the admin queue; the
> buyer receives an email and can read the course. The sale appears in the Sales
> tab and is `owed` to the seller in Payouts. The app is called YWAM Potch
> throughout.

Plus: `pnpm typecheck` and `pnpm test` green. (Note the long-standing
`convex/sales.test.ts` flake that passes in isolation — that one failure is not
new and not yours.)

## Testing rule for this build

**Tests seed only states production can actually produce.** This is the direct
lesson from the `users.tenantSlug` bug: `catalogue.list` shipped fully green and
was broken in production because its tests hand-seeded a row shape no code path
writes. Before writing a fixture, name the mutation that would create it. If
there isn't one, the fixture is fiction and the test is worthless.

Applies with particular force to the EFT path, where a fictional fixture means a
money bug that tests approve of.

## Execution

**Single-threaded, issue by issue.** The last parallel batch ran four agents on a
shared index and left history misattributed; the file overlap here is high
(`SignIn.tsx` in both 1.2 and 1.3; `market.ts` and `AdminPanel.tsx` across the EFT
work) and #112 is hard-blocked by #111, so parallelism buys little and costs
attributable history on a repo that now handles money.

Per `CLAUDE.md`: commit straight to `main`, conventional commits with the
`Co-Authored-By` trailer, **`git commit --only <paths>`** after a `git diff` of
those paths. Never `git add -A`, never `--amend`. Push only when asked — pushing
`main` deploys prod.

Build each issue with `tdd` (test-first) and `ponytail` (laziest thing that works).

**Order:** #111 → #112 → 1.3 brand → 2.1 settings → 2.2 buyer flow → 2.3 confirm
queue → 2.4 email → 2.5 ADR → 3.1 prod verification → 3.2 doc fixes.

**Tickets:** [`map.md`](map.md)
is the index. Implementation tickets are **local Markdown** under `issues/`, per
the 2026-07-29 tracker split (`docs/agents/issue-tracker.md`): GitHub is reserved
for non-ephemeral, non-implementation tickets. The two auth units are the
exception — #111 and #112 predate the split, are already fully specced and
labelled, and stay on GitHub rather than being duplicated locally.

## Follow-ups (filed, not built)

- **Onboarding / marketing video** via the `html-demo-wizard` skill. Explicitly
  deferred by the operator. **Not filed yet** — it is unscoped and
  discussion-shaped, so by the tracker split it belongs on GitHub rather than
  here; awaiting the operator's go-ahead to create it.
- **Git-history docs + tracker reconciliation sweep** —
  `.scratch/docs-reconciliation/HANDOFF.md`.
- **Grandfathering** — ADR 0024's live-read consequence means pricing a formerly
  free Edition cuts off readers who never bought it. Not triggered by this work
  (Basic Tswana is already priced), but unresolved and worth a decision before any
  free→paid transition.
