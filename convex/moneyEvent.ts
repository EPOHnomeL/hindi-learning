// The **money event**: one writer for every row that lands in the `ledger` table.
//
// Five rails put money in the books: the card sale (`market.ts`), the manual EFT
// sale (`eft.ts`), the donation (`donations.ts`), the Voucher Batch
// (`vouchers.ts`) and the stopped Access Code (`accessCodes.ts`). Until 2026-09-08
// each of them hand-assembled its own `ledger` row and called `splitNet` itself,
// so the payout arithmetic was reachable from five files and the copies had
// already drift: `market.ts` and `donations.ts` each ran their own
// non-negative-integer cents loop and `eft.ts` ran none at all, which made the
// EFT rail the copy that lost the check.
//
// ADR 0026 (manual EFT rail) and ADR 0027 (per-tenant donation rail) both
// *require* the shared shape: same table, same owed status, same split. That
// requirement used to be held by five hand-written copies happening to agree.
// It is now structural, which is the whole point of this module.
//
// What a rail still decides for itself, because these are genuinely per-rail:
// the `kind`, the `status` (only a batch is ever `unpaid`), the fee basis points
// (a donation takes a tenth, a sale half), the payee and the provenance field.
// What it no longer decides: the split, the cents validation, and the row shape.
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { editionPrice } from "./edition";
import { topicBySlug } from "./topicAccess";
import { isReadySeller } from "./sellerStatus";

// Split a money event's net (cents) into the payee's and the platform's shares.
// The bps is the PLATFORM's cut: its name, and the prior rail's convention (1500
// meant a 15% platform take-rate). The PRD's literal formula handed the bps to
// the seller, which at the decided 5000 is identical but at any other value
// inverts the economics, so the name wins. The shares always sum back to net and
// never go negative, so rounding neither loses nor mints a cent, even on a
// fixed-fee-heavy cheap sale.
//
// **Exported for its own test only.** `recordMoneyEvent` is the sole production
// caller, and `moneyEvent.test.ts` pins that: the payout arithmetic must not
// become reachable from a rail again. It lived in `payfast.ts` until 2026-09-08,
// which put it in the gateway module even though the donation, voucher and
// access-code rails never touch a gateway.
export function splitNet(netCents: number, bps: number): { payeeShare: number; platformShare: number } {
  const platformShare = Math.round((netCents * bps) / 10_000);
  return { payeeShare: netCents - platformShare, platformShare };
}

// The three amounts a ledger row carries, in cents. A gateway rail takes all
// three from the gateway's own numbers; the three off-gateway rails have no fee
// to report, which `offGateway` says once instead of three times.
export type LedgerAmounts = { gross: number; fee: number; net: number };

// No gateway took a cut, so the fee is zero and the net is the whole agreed
// total. The EFT, Voucher Batch and Access Code rails are all this shape.
export function offGateway(total: number): LedgerAmounts {
  return { gross: total, fee: 0, net: total };
}

// What a rail hands over: what happened, to whom, and how much. Everything a
// rail *knows* and nothing it would have to derive.
export type MoneyEvent = {
  kind: "sale" | "donation" | "batch";
  // `owed` is cash already taken. `unpaid` is a bulk deal that has been agreed
  // but not received, which `ledger.owedPayouts` excludes by reading the
  // `by_status` index for `owed`, so unpaid money cannot be paid out with no
  // filter that a later edit could forget to apply.
  status: "owed" | "unpaid";
  // Whom the operator owes: the course owner on a sale or a bulk deal, the
  // tenant's `donationPayee` on a donation.
  payeeId: Id<"users">;
  // The buyer's address on a sale, the buying organisation's billing contact on
  // a bulk deal, the donor's on a donation. Never blank: a blank one puts an
  // anonymous money event in the payouts view.
  buyerEmail: string;
  amounts: LedgerAmounts;
  // The PLATFORM's cut of the net, in basis points. Per rail because a donation
  // takes a tenth where a sale takes half.
  platformBps: number;
  // The Edition this row is revenue for. Absent on a donation only (ADR 0027):
  // a donation buys no Edition.
  topicId?: Id<"topics">;
  lang?: string;
  // Provenance: at most one is ever present. A batch carries neither, because
  // its provenance is the batch or code row that points back at it.
  pfPaymentId?: string;
  eftRef?: string;
};

// Write the money event. Owns the split, the cents validation and the row shape;
// returns the row id, which the two bulk rails store on the row that points back
// at it.
//
// The cents check covers all three amounts on every rail. Three of the five used
// to run it, one ran a narrower version of it and one ran none, and there is no
// rail for which "gross was a float" or "net was negative" is acceptable.
export async function recordMoneyEvent(ctx: MutationCtx, event: MoneyEvent): Promise<Id<"ledger">> {
  const { gross, fee, net } = event.amounts;
  for (const n of [gross, fee, net]) {
    if (!Number.isInteger(n) || n < 0) throw new Error("ledger amounts must be non-negative integer cents");
  }
  const { payeeShare, platformShare } = splitNet(net, event.platformBps);
  return await ctx.db.insert("ledger", {
    topicId: event.topicId,
    lang: event.lang,
    sellerId: event.payeeId,
    buyerEmail: event.buyerEmail,
    gross,
    fee,
    net,
    sellerShare: payeeShare,
    platformShare,
    pfPaymentId: event.pfPaymentId,
    eftRef: event.eftRef,
    kind: event.kind,
    status: event.status,
  });
}

// Has this PayFast payment already been processed? Records it (inside the same
// transaction as whatever the caller is about to grant, so a rollback un-records
// it) and returns true if it was seen before, on which the caller no-ops.
//
// PayFast re-delivers ITNs, so this is what stops the same payment double
// granting or double writing the ledger. The sale rail and the donation rail
// each had their own copy of it.
export async function oncePerPayment(ctx: MutationCtx, pfPaymentId: string): Promise<boolean> {
  const seen = await ctx.db
    .query("payfastEvents")
    .withIndex("by_pf_payment_id", (q) => q.eq("pfPaymentId", pfPaymentId))
    .unique();
  if (seen) return true;
  await ctx.db.insert("payfastEvents", { pfPaymentId });
  return false;
}

// The gate both purchase rails open with: this Edition is on sale right now, and
// its Seller has somewhere to be paid out to. Written twice until 2026-09-08,
// and `eft.ts` said so in a comment ("same invariant as the card rail").
//
// It does NOT cover the rail-specific gates: the card rail's platform-wide
// selling pause and merchant credentials, and the EFT rail's enabled flag and
// region restriction. Those are genuinely one rail's business and stay there.
export async function purchasableEdition(
  ctx: MutationCtx,
  topicSlug: string,
  lang: string,
): Promise<{ topic: Doc<"topics">; listing: Doc<"listings"> }> {
  const topic = await topicBySlug(ctx, topicSlug);
  if (!topic) throw new Error("this edition isn't for sale");
  const listing = await editionPrice(ctx, topic._id, lang);
  if (!listing) throw new Error("this edition isn't for sale");
  // A sale with nowhere to send the Seller's cut must never start.
  if (!topic.ownerId || !(await isReadySeller(ctx, topic.ownerId))) {
    throw new Error("this course isn't available for purchase right now");
  }
  return { topic, listing };
}
