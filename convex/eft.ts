import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { payoutDetailsValidator } from "./schema";
import { isCallerAdmin } from "./whitelist";

// The **manual EFT rail** (ywampotch-launch PRD part 2): a second payment rail
// where the buyer transfers the price into the operator's own account and the
// operator confirms it by hand. The PayFast rail is deliberately untouched by any
// of this — it holds real money.
//
// This module owns the rail's configuration: the operator's **collection**
// account (where buyers pay IN — the opposite direction to `sellers.payout`) and
// the switch that turns the rail on. The intents, the confirm queue and the
// Ledger row land in tickets 03–05.

// The singleton row. Global by design: money lands in one account whichever
// tenant sold the course, so there is nothing tenant-specific to look up.
// ponytail: `.first()` on a table with at most one row — no index, no key.
async function getRow(ctx: MutationCtx | QueryCtx) {
  return await ctx.db.query("operatorBank").first();
}

// The operator's collection account, for the sys-admin editor (sys admin only —
// a tenant admin must not see or change where the platform's money is
// collected). `null` while the rail has never been configured.
export const operatorBank = query({
  args: {},
  returns: v.union(v.object({ ...payoutDetailsValidator.fields, enabled: v.boolean() }), v.null()),
  handler: async (ctx) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const row = await getRow(ctx);
    if (!row) return null;
    const { accountHolder, bank, accountNumber, branchCode, enabled } = row;
    return { accountHolder, bank, accountNumber, branchCode, enabled };
  },
});

// Save the operator's collection account and the rail's on/off state (sys admin
// only, unscoped `isCallerAdmin` — see above). Upserts the singleton row so the
// operator can correct the details on prod without a deploy, which is why this is
// a record rather than a Convex env var.
//
// Light validation only, mirroring `sellers.savePayoutDetails`: every field
// non-blank, account number and branch code numeric with spaces stripped. The
// operator eyeballs these before publishing them to buyers, and no API can tell
// us the account really exists.
// ponytail: the five validation lines are duplicated from sellers.ts rather than
// extracted — factoring them out would edit a working money-adjacent function for
// no behaviour change. Extract if a third bank-details form ever appears.
export const saveOperatorBank = mutation({
  args: { ...payoutDetailsValidator.fields, enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { accountHolder, bank, accountNumber, branchCode, enabled }) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const details = {
      accountHolder: accountHolder.trim(),
      bank: bank.trim(),
      accountNumber: accountNumber.replace(/\s+/g, ""),
      branchCode: branchCode.replace(/\s+/g, ""),
    };
    if (!details.accountHolder || !details.bank) throw new Error("every field is required");
    if (!/^\d{4,20}$/.test(details.accountNumber)) throw new Error("account number must be 4–20 digits");
    if (!/^\d+$/.test(details.branchCode)) throw new Error("branch code must be digits");
    const row = await getRow(ctx);
    if (row) await ctx.db.patch(row._id, { ...details, enabled });
    else await ctx.db.insert("operatorBank", { ...details, enabled });
    return null;
  },
});

// The buyer-facing read, for the paygate's "Pay by EFT" affordance: the account
// to transfer into, or `null` when the rail is off or unconfigured (so the button
// simply isn't offered).
//
// DELIBERATE DISCLOSURE: while the rail is enabled this returns the operator's
// bank details to **any signed-in caller**, not only to a caller mid-purchase.
// That is intentional and was decided in the PRD — bank details are printed on
// invoices, they are not a secret, and gating them per-Edition buys nothing a
// buyer couldn't get by clicking Buy. This is not an oversight to "fix": if it is
// ever tightened, tighten it on purpose. Sign-in IS required, because checkout is
// auth-first (.scratch/auth-first-checkout) so a real paygate always has an
// account behind it, and that keeps the details off anonymous/public pages.
export const eftDetails = query({
  args: {},
  returns: v.union(payoutDetailsValidator, v.null()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const row = await getRow(ctx);
    if (!row?.enabled) return null;
    const { accountHolder, bank, accountNumber, branchCode } = row;
    return { accountHolder, bank, accountNumber, branchCode };
  },
});
