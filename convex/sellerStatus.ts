import { v, type Infer } from "convex/values";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

// Paid marketplace: Seller readiness (ADR 0016). (Plain module — no Convex
// functions registered here.) Split out of `lib.ts` by
// architecture-deepening/02: who may SELL is independent of the Edition access
// stack that decides who may READ.

// A Seller's readiness stage, derived from their `sellers` row (see schema):
//   not-granted               — no row: the Admin has not granted can-sell
//   granted-no-payout-details — granted, but no payout bank details on file yet
//   ready                     — grant + bank details: may price and be paid
// A Seller (CONTEXT) is only `ready` when both gates are satisfied — a course is
// never sold with nowhere to send the Seller's cut. Single source of truth: the
// validator (used by every Convex function that returns a status) and the
// `SellerStatus` type both derive from this one declaration.
export const sellerStatusValidator = v.union(
  v.literal("not-granted"),
  v.literal("granted-no-payout-details"),
  v.literal("ready"),
  // The deployment itself can't sell: PayFast env vars aren't provisioned
  // (payfastConfigured). Reported by the self-status query only — per-Seller
  // row readiness (the admin list) is independent of deployment config.
  v.literal("payments-unconfigured"),
);
export type SellerStatus = Infer<typeof sellerStatusValidator>;

// The caller's Seller row, or null when can-sell was never granted.
export async function getSeller(ctx: QueryCtx, userId: Id<"users">): Promise<Doc<"sellers"> | null> {
  return await ctx.db
    .query("sellers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

// Map a Seller row (or its absence) to the readiness stage the self-status query
// and the pricing guard both read. Payout bank details are the single gate on `ready`.
export function sellerStatusOf(seller: Doc<"sellers"> | null): SellerStatus {
  if (!seller) return "not-granted";
  return seller.payout ? "ready" : "granted-no-payout-details";
}

// Whether the caller may price/sell right now — granted AND bank details on file.
// The guard the pricing action enforces.
export async function isReadySeller(ctx: QueryCtx, userId: Id<"users">): Promise<boolean> {
  return sellerStatusOf(await getSeller(ctx, userId)) === "ready";
}
