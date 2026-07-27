import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { editionPrice, normaliseEmail, topicBySlug } from "./lib";
import { platformFeeBps, splitNet } from "./payfast";
import { bankAccountDetailsValidator } from "./schema";
import { isCallerAdmin } from "./whitelist";

// Bank transfer payments (.scratch/bank-transfer-payments) — the **manual** money
// path alongside PayFast's hosted checkout.
//
// A course owner keeps one **Collection account** per region (an Indian one, a
// South African one, …). A buyer on a paid Edition picks a region and gets that
// account's details plus a short **reference** to quote to their bank; the
// `bankTransfers` row holds the reference, the Edition, their account email and
// the price frozen at request. Requesting grants NOTHING. The course owner (or
// the Admin) approves the reference once the money lands, and THAT mints the
// Entitlement and writes the Ledger row — one transaction, the same "money in +
// what it means" seam `market.fulfillPurchase` is for the PayFast rail.
//
// Deliberately independent of the PayFast rail: nothing here reads
// `sellingEnabled()` or any PAYFAST_* var, so a paused/unconfigured merchant
// account never closes the marketplace.

// ---- the reference ----------------------------------------------------------

// A 31-symbol alphabet with every look-alike removed (no I, O, 0, 1) — the
// reference gets read off a screen and typed into a banking app, so a character
// a human can misread is a payment nobody can match.
const REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const REF_GROUPS = 2;
const REF_GROUP_LEN = 4;

// Mint a payment reference: `MC-XXXX-XXXX`, grouped for transcription. 31^8 ≈
// 8.5e11 — collisions are checked at insert anyway (mintReference), so this only
// has to make them rare. NOT a bearer capability: it is short enough to guess, so
// every read of a transfer is authorised by identity, never by possession.
export function formatReference(symbols: string): string {
  const groups: string[] = [];
  for (let i = 0; i < REF_GROUPS; i++) groups.push(symbols.slice(i * REF_GROUP_LEN, (i + 1) * REF_GROUP_LEN));
  return `MC-${groups.join("-")}`;
}

export function newReference(): string {
  const bytes = new Uint8Array(REF_GROUPS * REF_GROUP_LEN);
  crypto.getRandomValues(bytes);
  // Modulo bias over 31 symbols is a fraction of a percent — irrelevant for a
  // reference whose uniqueness is enforced by a DB check, not by entropy alone.
  return formatReference(Array.from(bytes, (b) => REF_ALPHABET[b % REF_ALPHABET.length]!).join(""));
}

// Normalise a reference typed by a human: trim, upper-case, and tolerate a
// missing/extra separator so `mc7k2p9qx4` finds `MC-7K2P-9QX4`.
export function normaliseReference(raw: string): string {
  const bare = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = bare.startsWith("MC") ? bare.slice(2) : bare;
  return formatReference(body.slice(0, REF_GROUPS * REF_GROUP_LEN));
}

// A reference no existing transfer holds. Re-rolls on the (vanishingly unlikely)
// collision rather than trusting entropy — a duplicate reference would make two
// payments indistinguishable, which is the one thing this feature must not do.
async function mintReference(ctx: MutationCtx): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const reference = newReference();
    const clash = await ctx.db
      .query("bankTransfers")
      .withIndex("by_reference", (q) => q.eq("reference", reference))
      .unique();
    if (!clash) return reference;
  }
  throw new Error("couldn't mint a unique payment reference — try again");
}

// ---- validators shared with the read shapes --------------------------------

// A Collection account as the BUYER sees it before requesting — label, country,
// currency and nothing else. The account numbers are deliberately absent: a paid
// Edition's page must not be scrapeable for the owner's bank details.
const bankOptionValidator = v.object({
  id: v.id("bankAccounts"),
  label: v.string(),
  country: v.string(),
  currency: v.string(),
});

const transferStatusValidator = v.union(v.literal("awaiting"), v.literal("approved"), v.literal("declined"));

// ---- Collection accounts: the owner's setup ---------------------------------

// Validate + normalise the details an owner typed. Light, like `savePayoutDetails`
// — the owner is describing their own account and a human reads it back off the
// buyer's screen, so the job is to reject blanks and obvious nonsense, not to
// model every country's account-number grammar (`routingCode` is free-form for
// exactly that reason).
function cleanDetails(raw: {
  label: string;
  country: string;
  currency: string;
  accountHolder: string;
  bankName: string;
  accountNumber: string;
  routingCode?: string;
  swift?: string;
  instructions?: string;
}) {
  const details = {
    label: raw.label.trim(),
    country: raw.country.trim().toUpperCase(),
    currency: raw.currency.trim().toLowerCase(),
    accountHolder: raw.accountHolder.trim(),
    bankName: raw.bankName.trim(),
    // Spaces and dashes are how banks print account numbers; store the bare value
    // so two spellings of one account never read as two accounts.
    accountNumber: raw.accountNumber.replace(/[\s-]+/g, ""),
    routingCode: raw.routingCode?.trim() || undefined,
    swift: raw.swift?.trim().toUpperCase() || undefined,
    instructions: raw.instructions?.trim() || undefined,
  };
  if (!details.label) throw new Error("give the account a label buyers will recognise");
  if (!/^[A-Z]{2}$/.test(details.country)) throw new Error("country must be a 2-letter code, e.g. IN or ZA");
  if (!/^[a-z]{3}$/.test(details.currency)) throw new Error("currency must be a 3-letter code, e.g. INR or ZAR");
  if (!details.accountHolder || !details.bankName) throw new Error("account holder and bank are required");
  if (!/^[A-Za-z0-9]{4,34}$/.test(details.accountNumber)) {
    throw new Error("account number must be 4–34 letters or digits");
  }
  return details;
}

// The caller's own Collection accounts, newest last — the owner's management list.
// Returns full details: they are the caller's own bank accounts.
export const myBankAccounts = query({
  args: {},
  returns: v.array(
    v.object({ id: v.id("bankAccounts"), details: bankAccountDetailsValidator, disabled: v.boolean() }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("bankAccounts")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    return rows.map((r) => ({ id: r._id, details: r.details, disabled: !!r.disabled }));
  },
});

// Add a Collection account (signed-in caller = its owner). No Seller gate: an
// account is just where money would arrive, and setting one up before the
// can-sell grant lands is harmless — pricing an Edition is what stays gated.
export const addBankAccount = mutation({
  args: bankAccountDetailsValidator.fields,
  returns: v.id("bankAccounts"),
  handler: async (ctx, raw) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("forbidden");
    return await ctx.db.insert("bankAccounts", { ownerId: userId, details: cleanDetails(raw) });
  },
});

// Correct a Collection account's details in place — a changed bank must never
// strand buyers. Owner-only; the reference of an already-requested transfer keeps
// pointing here, so the buyer's instructions update with it.
export const updateBankAccount = mutation({
  args: { id: v.id("bankAccounts"), ...bankAccountDetailsValidator.fields },
  returns: v.null(),
  handler: async (ctx, { id, ...raw }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("forbidden");
    const row = await ctx.db.get(id);
    if (!row || row.ownerId !== userId) throw new Error("not your bank account");
    await ctx.db.patch(id, { details: cleanDetails(raw) });
    return null;
  },
});

// Retire (or restore) a Collection account. Disabling hides it from the buyer's
// picker but keeps the row, so the Bank transfers that named it still resolve —
// deleting an account with payment history would orphan those references.
export const setBankAccountDisabled = mutation({
  args: { id: v.id("bankAccounts"), disabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { id, disabled }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("forbidden");
    const row = await ctx.db.get(id);
    if (!row || row.ownerId !== userId) throw new Error("not your bank account");
    await ctx.db.patch(id, { disabled });
    return null;
  },
});

// ---- the buyer's side -------------------------------------------------------

// The regions a buyer may pay into for this Edition: the owner's ENABLED
// Collection accounts, label/country/currency only. Empty when the Edition is
// free, has no owner, or the owner has set no account up — which is exactly how
// the UI decides whether to offer bank transfer at all.
export const bankOptions = query({
  args: { topicSlug: v.string(), lang: v.string() },
  returns: v.array(bankOptionValidator),
  handler: async (ctx, { topicSlug, lang }) => {
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic?.ownerId) return [];
    // Only a PAID Edition can be paid for; a free one needs no money path.
    if (!(await editionPrice(ctx, topic._id, lang))) return [];
    return await enabledAccounts(ctx, topic.ownerId);
  },
});

async function enabledAccounts(ctx: QueryCtx, ownerId: Id<"users">) {
  const rows = await ctx.db
    .query("bankAccounts")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .collect();
  return rows
    .filter((r) => !r.disabled)
    .map((r) => ({
      id: r._id,
      label: r.details.label,
      country: r.details.country,
      currency: r.details.currency,
    }));
}

// Ask to pay for an Edition by bank transfer. Auth-first (ADR 0021), like
// `market.startCheckout`: the buyer must be signed in and the email is their
// ACCOUNT's, never an argument — so approval mints straight onto a real account
// and there is no pending-Entitlement path. Freezes the price shown right now, so
// a re-price before the money lands can't invalidate a genuine payment.
//
// ONE open transfer per (buyer, Edition): a repeat returns the existing
// `awaiting` reference, re-pointed at a newly-chosen region. Two open references
// for one Edition would be two payments the owner has to reconcile.
//
// Grants NOTHING — access comes only from `approveBankTransfer`.
export const requestBankTransfer = mutation({
  args: { topicSlug: v.string(), lang: v.string(), bankAccountId: v.id("bankAccounts") },
  returns: v.string(),
  handler: async (ctx, { topicSlug, lang, bankAccountId }) => {
    const buyerId = await getAuthUserId(ctx);
    if (!buyerId) throw new Error("sign in to buy — a purchase attaches to your account");
    const buyer = await ctx.db.get(buyerId);
    if (!buyer?.email) throw new Error("your account has no email address");
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic?.ownerId) throw new Error("this edition isn't for sale");
    const listing = await editionPrice(ctx, topic._id, lang);
    if (!listing) throw new Error("this edition isn't for sale");
    const account = await ctx.db.get(bankAccountId);
    // The account must be one the COURSE OWNER offers and hasn't retired —
    // otherwise a buyer could be pointed at any account id they can name.
    if (!account || account.ownerId !== topic.ownerId || account.disabled) {
      throw new Error("that payment option isn't available");
    }

    const open = await openTransfer(ctx, topic._id, buyerId, lang);
    if (open) {
      // Switched region: keep the reference (the buyer may already have quoted it)
      // and re-point it. The price stays frozen at the FIRST request.
      if (open.bankAccountId !== bankAccountId) await ctx.db.patch(open._id, { bankAccountId });
      return open.reference;
    }

    const reference = await mintReference(ctx);
    await ctx.db.insert("bankTransfers", {
      reference,
      topicId: topic._id,
      lang,
      ownerId: topic.ownerId,
      buyerId,
      buyerEmail: normaliseEmail(buyer.email),
      bankAccountId,
      amount: listing.amount,
      currency: listing.currency,
      status: "awaiting",
    });
    return reference;
  },
});

// The caller's own `awaiting` transfer for an Edition, if any. In-memory `lang`
// match over the (Topic, buyer) index — a buyer may hold transfers for several
// Editions of one course.
async function openTransfer(
  ctx: QueryCtx,
  topicId: Id<"topics">,
  buyerId: Id<"users">,
  lang: string,
): Promise<Doc<"bankTransfers"> | null> {
  const rows = await ctx.db
    .query("bankTransfers")
    .withIndex("by_topic_user", (q) => q.eq("topicId", topicId).eq("buyerId", buyerId))
    .collect();
  return rows.find((r) => r.lang === lang && r.status === "awaiting") ?? null;
}

// The caller's own bank transfer for an Edition — the reference to quote, the full
// bank details to pay into, and where it stands. THE ONE READ that returns an
// owner's account numbers, and it returns them only to the buyer whose transfer
// names the account. Reactive, so the buyer's screen flips to `approved` the
// moment the owner approves. A declined transfer is still returned (with its
// note) so the buyer learns why instead of guessing; approving/declining
// therefore both resolve the buyer's wait.
export const myBankTransfer = query({
  args: { topicSlug: v.string(), lang: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      reference: v.string(),
      status: transferStatusValidator,
      amount: v.number(),
      currency: v.string(),
      note: v.union(v.string(), v.null()),
      account: v.union(bankAccountDetailsValidator, v.null()),
    }),
  ),
  handler: async (ctx, { topicSlug, lang }) => {
    const buyerId = await getAuthUserId(ctx);
    if (!buyerId) return null;
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) return null;
    const rows = await ctx.db
      .query("bankTransfers")
      .withIndex("by_topic_user", (q) => q.eq("topicId", topic._id).eq("buyerId", buyerId))
      .collect();
    // The latest for this Edition: an `awaiting` one is what the buyer is acting
    // on; once decided, the most recent decision is the answer.
    const mine = rows
      .filter((r) => r.lang === lang)
      .sort((a, b) => a._creationTime - b._creationTime)
      .pop();
    if (!mine) return null;
    const account = await ctx.db.get(mine.bankAccountId);
    return {
      reference: mine.reference,
      status: mine.status,
      amount: mine.amount,
      currency: mine.currency,
      note: mine.note ?? null,
      account: account?.details ?? null,
    };
  },
});

// ---- the approval queue -----------------------------------------------------

const queueRowValidator = v.object({
  reference: v.string(),
  topicSlug: v.string(),
  courseTitle: v.string(),
  lang: v.string(),
  buyerEmail: v.string(),
  amount: v.number(),
  currency: v.string(),
  accountLabel: v.string(),
  accountCurrency: v.string(),
  requestedAt: v.number(),
});

// Bank transfers awaiting a decision. Scoped by who is asking: a course owner
// sees their OWN courses' transfers (one indexed read on the denormalised
// `ownerId`); the Admin — passing `all` — sees every course's, so they can act
// when an owner can't. An owner asking for `all` gets their own rows regardless:
// scope is derived server-side from the caller, never trusted from the argument.
export const pendingTransfers = query({
  args: { all: v.optional(v.boolean()) },
  returns: v.array(queueRowValidator),
  handler: async (ctx, { all }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows =
      all && (await isCallerAdmin(ctx))
        ? await ctx.db
            .query("bankTransfers")
            .withIndex("by_status", (q) => q.eq("status", "awaiting"))
            .take(500)
        : await ctx.db
            .query("bankTransfers")
            .withIndex("by_owner_status", (q) => q.eq("ownerId", userId).eq("status", "awaiting"))
            .take(500);
    const out = await Promise.all(
      rows.map(async (r) => {
        const topic = await ctx.db.get(r.topicId);
        const account = await ctx.db.get(r.bankAccountId);
        return {
          reference: r.reference,
          topicSlug: topic?.slug ?? "",
          courseTitle: topic?.title ?? "(deleted course)",
          lang: r.lang,
          buyerEmail: r.buyerEmail,
          amount: r.amount,
          currency: r.currency,
          accountLabel: account?.details.label ?? "(deleted account)",
          accountCurrency: account?.details.currency ?? "",
          requestedAt: r._creationTime,
        };
      }),
    );
    // Oldest first: the longest-waiting buyer is the one to deal with next.
    return out.sort((a, b) => a.requestedAt - b.requestedAt);
  },
});

// The transfer this reference names, if the caller may decide it. The Topic owner
// or the Admin — a guessed reference reveals nothing to anyone else, which is why
// the short reference is safe to print.
async function decidableTransfer(ctx: MutationCtx, rawRef: string): Promise<Doc<"bankTransfers">> {
  const reference = normaliseReference(rawRef);
  const transfer = await ctx.db
    .query("bankTransfers")
    .withIndex("by_reference", (q) => q.eq("reference", reference))
    .unique();
  if (!transfer) throw new Error("no payment with that reference");
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("forbidden");
  if (transfer.ownerId !== userId && !(await isCallerAdmin(ctx))) throw new Error("forbidden");
  return transfer;
}

// Approve a bank transfer from its reference — the money landed, so grant access.
// The course OWNER's action (the Admin may also act); this is the seam that turns
// a payment into an Entitlement, and it does both halves in ONE transaction, like
// `market.fulfillPurchase`:
//   1. mint the Entitlement for that Edition onto the buyer's account, and
//   2. write the sale's Ledger row.
// The Ledger row is written `paid` with `payoutRef` = the reference: the buyer
// paid into the owner's OWN Collection account, so there is nothing for the
// operator to EFT out — an `owed` row would invite a double payout. `fee` is 0
// (no gateway took a cut) unless the approver records a `receivedAmount` short of
// the asking price, in which case the shortfall IS the fee and the split is
// computed on what actually arrived.
//
// Idempotent: only an `awaiting` row is acted on, and it is patched terminal in
// the same transaction as the mint — so a double-click, or two approvers at once,
// can never double-grant or double-write the Ledger.
export const approveBankTransfer = mutation({
  args: {
    reference: v.string(),
    // What actually arrived (minor units), when it differs from the asking price —
    // a cross-border FX difference or a bank charge. Omitted ⇒ paid in full.
    receivedAmount: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { reference, receivedAmount, note }) => {
    const transfer = await decidableTransfer(ctx, reference);
    // Already decided — a replay, not a second sale.
    if (transfer.status !== "awaiting") return null;
    if (receivedAmount !== undefined && (!Number.isInteger(receivedAmount) || receivedAmount < 0)) {
      throw new Error("the received amount must be non-negative integer minor units");
    }
    const decidedBy = (await getAuthUserId(ctx))!;

    // 1. Access. Idempotent per (buyer, Topic, language) — a buyer who somehow
    //    already holds this Edition keeps their one Entitlement.
    const held = await ctx.db
      .query("entitlements")
      .withIndex("by_topic_user", (q) => q.eq("topicId", transfer.topicId).eq("userId", transfer.buyerId))
      .collect();
    if (!held.some((e) => e.lang === transfer.lang)) {
      await ctx.db.insert("entitlements", {
        userId: transfer.buyerId,
        topicId: transfer.topicId,
        lang: transfer.lang,
        bankTransferRef: transfer.reference,
      });
    }

    // 2. Money. `gross` is what was asked; `net` is what arrived; the difference
    //    is the cost of the transfer, recorded as `fee` so gross = fee + net holds
    //    on both rails and `sales.report` stays comparable.
    const gross = transfer.amount;
    const net = receivedAmount ?? gross;
    const { sellerShare, platformShare } = splitNet(net, platformFeeBps());
    await ctx.db.insert("ledger", {
      topicId: transfer.topicId,
      lang: transfer.lang,
      sellerId: transfer.ownerId,
      buyerEmail: transfer.buyerEmail,
      gross,
      fee: gross - net,
      net,
      sellerShare,
      platformShare,
      bankTransferRef: transfer.reference,
      // Collected straight into the Seller's own account — nothing to pay out.
      status: "paid",
      payoutRef: transfer.reference,
    });

    await ctx.db.patch(transfer._id, {
      status: "approved",
      decidedBy,
      decidedAt: Date.now(),
      ...(receivedAmount !== undefined ? { receivedAmount } : {}),
      ...(note?.trim() ? { note: note.trim() } : {}),
    });
    return null;
  },
});

// Decline a bank transfer — the money never arrived, or arrived wrong. Closes the
// reference with a reason the buyer reads on their own screen, so a dead payment
// stops looking pending forever. Grants nothing and writes no Ledger row. The
// buyer may request again, which mints a fresh reference.
export const declineBankTransfer = mutation({
  args: { reference: v.string(), note: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { reference, note }) => {
    const transfer = await decidableTransfer(ctx, reference);
    if (transfer.status !== "awaiting") return null;
    await ctx.db.patch(transfer._id, {
      status: "declined",
      decidedBy: (await getAuthUserId(ctx))!,
      decidedAt: Date.now(),
      ...(note?.trim() ? { note: note.trim() } : {}),
    });
    return null;
  },
});
