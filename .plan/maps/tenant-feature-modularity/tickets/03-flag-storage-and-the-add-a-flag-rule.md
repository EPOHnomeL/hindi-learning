---
type: grilling
blocked_by: []
---
# Flag storage, and the rule for adding the next one

## Question

Two contradictory policies for adding a flag are both on the books, and the inventory from
[01](01-the-tenant-switch-inventory.md) is about to add roughly ten more.

- **Whitelabel ticket 04** (2026-07-15): a flag added later is `v.optional(v.boolean())` and
  defaults `false`, opt-in per tenant. `donations` was built this way, and the schema comment
  argues the case: absence already carries the right meaning, so there is no backfill, and an
  un-set flag is fail-closed, which is what money wants.
- **Course-publishing ticket 02** (2026-07-18): `selling` is a **required** boolean defaulting
  `false`, with a widen-migrate-narrow migration backfilling the four existing rows.

They cannot both be the rule. Deciding costs almost nothing now and costs a data migration per flag
later, and every added required boolean is a three-deploy sequence on a live prod deployment
(widen, backfill, narrow) with the `pnpm *:prod` CLIs in the middle.

Beyond the required-versus-optional call, three storage questions ride along:

- **Default on or off, per flag.** The original five defaulted `true` because they were already-on
  behaviour and flipping them off would have been a regression. A new switch over an already-live
  feature (selling, both voucher rails, EFT) has exactly the same property: the four tenants are
  using them today. Does a new flag over an existing feature default on, while a new flag over a
  new feature defaults off? Say the rule, not just the cases.
- **Where the rule is written.** `convex/tenantFlags.ts` is the natural home for a comment, but a
  rule nobody finds is not a rule. Decide between the module comment,
  `docs/agents/project-context.md`, and an ADR, and say why.
- **Whether the flat `v.object` survives the inventory.** Fifteen keys in one validator, each
  optional, each also listed in `setTenantFlags`'s args object and in `FLAG_META`, is three places
  to keep in sync. `TenantFlag` is already derived from the validator so the keys cannot drift; the
  other two are hand-maintained. Say whether that is acceptable or whether the shape changes.

Note this ticket is **not** blocked on 01. The rule should be decidable from the two existing
policies and the migration cost alone, and settling it early lets 01 name its keys knowing what a
key costs.

## Done when

- Required-versus-optional is decided for every future flag, in one sentence, with the migration
  cost stated as the reason.
- A default-value rule exists that covers both "new switch over an already-live feature" and "new
  switch over a new feature", rather than enumerating today's cases.
- The rule has a written home, chosen deliberately, and the Answer names the file.
- The flat validator either survives with the sync burden acknowledged, or a replacement shape is
  named for [07](07-build-flag-storage.md) to build.
