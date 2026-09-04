import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { editionPrice, hasEntitlement, translatedTitle } from "./edition";
import { topicBySlug } from "./topicAccess";
import { normaliseEmail } from "./shareGrants";
import { SOURCE_LANG } from "./sourceLang";
import { langInfo } from "./languages";
import { appUrl, platformFeeBps, splitNet } from "./payfast";
import { eftAllowed, regionForCountry } from "./regions";
import { payoutDetailsValidator } from "./schema";
import { isReadySeller } from "./sellerStatus";
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
    return bankOf(row);
  },
});

// The four buyer-facing fields of the collection account, without `enabled`.
function bankOf(row: Doc<"operatorBank">) {
  const { accountHolder, bank, accountNumber, branchCode } = row;
  return { accountHolder, bank, accountNumber, branchCode };
}

// ---- The buyer's reference (ticket 03) --------------------------------------

// The random half of a reference. Excludes characters that collide when
// handwritten or read down a phone line — I/1, O/0, S/5, Z/2 — because the buyer
// retypes this into a banking app and a mistyped reference is a payment the
// operator cannot match to anyone.
const REF_ALPHABET = "ACDEFGHJKMNPQRTUVWXY34679";

// A reference: a course-derived prefix (so the operator recognises it on the
// statement at a glance) + a random suffix (so it's unique per buyer per Edition).
// e.g. `TSW-4F2K`. Deliberately NOT the PayFast `m_payment_id` UUID — a human
// types this one.
function mintRef(slug: string): string {
  const prefix = (slug.replace(/[^a-zA-Z]/g, "").slice(0, 3) || "EFT").toUpperCase();
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join("");
  return `${prefix}-${suffix}`;
}

// The caller's own PENDING intent on one Edition, if any. `status` is the whole
// mechanism: a confirmed intent has already granted access (so the reader isn't
// locked any more) and a dismissed one never got paid, so both read as "nothing
// pending" and the buyer is free to start again. Lang is matched in memory over
// the buyer's intents on this course, like entitlements/shares.
async function pendingIntent(ctx: MutationCtx | QueryCtx, userId: Doc<"users">["_id"], topicId: Doc<"topics">["_id"], lang: string) {
  const rows = await ctx.db
    .query("eftIntents")
    .withIndex("by_user_topic", (q) => q.eq("userId", userId).eq("topicId", topicId))
    .collect();
  return rows.find((r) => r.lang === lang && r.status === "pending") ?? null;
}

// Start an EFT purchase: record the intent and hand the buyer the reference and
// the account to transfer into. Auth-first (ADR 0021) exactly like
// `market.startCheckout` — the intent is keyed to the signed-in ACCOUNT, never a
// typed email, because the operator's confirmation grants access to that account.
//
// Access is NOT granted here, and no email is sent: an intent is a promise to
// pay. Only the operator confirming the money arrived (ticket 04) mints the
// Entitlement and the Ledger row.
//
// Idempotent per (buyer, Edition): a second click returns the SAME reference
// rather than minting a competing one. Two references for one buyer and one
// Edition is how a real transfer ends up matched to the wrong row, or to none.
export const startEftPurchase = mutation({
  args: {
    topicSlug: v.string(),
    lang: v.string(),
    // The buyer's country, for the base-price gate below (ticket 11 §6).
    country: v.optional(v.string()),
  },
  returns: v.object({ ref: v.string(), amount: v.number(), bank: payoutDetailsValidator }),
  handler: async (ctx, { topicSlug, lang, country }) => {
    const row = await getRow(ctx);
    // The rail's own toggle governs — deliberately NOT PayFast's `sellingEnabled()`.
    // The point of this rail is to sell when the gateway is the obstacle.
    if (!row?.enabled) throw new Error("EFT payment isn't available right now");
    // **EFT is base-price only** (regional pricing, ticket 11 §6). It is a South
    // African bank rail, and leaving it open to a buyer quoted $10 by card would
    // hand them a 45% discount for clicking the other button. Gated on the
    // REGION rather than on `country === "ZA"` so the arbitrage closes by
    // construction and a no-header caller still gets through — localhost sends
    // no country, and the operator walking this rail in dev must not be locked
    // out of it. The UI hides the option too; this is the gate, that is polish.
    if (!eftAllowed(regionForCountry(country))) {
      throw new Error("EFT is for South African bank accounts — please pay by card");
    }
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("sign in to pay by EFT — a purchase attaches to your account");
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) throw new Error("this edition isn't for sale");
    const listing = await editionPrice(ctx, topic._id, lang);
    if (!listing) throw new Error("this edition isn't for sale");
    // Same invariant as the card rail: never sell a seat whose Seller has nowhere
    // to be paid out to.
    if (!topic.ownerId || !(await isReadySeller(ctx, topic.ownerId))) {
      throw new Error("this course isn't available for purchase right now");
    }

    const existing = await pendingIntent(ctx, userId, topic._id, lang);
    if (existing) return { ref: existing.ref, amount: existing.amount, bank: bankOf(row) };

    // Uniqueness is enforced on read, not by a constraint (Convex has none): retry
    // until the minted reference is unused. 25^4 ≈ 390k suffixes per course prefix,
    // so a collision is already unlikely at hundreds of sales.
    // ponytail: bounded retry loop, not a counter table — revisit if a course ever
    // sells enough for collisions to be routine.
    let ref = mintRef(topicSlug);
    for (let i = 0; i < 5; i++) {
      const clash = await ctx.db
        .query("eftIntents")
        .withIndex("by_ref", (q) => q.eq("ref", ref))
        .first();
      if (!clash) break;
      ref = mintRef(topicSlug);
    }

    // The price SHOWN at this click is frozen onto the intent (like
    // `checkoutIntents.amount`), so a re-price before the money lands never
    // strands a genuine payment — the operator confirms what the buyer was told.
    await ctx.db.insert("eftIntents", {
      ref,
      userId,
      topicId: topic._id,
      lang,
      amount: listing.amount,
      status: "pending",
    });
    return { ref, amount: listing.amount, bank: bankOf(row) };
  },
});

// The caller's pending EFT purchase on one Edition — the returning buyer's state.
// An EFT clears in hours or days, so a buyer who comes back before the operator
// confirms must see "waiting for your transfer", with the reference and account
// again: the bare paygate reappearing reads as "my payment failed".
//
// Reactive, like `market.checkoutStatus`: it resolves itself the moment the
// operator confirms (the row leaves `pending` in the same transaction that mints
// the Entitlement), so the reader unlocks with no reload and no polling.
export const myEftIntent = query({
  args: { topicSlug: v.string(), lang: v.string() },
  returns: v.union(v.object({ ref: v.string(), amount: v.number(), bank: payoutDetailsValidator }), v.null()),
  handler: async (ctx, { topicSlug, lang }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const row = await getRow(ctx);
    if (!row) return null;
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) return null;
    const intent = await pendingIntent(ctx, userId, topic._id, lang);
    if (!intent) return null;
    return { ref: intent.ref, amount: intent.amount, bank: bankOf(row) };
  },
});

// Every Edition the caller has a transfer outstanding on, for the signed-in
// overview. A pending EFT buyer holds NO Entitlement — that is the whole point
// of the rail, access comes only on confirmation — so `market.myPurchases`
// cannot see them and the dashboard showed their course under "Available", at
// full price, as though they had never started. That is the dead end this fixes:
// having transferred real money, the buyer had nowhere in the app that
// acknowledged it.
//
// Deliberately does NOT return the bank details. This is a list, not the
// instructions panel; the details live on `/checkout/<slug>/<lang>`, which the
// card links to, and a query that feeds every dashboard render is the wrong
// place to hand out the operator's account number.
//
// Reactive like `myEftIntent`: the row leaves `pending` in the same transaction
// that mints the Entitlement, so on confirmation the card vanishes from here and
// reappears under Purchased with no reload.
export const myPendingIntents = query({
  args: {},
  returns: v.array(
    v.object({
      slug: v.string(),
      title: v.string(),
      lang: v.string(),
      langName: v.string(),
      ref: v.string(),
      amount: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    // `by_user_topic` on its userId prefix — no new index for a per-buyer read.
    const rows = await ctx.db
      .query("eftIntents")
      .withIndex("by_user_topic", (q) => q.eq("userId", userId))
      .collect();
    const cards = await Promise.all(
      rows
        .filter((r) => r.status === "pending")
        .map(async (r) => {
          const topic = await ctx.db.get(r.topicId);
          if (!topic) return null;
          return {
            slug: topic.slug,
            title: await translatedTitle(ctx, topic._id, r.lang, topic.title),
            lang: r.lang,
            langName: r.lang === SOURCE_LANG ? "English" : langInfo(r.lang).name,
            ref: r.ref,
            amount: r.amount,
          };
        }),
    );
    return cards.filter((c) => c !== null);
  },
});

// ---- The operator's confirm queue (ticket 04) --------------------------------

// A pending intent by its reference. `ref` is what the operator reads off their
// bank statement, so it's the queue's natural key.
async function intentByRef(ctx: MutationCtx | QueryCtx, ref: string) {
  return await ctx.db
    .query("eftIntents")
    .withIndex("by_ref", (q) => q.eq("ref", ref))
    .unique();
}

// The pending EFT payments, for the operator's queue (sys admin only — confirming
// mints access AND money). Everything needed to match a transfer on a bank
// statement to a person and an Edition: reference, buyer email, course, language,
// amount. Resolved intents are absent by construction — this is a to-do list, not
// a log; a queue that silts up stops being read, and that is how a real payment
// gets missed.
export const pendingEftIntents = query({
  args: {},
  returns: v.array(
    v.object({
      ref: v.string(),
      email: v.string(),
      courseTitle: v.string(),
      lang: v.string(),
      amount: v.number(),
    }),
  ),
  handler: async (ctx) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    // Bounded: the queue is what the operator has yet to confirm by hand, so it is
    // small by definition — but read it through the index and cap it anyway.
    const rows = await ctx.db
      .query("eftIntents")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(500);
    return await Promise.all(
      rows.map(async (r) => {
        const [user, topic] = await Promise.all([ctx.db.get(r.userId), ctx.db.get(r.topicId)]);
        return {
          ref: r.ref,
          email: user?.email ?? "(unknown)",
          courseTitle: topic?.title ?? "(deleted course)",
          lang: r.lang,
          amount: r.amount,
        };
      }),
    );
  },
});

// The money arrived: mint the Entitlement AND the Ledger row, in one transaction,
// mirroring `market.fulfillPurchase`'s ordering and its idempotency guarantees.
// Sys admin only.
//
// A bare `market.grantEntitlement` would give access but write no Ledger row, so
// the sale would be invisible to the Sales tab and never `owed` in Payouts — a
// sale the operator can't see is a sale the seller doesn't get paid for. Hence
// both writes here, together.
//
// `fee: 0` and `net == gross`: no gateway took a cut. The 50/50 split still goes
// through `splitNet`, so payout arithmetic stays identical to the card rail's.
//
// Idempotent on BOTH keys, which is the money-losing failure this exists to
// prevent: per reference (only a `pending` row is ever acted on) and per
// (buyer, Topic, language). A buyer who already holds the Edition — they bought it
// by card meanwhile — simply gets no second Entitlement; per the operator's
// 2026-07-29 decision that rare collision is sorted out by hand, so there is
// deliberately no branch, warning or special case for it here.
export const confirmEftPayment = mutation({
  args: { ref: v.string() },
  returns: v.null(),
  handler: async (ctx, { ref }) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const intent = await intentByRef(ctx, ref);
    // Not pending → already confirmed, or dismissed. Either way a no-op: a second
    // click must never mean a second grant or a second Ledger row.
    if (!intent || intent.status !== "pending") return null;

    const user = await ctx.db.get(intent.userId);
    if (!user) throw new Error(`no account behind ${ref} — cannot grant access to nobody`);
    const topic = await ctx.db.get(intent.topicId);
    if (!topic?.ownerId) throw new Error(`the course behind ${ref} has no owner to owe`);

    if (!(await hasEntitlement(ctx, intent.topicId, intent.userId, intent.lang))) {
      await ctx.db.insert("entitlements", {
        userId: intent.userId,
        topicId: intent.topicId,
        lang: intent.lang,
        eftRef: ref,
      });
    }

    // The money, recorded the way the card rail records it — same table, same
    // `owed` status, same split — so Sales and Payouts need no EFT special case.
    const gross = intent.amount;
    const { sellerShare, platformShare } = splitNet(gross, platformFeeBps());
    await ctx.db.insert("ledger", {
      topicId: intent.topicId,
      lang: intent.lang,
      sellerId: topic.ownerId,
      buyerEmail: normaliseEmail(user.email ?? ""),
      gross,
      fee: 0,
      net: gross,
      sellerShare,
      platformShare,
      eftRef: ref,
      kind: "sale",
      status: "owed",
    });

    await ctx.db.patch(intent._id, { status: "confirmed" });

    // The one email this rail sends (ticket 05). An EFT clears in hours or days
    // and the buyer closed the tab long ago; if nothing reaches them they conclude
    // they have been robbed, and the operator hears about the sale as a support
    // message. Scheduled AFTER the writes, best-effort: `email.sendInvite` no-ops
    // with a warning when Resend is unconfigured and swallows a bad response, so a
    // bounced email can never roll back a confirmed sale.
    //
    // Nothing is sent on a repeat confirm — the not-pending early return above
    // means we never get here twice — and nothing is sent on dismiss.
    // Everything in here is best-effort, INCLUDING building the link: `appUrl`
    // throws when SITE_URL isn't provisioned, and a throw in a mutation rolls back
    // the transaction — which would mean an unconfigurable deployment silently
    // refusing to confirm real payments. The sale is the thing that matters; if we
    // can't email about it, log and move on.
    try {
      await scheduleAccessEmail(ctx, { intent, topic, buyerEmail: user.email ?? "" });
    } catch (err) {
      console.error(`confirmEftPayment: could not schedule the access email for ${ref}:`, err);
    }
    return null;
  },
});

// The "your access is live" email for a confirmed transfer. Split out so the
// caller can treat the whole thing — link building included — as best-effort.
async function scheduleAccessEmail(
  ctx: MutationCtx,
  { intent, topic, buyerEmail }: { intent: Doc<"eftIntents">; topic: Doc<"topics">; buyerEmail: string },
): Promise<void> {
  const langName = intent.lang === SOURCE_LANG ? "English" : langInfo(intent.lang).name;
  const seller = topic.ownerId ? await ctx.db.get(topic.ownerId) : null;
  await ctx.scheduler.runAfter(0, internal.email.sendInvite, {
    to: normaliseEmail(buyerEmail),
    kind: "purchased",
    courseTitle: topic.title,
    langName,
    // Unused by the purchased copy (a buyer doesn't care who the seller is), but
    // the payload field is shared with invites — carry the seller for the log.
    inviterEmail: normaliseEmail(seller?.email ?? ""),
    role: "viewer",
    // The deep link must ride the TENANT's own host: under ADR 0025 sessions are
    // host-only per subdomain, so a link to the apex lands the buyer signed out
    // looking at a paygate for a course they just paid for.
    link: appUrl(
      intent.lang === SOURCE_LANG
        ? `/courses/${topic.slug}`
        : `/courses/${topic.slug}?lang=${encodeURIComponent(intent.lang)}`,
      topic.tenantSlug,
    ),
    brand: await tenantBrand(ctx, topic.tenantSlug),
  });
}

// The tenant's email brand, so a YWAM Potch buyer gets a YWAM Potch email rather
// than a house-branded one immediately after paying them money. Same one-row
// `by_slug` read as `shares.ts`'s copy; `undefined` for the default site.
// ponytail: duplicated from shares.ts rather than hoisted into a shared module,
// two call sites, ten lines, and hoisting would touch the working invite path.
// Hoist on the third caller, into `tenantTheme.ts`, never the Edition core.
async function tenantBrand(
  ctx: MutationCtx,
  slug: string | undefined,
): Promise<{ name: string; light: Record<string, string>; logoUrl: string | null } | undefined> {
  if (!slug) return undefined;
  const tenant = await ctx.db
    .query("tenants")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
  if (!tenant) return undefined;
  return {
    name: tenant.displayName,
    light: tenant.theme.light,
    logoUrl: tenant.theme.logo ? await ctx.storage.getUrl(tenant.theme.logo) : null,
  };
}

// The transfer never came: take the intent off the queue. Grants nothing, records
// no money, and is not an error state — stale intents are litter. Without a
// dismiss the queue silts up and stops being read, which is the slow path to a
// real payment being missed. Sys admin only.
export const dismissEftIntent = mutation({
  args: { ref: v.string() },
  returns: v.null(),
  handler: async (ctx, { ref }) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const intent = await intentByRef(ctx, ref);
    if (!intent || intent.status !== "pending") return null;
    await ctx.db.patch(intent._id, { status: "dismissed" });
    return null;
  },
});
