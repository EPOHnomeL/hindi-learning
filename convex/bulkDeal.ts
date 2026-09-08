// **The bulk deal**: what a Voucher Batch and an Access Code have in common.
//
// `accessCodes.ts` said in its own header that it was a deliberate mirror of
// `vouchers.ts`, and by 2026-09-07 it was line for line across seven mechanisms
// (candidate 6 of the 2026-09-04 review, ticket 30). Every bulk-sales change was
// two edits and every bulk-sales audit was two files.
//
// **Only three things genuinely differ, and ADR 0031 names all three:** when the
// Ledger row is written (at mint for a Batch, at stop for an Access Code),
// per-seat against per-deal price, and whether a Seat row exists. Everything in
// this module is one of the things that does NOT differ.
//
// **This needs no superseding ADR.** ADR 0031 *named* the cost rather than
// deciding it, in its own words: "There are now two bulk-access rails, and an
// agent auditing bulk sales must look at both." A shared implementation leaves
// every substantive constraint of that ADR standing: no provenance on the
// Entitlement, a derived seat count, no restart after a stop.
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { isCallerAdmin } from "./whitelist";

// The buying organisation, which is **two strings and deliberately not an
// entity**: it holds no account, has no login, and the only thing it is ever
// shown is a count (ADR 0029). Resist the pull towards a table.
//
// Both are how the Seller and the sysadmin tell one deal from another months
// later, and the contact becomes the Ledger row's `buyerEmail`, so a blank one
// would put an anonymous money event on the operator's queue.
export function assertOrganisation(orgName: string, orgContact: string): { org: string; contact: string } {
  const org = orgName.trim();
  const contact = orgContact.trim();
  if (!org || !contact) {
    throw new Error("the buying organisation's name and billing contact are both required");
  }
  return { org, contact };
}

// A code no row in `table` already holds. Convex has no uniqueness constraint, so
// this is enforced on read, exactly as the EFT rail enforces its reference: retry
// rather than throw.
//
// Bounded, because at these keyspaces (32^8 for a voucher, 32^9 for an access
// code) five clashes in a row is not bad luck, it is a broken RNG, and looping on
// that would hang the mutation instead of failing it.
//
// `mint` is the caller's, because the two code SHAPES are deliberately different
// and not a detail to share: a `GRP-7K4-Q2X-9MB` must not be mistakable for a
// `MYC-7K4Q-2XR9` when both rails can be live on one Edition at once.
export async function freshDealCode(
  ctx: MutationCtx,
  table: "vouchers" | "accessCodes",
  mint: () => string,
): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = mint();
    const clash = await ctx.db
      .query(table)
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (!clash) return code;
  }
  throw new Error("could not mint a unique code");
}

// The caller's own deal row, or a throw. Every Seller-facing read and write of a
// deal goes through this rather than trusting which rows a page happened to list:
// a void, a cap raise and a stop are all things one Seller could do to another
// Seller's deal.
//
// `notYours` is the caller's message because the two rails name different things
// to a Seller, and a refusal that says "batch" about an access code is a refusal
// that reads like a bug.
export async function ownDeal<T extends "voucherBatches" | "accessCodes">(
  ctx: QueryCtx,
  table: T,
  id: Id<T>,
  messages: { signIn: string; notYours: string },
): Promise<Doc<T>> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error(messages.signIn);
  const row = await ctx.db.get(id);
  if (!row || (row as { sellerId?: Id<"users"> }).sellerId !== userId) throw new Error(messages.notYours);
  return row as Doc<T>;
}

// The organisation's transfer landed: record the reference against the deal and
// flip its Ledger row from `unpaid` to `owed`, which is what makes the Seller's
// share payable in the ordinary payout run. Sys admin only.
//
// **This is bookkeeping, not a gate.** On both rails the codes have been working
// since they were minted, and nothing here reads, writes, generates or
// invalidates one: the sysadmin never sees a code at all.
//
// Idempotent on the reference already being recorded, like `confirmEftPayment`. A
// second click must never move a second Ledger row or overwrite the reference
// that reconciles the statement line.
//
// Only an `unpaid` row moves. A row somehow already `owed` or `paid` keeps its
// state rather than being re-owed, which is the posture `markPaid` takes from the
// other end of the same lifecycle. `ledgerId` is optional because a zero-seat
// Access Code stops with no Ledger row at all.
export async function logDealPayment(
  ctx: MutationCtx,
  deal: { id: Id<"voucherBatches"> | Id<"accessCodes">; paymentRef?: string; ledgerId?: Id<"ledger"> },
  reference: string,
): Promise<void> {
  if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
  const ref = reference.trim();
  // The whole point is being able to point at the bank statement line later.
  if (!ref) throw new Error("the bank reference or transaction id is required");
  if (deal.paymentRef !== undefined) return;

  await ctx.db.patch(deal.id, { paymentRef: ref });
  if (!deal.ledgerId) return;
  const row = await ctx.db.get(deal.ledgerId);
  if (row?.status === "unpaid") await ctx.db.patch(deal.ledgerId, { status: "owed" });
}

// The unsettled deals on one rail: the rows whose transfer has not been logged
// yet, which is the operator's queue.
//
// **An ABSENT `paymentRef` IS the queue, indexed rather than filtered**, on both
// rails, so a settled deal is invisible with no predicate a later edit could
// forget. Capped rather than paginated, because a hand-reconciled queue is small
// by definition and one that is not is a signal rather than a page to scroll.
export async function unsettledDeals<T extends "voucherBatches" | "accessCodes">(
  ctx: QueryCtx,
  table: T,
): Promise<Doc<T>[]> {
  // `undefined as never`: both tables index `paymentRef` and both want the ABSENT
  // value, but resolving the field type across the two-table union defeats
  // Convex's generated index typing. The literal is checked by the table name
  // above, and the cast is confined to this one line.
  return (await ctx.db
    .query(table)
    .withIndex("by_payment_ref", (q) => q.eq("paymentRef", undefined as never))
    .take(500)) as Doc<T>[];
}
