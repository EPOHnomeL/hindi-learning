import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { normaliseEmail } from "./lib";
import { isReadySeller } from "./sellerStatus";
import { appUrl, buildCheckoutFields, processUrl, randFromCents, sellingEnabled, splitNet } from "./payfast";

// The **donation rail** (ADR 0027) — the other way money enters the platform.
// A Guest on a tenant's landing page types a dollar amount, is charged Rand
// through the operator's existing PayFast account, and the operator keeps 10%
// of net and owes the rest to that tenant's nominated `donationPayee` through
// the existing Ledger + Payouts tab. **A donation grants nothing**: no
// Entitlement, no access, no account.
//
// Two functions, and the shape of the pair is the point:
//   - `checkoutFields` — an UNAUTHENTICATED QUERY. Not a mutation, not an
//     action. `buildCheckoutFields` is pure (no ctx, no network), and a
//     donation has no price to freeze, so there is no intent row to write and
//     therefore nothing to persist before the money is real. ADR 0013's
//     structural "there are no public mutations" guarantee survives intact, and
//     an anonymous caller has no junk-row abuse surface to reach.
//   - `fulfillDonation` — the verified-ITN write, called only from http.ts.
//
// All three numbers below are committed constants, changed by deploy —
// consistent with the surface they serve (`src/app/_landing/registry.ts`: a
// landing page is hand-authored, "no DB, nothing runtime-editable").

// The platform's cut of a donation's NET, in basis points — 10%.
//
// **Deliberately NOT `PLATFORM_FEE_BPS`.** That is a global env var set to 5000
// for the 50/50 sale split; reusing it would silently take half of every
// donation. Bounded like `platformFeeBps()` so a future edit can't invert the
// economics, and a constant rather than an env var because the donation
// take-rate is stated in the widget copy — it cannot drift per deployment.
export const DONATION_FEE_BPS = 1000;

// The USD→ZAR rate the donor's typed dollars are charged in. The donor types
// dollars; PayFast charges Rand; this is the only bridge between them, so it is
// shown to the donor before they commit ("you will be charged R920.00 (ZAR)").
//
// A committed constant, and it WILL go stale if nobody watches it — that cost
// was accepted knowingly (see the follow-up ticket, Live USD→ZAR rate). It errs
// slightly under the market rate so the Rand charge never exceeds what a
// donor's own mental conversion of the dollar figure would suggest.
export const USD_ZAR_RATE = 18.4;

// The floor on a donation, in US cents. Not cosmetic: PayFast's per-transaction
// fee comes off the gross before the split, so a $1 donation is mostly fee and
// the payee's 90% of what's left is noise. The floor protects the payee's cut.
export const MIN_DONATION_USD_CENTS = 500;

// US cents → the ZAR cents PayFast is asked to charge. Integer math at the
// money boundary; the rounding is the last float in the chain and lands on a
// whole cent. Exported because the widget shows the ZAR figure this returns —
// the anti-surprise line must quote the number actually charged, not its own
// second conversion of the same dollars.
export function zarCentsFromUsdCents(usdCents: number): number {
  return Math.round(usdCents * USD_ZAR_RATE);
}

// The tenant a donation is solicited for, and the payee it would be owed to —
// or a reason it cannot be taken. **The same gate the flag toggle enforces**
// (tenants.setTenantFlags), re-run here at the moment of the ask: a payee whose
// seller grant or bank details were revoked after the flag went on must not
// keep collecting, so readiness is checked live and never cached into the flag.
export async function donationTarget(
  ctx: QueryCtx,
  tenantSlug: string,
): Promise<{ tenant: Doc<"tenants">; payeeId: Doc<"tenants">["donationPayee"] & string } | { error: string }> {
  const tenant = await ctx.db
    .query("tenants")
    .withIndex("by_slug", (q) => q.eq("slug", tenantSlug))
    .unique();
  // Fail closed on an unknown slug, exactly like assertTenantFlag.
  if (!tenant) return { error: "donations aren't enabled on this site" };
  if (!tenant.flags.donations) return { error: "donations aren't enabled on this site" };
  const payeeId = tenant.donationPayee;
  if (!payeeId) return { error: "donations aren't enabled on this site" };
  // Structurally impossible to accrue donation debt with nowhere to send it.
  if (!(await isReadySeller(ctx, payeeId))) return { error: "donations aren't enabled on this site" };
  return { tenant, payeeId };
}

// The signed PayFast field set for a donor-chosen amount — the ONLY server call
// the donation widget makes, and it writes nothing. Unauthenticated by design:
// the donor is a Guest (ADR 0021's auth-first rule has no subject here, because
// a donation grants nothing there is an account to attach to), and requiring
// sign-up from a stranger before they may give money would cost donations for
// no gain. PayFast collects the email on its own page and hands it back on the
// ITN, which is where `buyerEmail` comes from.
//
// `custom_str1 = tenantSlug` / `custom_str2 = "donation"` is the entire
// mechanism: the ITN reads them back to know which tenant's payee to credit.
// They are inside the signature, so neither can be tampered with in flight.
export const checkoutFields = query({
  args: { tenantSlug: v.string(), usdCents: v.number() },
  // An ORDERED list of pairs, not a record: Convex sorts object keys and
  // PayFast's signature is computed over the field order, so the client must
  // POST them in exactly this order. `zarCents` rides along so the widget's
  // anti-surprise line quotes the number actually being charged.
  returns: v.object({
    action: v.string(),
    fields: v.array(v.object({ name: v.string(), value: v.string() })),
    zarCents: v.number(),
  }),
  handler: async (ctx, { tenantSlug, usdCents }) => {
    // The platform-wide PayFast gates apply to donations too: an unprovisioned
    // rail or PAYFAST_MODE=off must not send anyone to a gateway that'd 400 them.
    if (!sellingEnabled()) throw new Error("donations aren't available right now");
    if (!Number.isInteger(usdCents) || usdCents < MIN_DONATION_USD_CENTS) {
      throw new Error(`the minimum donation is $${MIN_DONATION_USD_CENTS / 100}`);
    }
    // A ceiling for the same reason pricing has one: a stray value (a fat-fingered
    // paste, a scripted caller) shouldn't reach the gateway as a real charge.
    if (usdCents > 1_000_000) throw new Error("that donation is too large — please contact us");

    const target = await donationTarget(ctx, tenantSlug);
    if ("error" in target) throw new Error(target.error);

    const merchantId = process.env.PAYFAST_MERCHANT_ID;
    const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
    const passphrase = process.env.PAYFAST_PASSPHRASE;
    if (!merchantId || !merchantKey || !passphrase) {
      throw new Error("PAYFAST_MERCHANT_ID / PAYFAST_MERCHANT_KEY / PAYFAST_PASSPHRASE are not set — provision them as Convex env vars");
    }

    const zarCents = zarCentsFromUsdCents(usdCents);
    // Back to the tenant's own DEDICATED donate page — under ADR 0025 sessions
    // are host-only per subdomain, so the return must ride the tenant's own host.
    const back = "/donate";
    const fields = buildCheckoutFields({
      merchantId,
      merchantKey,
      // **This used to be `/?donation=thanks#donations`, and the anchor was the
      // bug** (spec-donate-route.md, 2026-08-02). The reasoning was sound — the
      // section sits partway down a long landing page, so a bare `/` leaves the
      // thank-you off screen — but the fix didn't work: <DonateSection/> renders
      // null until its queries resolve, so the anchor had no target when the
      // browser looked for it, and signed in `/` is the Dashboard, which has no
      // section at all. Either way a donor who had just paid saw no
      // acknowledgement. A dedicated page needs no anchor, which is the point.
      returnUrl: appUrl("/donate?donation=thanks", tenantSlug),
      cancelUrl: appUrl(back, tenantSlug),
      notifyUrl: `${process.env.CONVEX_SITE_URL}/payfast/notify`,
      amountCents: zarCents,
      itemName: `Donation to ${target.tenant.displayName}`,
      custom1: tenantSlug,
      custom2: "donation",
      passphrase,
    });
    return { action: processUrl(), fields: Object.entries(fields).map(([name, value]) => ({ name, value })), zarCents };
  },
});

// Record a verified COMPLETE donation: one `kind: "donation"` Ledger row owed
// to the tenant's payee, and **nothing else**. No Entitlement is minted —
// that is the structural difference from `market.fulfillPurchase`, not an
// omission. Idempotent per pf_payment_id through the same `payfastEvents`
// table the sale rail uses, so a PayFast re-delivery is a no-op.
//
// The tenant/payee/readiness gate is re-run HERE rather than trusted from
// checkout time, because the two are separated by however long the donor spent
// on PayFast's page. A throw rolls back the payfastEvents row too, so http.ts's
// 500 makes PayFast retry the whole thing — money is never silently dropped.
export const fulfillDonation = internalMutation({
  args: {
    pfPaymentId: v.string(),
    tenantSlug: v.string(),
    donorEmail: v.string(),
    gross: v.number(),
    fee: v.number(),
    net: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { pfPaymentId, tenantSlug, donorEmail, gross, fee, net }) => {
    for (const n of [gross, fee, net]) {
      if (!Number.isInteger(n) || n < 0) throw new Error("ledger amounts must be non-negative integer cents");
    }
    const seen = await ctx.db
      .query("payfastEvents")
      .withIndex("by_pf_payment_id", (q) => q.eq("pfPaymentId", pfPaymentId))
      .unique();
    if (seen) return null;
    await ctx.db.insert("payfastEvents", { pfPaymentId });

    const target = await donationTarget(ctx, tenantSlug);
    // A donation that arrives with no valid payee is a genuine payment we cannot
    // attribute — throw so PayFast retries and the operator sees it, rather than
    // banking it silently with nobody owed.
    if ("error" in target) throw new Error(`cannot attribute donation ${pfPaymentId}: ${target.error}`);

    const { sellerShare, platformShare } = splitNet(net, DONATION_FEE_BPS);
    await ctx.db.insert("ledger", {
      // No topicId, no lang: a donation buys no Edition.
      sellerId: target.payeeId,
      buyerEmail: normaliseEmail(donorEmail),
      gross,
      fee,
      net,
      sellerShare,
      platformShare,
      pfPaymentId,
      kind: "donation",
      status: "owed",
    });
    return null;
  },
});

// The donation rail's public copy numbers, for the widget (ticket 08) — the
// presets, the floor, and the rate, from the one place they're defined. A query
// rather than a shared constants import so the widget can render on the server
// without duplicating the conversion, and so a rate change ships with the
// deploy that changes it.
export const config = query({
  args: {},
  returns: v.object({
    minUsdCents: v.number(),
    usdZarRate: v.number(),
    feeBps: v.number(),
    exampleZar: v.string(),
  }),
  handler: async () => ({
    minUsdCents: MIN_DONATION_USD_CENTS,
    usdZarRate: USD_ZAR_RATE,
    feeBps: DONATION_FEE_BPS,
    exampleZar: randFromCents(zarCentsFromUsdCents(MIN_DONATION_USD_CENTS)),
  }),
});
