import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { publishedLangs, topicBySlug } from "./lib";
import { platformFeeBps, splitNet } from "./payfast";
import { getSeller, sellerStatusOf } from "./sellerStatus";
import { isCallerAdmin } from "./whitelist";

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

// ---- Redemption (ticket 03) ---------------------------------------------------

// Turn a code into permanent access, recording nothing about who redeemed it.
// This is the function the whole feature exists for, and it is defined as much by
// what it refuses to write as by what it grants.
//
// **Auth-first, and it takes no email.** The caller comes from `ctx.auth` and a
// Guest is refused. There is deliberately no email argument: accepting one would
// rebuild the impersonation hole ADR 0021 closed by deleting `pendingEntitlements`
// and claim-on-sign-up. The member signs up with an address of their own choosing,
// which is exactly how the organisation's list stays undisclosed.
//
// **It refuses WITHOUT consuming whenever it would grant nothing** - the caller
// already holds an Entitlement for the Edition, holds a grandfathered Enrollment
// on it, or owns the course. Burning the code there would spend a seat the
// organisation paid for in exchange for nothing, and `market.grantEntitlement`
// already treats a duplicate as a no-op, so this is the house style rather than a
// special case.
//
// Returns where the member has just been let in, so `/redeem` can send them
// straight into the Edition instead of leaving them on a success message with
// nowhere to go.
export const redeem = mutation({
  args: { code: v.string() },
  returns: v.object({ topicSlug: v.string(), lang: v.string(), courseTitle: v.string() }),
  handler: async (ctx, { code }) => {
    const userId = await getAuthUserId(ctx);
    // Not a UI concern: an Entitlement has always attributed to an account, and a
    // code redeemed by nobody would grant nothing to nobody.
    if (!userId) throw new Error("sign in or create an account to redeem your code");

    const voucher = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", normaliseCode(code)))
      .first();
    // Distinguishable from "already used" on purpose: a member who mistyped needs
    // to try again, and a member holding a dud needs to go back to whoever gave it
    // to them. One message for both is the one that helps neither.
    if (!voucher) throw new Error("we don't recognise that code - check it for a typo");
    // Permanently unanswerable, by design (ADR 0029): nothing records who used it.
    if (voucher.redeemedAt !== undefined) {
      throw new Error("that code has already been used - ask your organisation for another one");
    }

    const batch = await ctx.db.get(voucher.batchId);
    if (!batch) throw new Error("that code is no longer valid");
    // Voiding stops UNREDEEMED codes only (ticket 07). A seat already granted is
    // untouched by this branch, because nothing here can find one.
    if (batch.voided) throw new Error("that code has been cancelled - ask your organisation about it");

    const topic = await ctx.db.get(batch.topicId);
    if (!topic) throw new Error("that code is no longer valid");

    // Refuse without consuming, three ways. Each leaves `redeemedAt` unset, so the
    // code stays redeemable by somebody who actually needs it.
    const alreadyHas = "you already have access to this course - your code has NOT been used, so you can pass it on";
    if (topic.ownerId === userId) throw new Error(alreadyHas);
    const held = await ctx.db
      .query("entitlements")
      .withIndex("by_topic_user", (q) => q.eq("topicId", batch.topicId).eq("userId", userId))
      .collect();
    if (held.some((e) => e.lang === batch.lang)) throw new Error(alreadyHas);
    const enrolled = await ctx.db
      .query("enrollments")
      .withIndex("by_topic_user", (q) => q.eq("topicId", batch.topicId).eq("userId", userId))
      .collect();
    if (enrolled.some((e) => e.lang === batch.lang)) throw new Error(alreadyHas);

    // The seat. **No provenance of any kind** - no batch id, no voucher id, no
    // `pfPaymentId`, no `eftRef` - so this row is byte-identical to an Admin comp
    // (ADR 0029). Both halves of the anonymity are needed: with provenance here the
    // operator could list the redeemers by elimination, and the promise the
    // organisation bought would be theatre. `vouchers.test.ts` asserts these
    // absences positively; do not delete that assertion as redundant.
    await ctx.db.insert("entitlements", { userId, topicId: batch.topicId, lang: batch.lang });
    // The whole state machine: the code is spent, and the row says nothing else.
    await ctx.db.patch(voucher._id, { redeemedAt: Date.now() });

    return { topicSlug: topic.slug, lang: batch.lang, courseTitle: topic.title };
  },
});

// ---- The sysadmin's cash log (ticket 04) ---------------------------------------

// The batches whose transfer has not been logged yet - the sysadmin's queue,
// shaped after `eft.pendingEftIntents` because the habit for "unmatched money
// waiting on me" is already formed and a queue that looks like a stranger is a
// queue that gets missed. Resolved batches are absent by construction: this is a
// to-do list, not a log.
//
// **It returns no codes, and the returns validator is where that is enforced** -
// not a page that chooses not to render them. The money role and the selling role
// are separated by what the query can say, so a later UI change cannot undo it.
// Everything here is what the sysadmin needs to match a statement line: who sold
// it, what for, how many seats and for how much, and who the organisation is.
export const pendingBatches = query({
  args: {},
  returns: v.array(
    v.object({
      batchId: v.id("voucherBatches"),
      courseTitle: v.string(),
      lang: v.string(),
      sellerEmail: v.string(),
      seats: v.number(),
      total: v.number(),
      orgName: v.string(),
      orgContact: v.string(),
      at: v.number(),
    }),
  ),
  handler: async (ctx) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    // An ABSENT `paymentRef` is the queue - the same shape the Ledger row's
    // `unpaid` status has, read from the side that the sysadmin acts on. Indexed
    // rather than filtered, and capped anyway: a hand-reconciled queue is small by
    // definition, and one that is not is a signal rather than a page to paginate.
    const rows = await ctx.db
      .query("voucherBatches")
      .withIndex("by_payment_ref", (q) => q.eq("paymentRef", undefined))
      .take(500);
    return await Promise.all(
      rows.map(async (b) => {
        const [seller, topic] = await Promise.all([ctx.db.get(b.sellerId), ctx.db.get(b.topicId)]);
        return {
          batchId: b._id,
          courseTitle: topic?.title ?? "(deleted course)",
          lang: b.lang,
          sellerEmail: seller?.email ?? "(unknown)",
          seats: b.seats,
          total: b.total,
          orgName: b.orgName,
          orgContact: b.orgContact,
          at: b._creationTime,
        };
      }),
    );
  },
});

// The organisation's transfer landed: record the reference against the batch and
// flip its Ledger row `unpaid` -> `owed`, which is what makes the Seller's share
// payable in the ordinary payout run. Sys admin only.
//
// **This is bookkeeping, not a gate.** The codes have been working since the batch
// was minted, and nothing in here reads, writes, generates or invalidates one -
// the sysadmin never sees a code at all.
//
// Idempotent on the reference already being recorded, like `confirmEftPayment`:
// a second click must never move a second Ledger row or overwrite the reference
// that reconciles the statement line.
export const logBatchPayment = mutation({
  args: { batchId: v.id("voucherBatches"), reference: v.string() },
  returns: v.null(),
  handler: async (ctx, { batchId, reference }) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const ref = reference.trim();
    // The whole point is being able to point at the bank statement line later.
    if (!ref) throw new Error("the bank reference or transaction id is required");
    const batch = await ctx.db.get(batchId);
    if (!batch) throw new Error("that batch does not exist");
    if (batch.paymentRef !== undefined) return null;

    await ctx.db.patch(batchId, { paymentRef: ref });
    // Only an `unpaid` row moves. A batch whose row was somehow already `owed` or
    // `paid` keeps its state rather than being re-owed, which is the same posture
    // `markPaid` takes from the other end of the same lifecycle.
    const row = await ctx.db.get(batch.ledgerId);
    if (row?.status === "unpaid") await ctx.db.patch(batch.ledgerId, { status: "owed" });
    return null;
  },
});
