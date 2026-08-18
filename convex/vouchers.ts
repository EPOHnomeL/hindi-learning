import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { hasEntitlement, publishedLangs, topicBySlug } from "./lib";
import { platformFeeBps, splitNet } from "./payfast";
import { getSeller, sellerStatusOf } from "./sellerStatus";
import { mintCode, normaliseCode } from "./voucherCode";
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

// ---- Minting (ticket 02) ------------------------------------------------------

// A batch is written in ONE Convex transaction, so the cap is about a mistyped
// seat count producing an unusable mutation rather than about how big a deal may
// be. Raise it when a real deal needs more, not before.
const MAX_SEATS = 1000;

// How many of a Seller's batches the batch list reads at once. Small because that
// list COUNTS by reading (see `myBatches`), so this number multiplies by the seat
// cap above. A Seller with more than this many batches has outgrown a flat list
// and wants paging, which is a different ticket than raising a constant.
const MAX_BATCHES_LISTED = 50;

// The Topic a batch may be minted against for this Edition, or a thrown
// explanation. (It returns the TOPIC - the Edition is that topic plus `lang`.) The two Seller
// gates are the existing ones verbatim - a `sellers` row IS the Admin's can-sell
// grant, and it must carry saved payout details - because the platform must never
// issue a seat it cannot pay anybody for. On top of them: the caller owns the
// Topic, and the Edition is PUBLISHED. It need not be PRICED: the Seller states
// the total, so a listing price is irrelevant to a batch.
async function sellableTopic(
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
    const topic = await sellableTopic(ctx, userId, topicSlug, lang);

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
//
// **Every refusal is a `ConvexError` carrying a stable `voucher/...` tag**, and
// `/redeem` turns the tag into a translated sentence. Two reasons it is a tag
// rather than the sentence itself: a PRODUCTION deployment redacts a plain
// `Error`'s message to "Server Error" (only a ConvexError's `data` survives the
// trip, see `tenants.ts`), and the member reading it may not be reading the app
// in English. The distinctions matter more here than anywhere else in the rail -
// "already used", "no such code" and "you already have this" send the member to
// three different places, and one blurred message sends them to none.
export const redeem = mutation({
  args: { code: v.string() },
  returns: v.object({ topicSlug: v.string(), lang: v.string(), courseTitle: v.string() }),
  handler: async (ctx, { code }) => {
    const userId = await getAuthUserId(ctx);
    // Not a UI concern: an Entitlement has always attributed to an account, and a
    // code redeemed by nobody would grant nothing to nobody.
    if (!userId) throw new ConvexError("voucher/sign-in-required");

    // `.unique()`, not `.first()`: minting retries until a code is unused, so two
    // rows sharing one code is an invariant violation. Throwing loudly beats
    // silently redeeming whichever row happened to be first.
    const voucher = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", normaliseCode(code)))
      .unique();
    // Distinguishable from "already used" on purpose: a member who mistyped needs
    // to try again, and a member holding a dud needs to go back to whoever gave it
    // to them. One message for both is the one that helps neither.
    if (!voucher) throw new ConvexError("voucher/code-unknown");
    // Permanently unanswerable, by design (ADR 0029): nothing records who used it.
    if (voucher.redeemedAt !== undefined) throw new ConvexError("voucher/code-used");

    const batch = await ctx.db.get(voucher.batchId);
    if (!batch) throw new ConvexError("voucher/code-unknown");
    // Voiding stops UNREDEEMED codes only (ticket 07). A seat already granted is
    // untouched by this branch, because nothing here can find one.
    if (batch.voided) throw new ConvexError("voucher/batch-voided");

    const topic = await ctx.db.get(batch.topicId);
    if (!topic) throw new ConvexError("voucher/code-unknown");

    // Refuse without consuming, three ways. Each leaves `redeemedAt` unset, so the
    // code stays redeemable by somebody who actually needs it.
    //
    // **The three are the PERMANENT holdings, and that is the whole rule** (settled
    // 2026-08-18, see the vouchers map). A Share and a free published Edition are
    // both access the caller has TODAY and can lose tomorrow - the owner revokes
    // the Share, or unpublishes or prices the Edition - so redeeming a code as a
    // Share holder converts revocable access into an Entitlement that nobody can
    // take away. That is not nothing, so the seat is not wasted and the code is
    // spent. Ownership, an Entitlement and a grandfathered Enrollment are the
    // three that already survive anything the owner does, and redeeming on top of
    // one of those really would buy the member nothing.
    const alreadyHas = new ConvexError("voucher/already-have-access");
    if (topic.ownerId === userId) throw alreadyHas;
    if (await hasEntitlement(ctx, batch.topicId, userId, batch.lang)) throw alreadyHas;
    const enrolled = await ctx.db
      .query("enrollments")
      .withIndex("by_topic_user", (q) => q.eq("topicId", batch.topicId).eq("userId", userId))
      .collect();
    if (enrolled.some((e) => e.lang === batch.lang)) throw alreadyHas;

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
      // A VOIDED batch stays on this queue, marked. Voiding stops codes, never
      // money (ticket 07), so a batch whose deal collapsed may still have cash
      // in flight - dropping it here would hide a transfer that lands afterwards.
      // Flagged rather than silently listed, so the sysadmin chasing a missing
      // payment knows which conversation they are actually in.
      voided: v.boolean(),
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
          voided: b.voided,
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

// ---- The Seller's own view (ticket 05) -----------------------------------------

// The caller's own batches: what they sold, to whom, how many seats have been
// taken up, and whether the money has been logged yet.
//
// **The count is derived**, by counting voucher rows that carry a `redeemedAt`.
// There is no counter field anywhere, so there is nothing to drift out of step
// with the codes themselves.
//
// The payment state is here and stated plainly rather than implied, because a
// Seller looking at a batch whose cash has not been logged should understand that
// their share is not payable yet and why - otherwise the first thing they do is
// file a support question about a missing payout.
//
// Note what this deliberately CANNOT answer: **who** redeemed. It is not recorded
// (ADR 0029), so there is nothing to return - and a well-meaning join onto
// `entitlements` by Edition would approximate it, which is exactly the query that
// must never be written.
export const myBatches = query({
  args: {},
  returns: v.array(
    v.object({
      batchId: v.id("voucherBatches"),
      topicSlug: v.string(),
      courseTitle: v.string(),
      lang: v.string(),
      seats: v.number(),
      redeemed: v.number(),
      total: v.number(),
      orgName: v.string(),
      orgContact: v.string(),
      voided: v.boolean(),
      // The bank reference the sysadmin logged, or null while the transfer has not
      // been matched yet - which is the whole of "is my share payable".
      paymentRef: v.union(v.string(), v.null()),
      at: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    // Bounded on BOTH axes, because this query counts by reading. The count is
    // derived on purpose - a counter field is a second truth that drifts away
    // from the codes (see `schema.ts`) - and the cost of that choice is that a
    // subscription tick reads every voucher of every batch listed. So the batch
    // list is capped tight, and each batch's codes are capped at the seat ceiling
    // minting enforces, which puts a hard ceiling on the read rather than leaving
    // it to grow with the Seller's history.
    const batches = await ctx.db
      .query("voucherBatches")
      .withIndex("by_seller", (q) => q.eq("sellerId", userId))
      .take(MAX_BATCHES_LISTED);
    const rows = await Promise.all(
      batches.map(async (b) => {
        const [topic, codes] = await Promise.all([
          ctx.db.get(b.topicId),
          ctx.db
            .query("vouchers")
            .withIndex("by_batch", (q) => q.eq("batchId", b._id))
            .take(MAX_SEATS),
        ]);
        return {
          batchId: b._id,
          topicSlug: topic?.slug ?? "",
          courseTitle: topic?.title ?? "(deleted course)",
          lang: b.lang,
          seats: b.seats,
          redeemed: codes.filter((c) => c.redeemedAt !== undefined).length,
          total: b.total,
          orgName: b.orgName,
          orgContact: b.orgContact,
          voided: b.voided,
          paymentRef: b.paymentRef ?? null,
          at: b._creationTime,
        };
      }),
    );
    // Newest first: the batch a Seller is dealing with is the one they just minted.
    return rows.sort((a, b) => b.at - a.at);
  },
});

// The codes of ONE batch the caller minted - the CSV's source, and the only place
// codes ever leave the platform. The Seller hands them to the organisation, which
// distributes them however it already talks to its people; the platform sends
// nothing to anyone, because it has no member addresses and that is the point.
//
// **Codes only, with no per-code spent flag** - deliberately, and this is the
// subtle one. The platform never learns who redeemed, but the ORGANISATION knows
// which code it handed to which of its people; a list of codes marked spent or
// unspent, handed back to them, reconstructs exactly the who that the derived
// count exists to avoid disclosing. Take-up is a NUMBER (`myBatches.redeemed`),
// and it stays one.
export const batchCodes = query({
  args: { batchId: v.id("voucherBatches") },
  returns: v.array(v.string()),
  handler: async (ctx, { batchId }) => {
    const batch = await ownBatch(ctx, batchId);
    const codes = await ctx.db
      .query("vouchers")
      .withIndex("by_batch", (q) => q.eq("batchId", batch._id))
      .collect();
    return codes.map((c) => c.code);
  },
});

// The caller's own batch, or a throw. Codes are the one thing in this rail that a
// Seller could use against another Seller, so ownership is checked server-side on
// every read of them rather than by which batches a page happens to list.
async function ownBatch(ctx: QueryCtx, batchId: Id<"voucherBatches">): Promise<Doc<"voucherBatches">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("sign in to see your batches");
  const batch = await ctx.db.get(batchId);
  if (!batch || batch.sellerId !== userId) throw new Error("that batch isn't yours");
  return batch;
}

// ---- Voiding (ticket 07) --------------------------------------------------------

// A deal went wrong - the organisation never paid, or the relationship ended - so
// the Seller stops the batch. Voiding stops UNREDEEMED codes and nothing else.
//
// **Already-granted seats keep working, and this is not a limitation to engineer
// around.** A redemption records nothing about who redeemed and the Entitlement
// carries no batch provenance (ADR 0029), so those seats genuinely cannot be
// found. An agent who sets out to make voiding retroactive will end up adding the
// provenance back and quietly destroying the feature.
//
// **The Ledger row is untouched.** If the cash was logged the Seller is still
// owed their share; if it was not, the row stays `unpaid`. Voiding is a statement
// about codes, not about money - collapsing the two would make it a refund
// mechanism, which this platform does not have.
//
// Void is also why vouchers need no expiry: the stop is a deliberate human act
// with a person behind it, not a clock that silently voids seats the organisation
// paid for.
export const voidBatch = mutation({
  args: { batchId: v.id("voucherBatches") },
  returns: v.null(),
  handler: async (ctx, { batchId }) => {
    const batch = await ownBatch(ctx, batchId);
    if (!batch.voided) await ctx.db.patch(batch._id, { voided: true });
    return null;
  },
});
