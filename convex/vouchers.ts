import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { publishedLangs, topicBySlug } from "./lib";
import { platformFeeBps, splitNet } from "./payfast";
import { getSeller, sellerStatusOf } from "./sellerStatus";

// The **seller-minted voucher rail** (ADR 0029, the vouchers map's spec.md). An
// organisation buys N seats on one Edition and will not hand over its members'
// addresses, so the Seller mints single-use codes instead of the platform
// granting access to a list of people it has never been given.
//
// Three things in here look like bugs to a reader who has not read the ADR, and
// each one is load-bearing:
//
//   1. **Codes are live the moment they are minted**, before any money arrives.
//      The batch's Ledger row is written `unpaid` and is invisible to
//      `ledger.owedPayouts` until the sysadmin logs the transfer (ticket 04), so
//      the platform's protection is that the SELLER is not paid yet, not that the
//      seats are withheld. The Seller owns the commercial relationship, so the
//      risk is theirs.
//   2. **A redemption records nothing about who redeemed.** The voucher row gets a
//      `redeemedAt` and no user id.
//   3. **A voucher Entitlement is byte-identical to an Admin comp** - no
//      `pfPaymentId`, no `eftRef`, no batch id. `vouchers.test.ts` asserts those
//      absences POSITIVELY, so a future refactor that "tidies up" by adding
//      provenance back fails a test rather than quietly ending the anonymity the
//      organisation actually bought.
//
// The grant walk in `lib.ts` is deliberately untouched: a voucher mints an
// ordinary Entitlement and the walk already treats its presence as access.

// ---- Codes -------------------------------------------------------------------

// 32 characters: A-Z and 2-9 minus `O`, `I`, `0` and `1`. A code is read down a
// phone, copied off a printed card, and typed by somebody who has never seen this
// platform - so the pairs that collide by sight are simply not in the alphabet.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// `MYC-7K4Q-2XR9` - one fixed group and two random ones. The prefix is not
// entropy; it makes a code recognisable as one when it turns up out of context in
// a group chat. 32^8 is about 1.1e12 codes, so a collision is vanishingly
// unlikely - and minting retries on one anyway rather than throwing, because a
// clash is the platform's problem and must never cost the Seller their batch.
const CODE_PREFIX = "MYC";

function mintCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]);
  return `${CODE_PREFIX}-${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

// Fold whatever the member typed into the stored form: upper-cased, with the
// separators re-derived rather than trusted, so `myc7k4q2xr9`, `myc 7k4q 2xr9` and
// `MYC-7K4Q-2XR9` are all one code. They are reading it off a card or a phone
// screen with no instructions, and a code that "does not exist" because of a
// stray space is indistinguishable to them from a dud one.
//
// Exported for the `/redeem` page, which echoes the normalised form back as they
// type so that the thing they see is the thing being looked up.
export function normaliseCode(raw: string): string {
  const bare = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return [bare.slice(0, 3), bare.slice(3, 7), bare.slice(7, 11)].filter((g) => g.length > 0).join("-");
}

// ---- Minting (ticket 02) ------------------------------------------------------

// A batch is written in ONE Convex transaction, so the cap is about a mistyped
// seat count producing an unusable mutation rather than about how big a deal may
// be. Raise it when a real deal needs more, not before.
const MAX_SEATS = 1000;

// The Edition a batch may be minted for, or a thrown explanation. The two Seller
// gates are the existing ones verbatim - a `sellers` row IS the Admin's can-sell
// grant, and it must carry saved payout details - because the platform must never
// issue a seat it cannot pay anybody for. On top of them: the caller owns the
// Topic, and the Edition is PUBLISHED. It need not be PRICED: the Seller states
// the total, so a listing price is irrelevant to a batch.
async function sellableEdition(
  ctx: MutationCtx,
  userId: Id<"users">,
  topicSlug: string,
  lang: string,
): Promise<Doc<"topics">> {
  const status = sellerStatusOf(await getSeller(ctx, userId));
  if (status === "not-granted") throw new Error("you are not set up to sell yet");
  if (status !== "ready") throw new Error("add your payout bank details before selling a batch");
  const topic = await topicBySlug(ctx, topicSlug);
  if (!topic) throw new Error("that course does not exist");
  if (topic.ownerId !== userId) throw new Error("you can only sell editions of your own course");
  if (!(await publishedLangs(ctx, topic._id)).has(lang)) {
    throw new Error("publish this edition before selling a batch of it");
  }
  return topic;
}

// Mint a batch: the batch row, its N codes, and its single Ledger row, in one
// mutation. The codes work immediately (ADR 0029) - there is deliberately nothing
// here that waits on the money.
//
// The Ledger row is the money event for the WHOLE batch rather than one per seat,
// so the books read as the single commercial event it was: `kind: "batch"`,
// `status: "unpaid"`, `fee: 0` (no gateway took a cut, so net == gross), the
// standard 50/50 split through `splitNet` so payout arithmetic is identical to
// both payment rails, and `buyerEmail` = the **organisation's** billing contact,
// not a member's. It carries neither `pfPaymentId` nor `eftRef`: its provenance is
// the batch row that points back at it.
export const mintBatch = mutation({
  args: {
    topicSlug: v.string(),
    lang: v.string(),
    seats: v.number(),
    // The negotiated total for the whole batch, in cents.
    total: v.number(),
    orgName: v.string(),
    orgContact: v.string(),
  },
  returns: v.id("voucherBatches"),
  handler: async (ctx, { topicSlug, lang, seats, total, orgName, orgContact }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("sign in to mint a batch");
    const topic = await sellableEdition(ctx, userId, topicSlug, lang);

    if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS) {
      throw new Error(`a batch is between 1 and ${MAX_SEATS} seats`);
    }
    if (!Number.isInteger(total) || total <= 0) throw new Error("a batch needs the total you agreed");
    const org = orgName.trim();
    const contact = orgContact.trim();
    // These two are how the Seller and the sysadmin tell one batch from another
    // months later, and the contact is the Ledger row's `buyerEmail` - a blank one
    // would put an anonymous money event in the payouts view.
    if (!org || !contact) throw new Error("the buying organisation's name and billing contact are both required");

    const { sellerShare, platformShare } = splitNet(total, platformFeeBps());
    const ledgerId = await ctx.db.insert("ledger", {
      topicId: topic._id,
      lang,
      sellerId: userId,
      buyerEmail: contact,
      gross: total,
      fee: 0,
      net: total,
      sellerShare,
      platformShare,
      kind: "batch",
      // The guard, and the reason ticket 01 landed first: `owedPayouts` reads the
      // `by_status` index for `owed`, so this row is invisible to payouts with no
      // filter anybody could later forget to apply.
      status: "unpaid",
    });

    const batchId = await ctx.db.insert("voucherBatches", {
      topicId: topic._id,
      lang,
      sellerId: userId,
      seats,
      total,
      orgName: org,
      orgContact: contact,
      ledgerId,
      voided: false,
    });

    for (let i = 0; i < seats; i++) {
      await ctx.db.insert("vouchers", { batchId, code: await freshCode(ctx) });
    }
    return batchId;
  },
});

// A code no voucher already holds. Convex has no uniqueness constraint, so this is
// enforced on read exactly as the EFT rail enforces its reference: retry rather
// than throw. Bounded, because at 32^8 five clashes in a row is not bad luck, it
// is a broken RNG, and looping on that would hang the mutation instead.
async function freshCode(ctx: MutationCtx): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = mintCode();
    const clash = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (!clash) return code;
  }
  throw new Error("could not mint a unique code");
}
