import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { mintAccessCodeString } from "./accessCodeFormat";
import { sellableTopic } from "./vouchers";

// The **shared capped Access Code rail** (ADR 0031, the shared-access-codes map's
// spec.md). The second bulk-access rail: one code a Seller mints for one Edition,
// broadcast by an organisation however it likes, joined with a nickname and a PIN,
// and billed at the end for the seats actually taken.
//
// It is **beside** the voucher rail in `vouchers.ts`, not a replacement for it, and
// they are deliberately shaped as siblings. Read that file first: everything here
// mirrors it except where the mirror breaks, and the three places it breaks are the
// whole feature.
//
//   1. **A batch writes its Ledger row at mint; an Access Code writes none.** A
//      batch's total is known when it is created, so the money event is the batch.
//      An Access Code's total is unknown until somebody decides the agreement is
//      over, so `stopCode` is what writes the row. `ledgerId` is absent until then,
//      and stays absent forever on a code stopped with zero seats.
//   2. **A batch prices the whole deal; an Access Code prices a seat.** Here the
//      count is the thing that varies, so the per-seat number is the one that was
//      negotiated.
//   3. **A Seat records who took it.** This is the half of ADR 0029's decision 3
//      that ADR 0031 reverses, and it is not an oversight. Counting returning
//      members IS a per-person identifier: a member coming back on a second phone
//      has to be recognised, or the cap is unusable and the bill is a lie.
//
// What is kept from ADR 0029, exactly: **the Entitlement a Seat mints carries no
// provenance at all** - no `accessCodeId`, no `pfPaymentId`, no `eftRef` - so it is
// byte-identical to an Admin comp. `accessCodes.test.ts` pins its key set
// positively, so a future refactor that "tidies up" by adding the code id back
// fails a test rather than quietly ending the promise made to the organisation's
// members. `lib.ts`'s grant walk is untouched: a Seat mints an ordinary Entitlement
// and the walk already treats its presence as access.

// The hard ceiling on one code's capacity. Not a commercial limit: it is about a
// mistyped cap ("50000" for "500") producing a bill nobody agreed to, and about
// `myAccessCodes` counting by reading (see below), which this number multiplies.
// Raise it when a real deal needs more, not before.
const MAX_CAPACITY = 5000;

// How many of a Seller's codes the list reads at once. Small for the same reason
// the voucher rail's is: that list COUNTS by reading, so this multiplies by the
// capacity ceiling above.
const MAX_CODES_LISTED = 50;

// ---- Refusals -----------------------------------------------------------------

// Every refusal a member can hit is a **tagged `ConvexError`**, never a plain
// `Error`. A production Convex deployment redacts a plain `Error`'s message to
// "Server Error", so carefully distinguished refusals would all arrive at the
// member as one blank (the lesson vouchers ticket 03 records). Only a
// `ConvexError`'s `data` survives the trip. `/join` turns each tag into a
// translated sentence, because the member may not be reading in English.
//
// Each tag sends the member somewhere different, and that is the point of having
// six of them rather than one:
//
//   - `code-unknown`     -> check your typing, or ask who gave it to you
//   - `code-stopped`     -> the agreement ended; ask your organisation
//   - `code-full`        -> the seats are gone; ask your organisation
//   - `nickname-taken`   -> pick another, or say you are coming back
//   - `pin-wrong`        -> what you typed does not match a seat on this code
//   - `consent-required` -> nothing was stored, and here is what else you can do
//   - `too-many-attempts`-> wait; the credential is being protected
//
// **`nickname-taken` and `pin-wrong` must stay distinguishable.** A member cannot
// tell "pick another nickname" from "you typed your PIN wrong" out of one message.
// This leaks the existence of a nickname to anybody holding the code, which is an
// accepted consequence recorded in ADR 0031, not an oversight: it is inherent to a
// name being the lookup key, and it is a second reason the nickname is self-chosen.
//
// `too-many-attempts` is the one tag the spec did not list. It is here because
// ticket 04's rate limit is real and a locked-out member told "your PIN is wrong"
// would keep typing the right PIN and conclude the seat is gone.
export const ACCESS_ERRORS = {
  codeUnknown: "access/code-unknown",
  codeStopped: "access/code-stopped",
  codeFull: "access/code-full",
  nicknameTaken: "access/nickname-taken",
  pinWrong: "access/pin-wrong",
  consentRequired: "access/consent-required",
  tooManyAttempts: "access/too-many-attempts",
} as const;

export function accessRefusal(tag: (typeof ACCESS_ERRORS)[keyof typeof ACCESS_ERRORS]): ConvexError<string> {
  return new ConvexError(tag);
}

// ---- Minting (ticket 02) ------------------------------------------------------

// Mint one Access Code for one Edition: the row, and nothing else.
//
// **No Ledger row here, and that is the structural difference from `mintBatch`.**
// There is no total to write yet. `stopCode` writes it.
//
// The three Seller gates are the voucher rail's own, shared rather than copied
// (`sellableTopic`): a `sellers` row is the Admin's can-sell grant, it must carry
// saved payout details, the caller owns the Topic, and the Edition is published. It
// need not be priced - the Seller states the per-seat price, so a listing price is
// irrelevant to a deal.
export const mintAccessCode = mutation({
  args: {
    topicSlug: v.string(),
    lang: v.string(),
    // The seat cap agreed with the organisation.
    capacity: v.number(),
    // What one seat costs, in cents (ZAR). Per SEAT, not per deal.
    pricePerSeat: v.number(),
    orgName: v.string(),
    orgContact: v.string(),
  },
  returns: v.object({ accessCodeId: v.id("accessCodes"), code: v.string() }),
  handler: async (ctx, { topicSlug, lang, capacity, pricePerSeat, orgName, orgContact }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("sign in to mint an access code");
    const topic = await sellableTopic(ctx, userId, topicSlug, lang);

    if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_CAPACITY) {
      throw new Error(`a seat cap is between 1 and ${MAX_CAPACITY}`);
    }
    // Zero is refused as well as negative: a free shared code is a published free
    // Edition, which the platform already has, and a zero-priced deal would put a
    // R0.00 line on the operator's settlement queue for them to puzzle over.
    if (!Number.isInteger(pricePerSeat) || pricePerSeat <= 0) {
      throw new Error("an access code needs the per-seat price you agreed");
    }
    const org = orgName.trim();
    const contact = orgContact.trim();
    // These two are how the Seller and the sysadmin tell one deal from another
    // months later, and the contact becomes the Ledger row's `buyerEmail` when the
    // code stops. A blank one would put an anonymous money event on the queue.
    if (!org || !contact) {
      throw new Error("the buying organisation's name and billing contact are both required");
    }

    const code = await freshCode(ctx);
    const accessCodeId = await ctx.db.insert("accessCodes", {
      topicId: topic._id,
      lang,
      sellerId: userId,
      code,
      capacity,
      pricePerSeat,
      orgName: org,
      orgContact: contact,
    });
    // The code itself comes back, because the Seller's next act is handing it to
    // the organisation and a mint that returns only an id makes them go and find it.
    return { accessCodeId, code };
  },
});

// A code no Access Code already holds. Convex has no uniqueness constraint, so
// this is enforced on read exactly as the voucher rail and the EFT rail enforce
// theirs: retry rather than throw. Bounded, because at 32^9 five clashes in a row
// is not bad luck, it is a broken RNG, and looping on that would hang the mutation.
async function freshCode(ctx: MutationCtx): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = mintAccessCodeString();
    const clash = await ctx.db
      .query("accessCodes")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (!clash) return code;
  }
  throw new Error("could not mint a unique code");
}

// How many seats an Access Code has consumed. **Derived, always** - there is no
// counter field on the row and there must never be one (see `schema.ts`).
//
// A row whose `userId` has been stripped still counts. That is ticket 11's whole
// design: a member exercising their withdrawal right removes the personal link,
// not the fact that a seat was consumed during the agreement, because the bill was
// agreed on that count and the operator may already have raised it.
export async function seatCount(ctx: QueryCtx, accessCodeId: Id<"accessCodes">): Promise<number> {
  const seats = await ctx.db
    .query("seats")
    .withIndex("by_code", (q) => q.eq("accessCodeId", accessCodeId))
    .take(MAX_CAPACITY + 1);
  return seats.length;
}

// The caller's own Access Codes: what they sold, to whom, how full it is, what it
// has run up so far, and whether the money has been logged.
//
// **Note what this deliberately cannot answer, and do not add it out of
// helpfulness: WHO took a seat.** The rows exist (unlike on the voucher rail), so
// this is a query that could be written and must not be. The organisation's members
// were told nobody can see who they are, and the Seller is the party with the
// commercial interest in knowing. The returns validator below is where that is
// enforced, not a page that chooses not to render a field.
export const myAccessCodes = query({
  args: {},
  returns: v.array(
    v.object({
      accessCodeId: v.id("accessCodes"),
      topicSlug: v.string(),
      courseTitle: v.string(),
      lang: v.string(),
      code: v.string(),
      capacity: v.number(),
      // Seats consumed. A NUMBER, and it stays one.
      taken: v.number(),
      pricePerSeat: v.number(),
      // `taken * pricePerSeat` - what the code has run up so far, so the bill is
      // never a surprise. Computed here rather than in the page so the Seller's
      // running total and the operator's settlement line cannot disagree.
      runningTotal: v.number(),
      orgName: v.string(),
      orgContact: v.string(),
      stoppedAt: v.union(v.number(), v.null()),
      // The bank reference the sysadmin logged, or null while the transfer has not
      // been matched - which is the whole of "is my share payable".
      paymentRef: v.union(v.string(), v.null()),
      at: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    // Bounded on both axes, because this query counts by reading. Same trade the
    // voucher rail makes: a derived count costs a read of every seat of every code
    // listed on each subscription tick, so the list is capped tight and each count
    // is capped at the minting ceiling.
    const codes = await ctx.db
      .query("accessCodes")
      .withIndex("by_seller", (q) => q.eq("sellerId", userId))
      .take(MAX_CODES_LISTED);
    const rows = await Promise.all(
      codes.map(async (c) => {
        const [topic, taken] = await Promise.all([ctx.db.get(c.topicId), seatCount(ctx, c._id)]);
        return {
          accessCodeId: c._id,
          topicSlug: topic?.slug ?? "",
          courseTitle: topic?.title ?? "(deleted course)",
          lang: c.lang,
          code: c.code,
          capacity: c.capacity,
          taken,
          pricePerSeat: c.pricePerSeat,
          runningTotal: taken * c.pricePerSeat,
          orgName: c.orgName,
          orgContact: c.orgContact,
          stoppedAt: c.stoppedAt ?? null,
          paymentRef: c.paymentRef ?? null,
          at: c._creationTime,
        };
      }),
    );
    // Newest first: the code a Seller is dealing with is the one they just minted.
    return rows.sort((a, b) => b.at - a.at);
  },
});

// The caller's own Access Code, or a throw. Every Seller-facing write goes through
// this rather than trusting which codes a page happened to list: a cap raise and a
// stop are both things one Seller could do to another's deal.
export async function ownCode(ctx: QueryCtx, accessCodeId: Id<"accessCodes">): Promise<Doc<"accessCodes">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("sign in to manage your access codes");
  const code = await ctx.db.get(accessCodeId);
  if (!code || code.sellerId !== userId) throw new Error("that access code isn't yours");
  return code;
}
