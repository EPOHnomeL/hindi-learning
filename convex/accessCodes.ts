import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { ACCESS_CODE_PROVIDER_ID, mintAccessCodeString, seatAccountId } from "./accessCodeFormat";
import { CONSENT_VERSION } from "./joinConsent";
import { platformFeeBps, splitNet } from "./payfast";
import { sellableTopic } from "./vouchers";
import { isCallerAdmin } from "./whitelist";

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

// The bounds a cap has to satisfy, checked in one place because `mintAccessCode` and
// `raiseCapacity` both set the same field and a bound enforced in only one of them is
// a bound a Seller can walk around.
function assertCapacity(capacity: number): void {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_CAPACITY) {
    throw new Error(`a seat cap is between 1 and ${MAX_CAPACITY}`);
  }
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

    assertCapacity(capacity);
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
    .withIndex("by_access_code", (q) => q.eq("accessCodeId", accessCodeId))
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

// ---- Joining (ticket 03) -------------------------------------------------------

// What the credentials provider needs to know BEFORE it can call
// `createAccount`: the code's id (half of the account identity), whether this
// nickname already holds a Seat, and whether a new Seat is possible at all.
//
// It is a read, and it is deliberately **not** the cap check that matters. The one
// that matters is inside `claimSeat`, in the same transaction as the insert. This
// query exists so that a member who cannot possibly get in is told *why* before an
// account is created for them, not so that anything is decided here.
export const forJoin = internalQuery({
  args: { code: v.string(), nicknameKey: v.string() },
  returns: v.union(
    v.object({
      accessCodeId: v.id("accessCodes"),
      stopped: v.boolean(),
      full: v.boolean(),
      seatExists: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, { code, nicknameKey }) => {
    // `.unique()`, not `.first()`: minting retries until a code is unused, so two
    // rows sharing one code is an invariant violation worth throwing on rather than
    // silently joining whichever happened to be first.
    const row = await ctx.db
      .query("accessCodes")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!row) return null;
    const seat = await ctx.db
      .query("seats")
      .withIndex("by_access_code_and_nickname", (q) => q.eq("accessCodeId", row._id).eq("nicknameKey", nicknameKey))
      .unique();
    return {
      accessCodeId: row._id,
      stopped: row.stoppedAt !== undefined,
      full: (await seatCount(ctx, row._id)) >= row.capacity,
      seatExists: seat !== null,
    };
  },
});

// **Consume a seat and grant access, atomically.** The one place a new seam was
// unavoidable, and the highest point it can sit at: the credentials provider runs
// inside Convex Auth's `signIn` ACTION and cannot open a transaction itself, so
// every check that must not race with another member's join lives here, in one
// mutation, beside the two inserts.
//
// **The cap is read and consumed in the same transaction.** A cap read in one
// function and consumed in another sells the last seat twice, and the two members
// who both got in are both real and both billed. Re-checking here is not belt and
// braces over `forJoin`; `forJoin` is the courtesy and this is the rule.
//
// **The Entitlement carries no provenance** (ADR 0031, keeping ADR 0029's decision
// 3 by half): no `accessCodeId`, no `pfPaymentId`, no `eftRef`, so a Seat's
// Entitlement is byte-identical to an Admin comp. `accessCodes.test.ts` pins its
// key set positively. Do not delete that assertion as redundant: it is what makes
// a future "tidy up" that adds the code id back fail a test instead of quietly
// ending the promise the organisation's members were given.
export const claimSeat = internalMutation({
  args: {
    accessCodeId: v.id("accessCodes"),
    userId: v.id("users"),
    nicknameKey: v.string(),
    consentVersion: v.string(),
  },
  returns: v.object({ topicSlug: v.string(), lang: v.string(), courseTitle: v.string() }),
  handler: async (ctx, { accessCodeId, userId, nicknameKey, consentVersion }) => {
    const code = await ctx.db.get(accessCodeId);
    if (!code) throw accessRefusal(ACCESS_ERRORS.codeUnknown);
    // **Refused here, not merely hidden in the UI.** s11(2) puts the burden of
    // proving consent on us, so a join that cannot name the wording it agreed to is
    // a join we cannot defend. An old version is refused too: a stale cached page
    // must not record a member as having agreed to wording it never showed them.
    if (consentVersion !== CONSENT_VERSION) throw accessRefusal(ACCESS_ERRORS.consentRequired);
    // Stopping ends NEW joins only. Existing Seats never come through here.
    if (code.stoppedAt !== undefined) throw accessRefusal(ACCESS_ERRORS.codeStopped);

    const clash = await ctx.db
      .query("seats")
      .withIndex("by_access_code_and_nickname", (q) => q.eq("accessCodeId", accessCodeId).eq("nicknameKey", nicknameKey))
      .unique();
    // Reachable only by two members choosing one nickname at the same moment, since
    // `forJoin` catches the ordinary case. Kept because that moment is exactly what
    // this mutation exists to serialise.
    if (clash) throw accessRefusal(ACCESS_ERRORS.nicknameTaken);
    if ((await seatCount(ctx, accessCodeId)) >= code.capacity) throw accessRefusal(ACCESS_ERRORS.codeFull);

    const topic = await ctx.db.get(code.topicId);
    if (!topic) throw accessRefusal(ACCESS_ERRORS.codeUnknown);

    await ctx.db.insert("seats", {
      accessCodeId,
      userId,
      nicknameKey,
      consentedAt: Date.now(),
      consentVersion,
    });
    await ctx.db.insert("entitlements", { userId, topicId: code.topicId, lang: code.lang });
    // Where the member has just been let in, so `/join` can send them straight into
    // the Edition instead of leaving them on a success message with nowhere to go.
    return { topicSlug: topic.slug, lang: code.lang, courseTitle: topic.title };
  },
});

// ---- Raising the cap, and stopping (ticket 06) ----------------------------------

// The organisation filled the code and wants to carry on, so the Seller raises the
// cap rather than minting a second code and splitting the bill in two.
//
// **Lowering below the seats already taken is refused.** Those seats exist, their
// Entitlements are permanent, and nothing here can find them to un-grant (the
// Entitlement carries no provenance, by design). A cap under the count would make
// `taken of capacity` read as a lie and would make the settlement arithmetic
// disagree with the seats it is meant to describe. Lowering to at or above the
// count is allowed: it stops new joins, which is a thing a Seller may legitimately
// want to do mid-agreement without ending it.
//
// Refused on a stopped code, because a stopped code grants nothing and a cap on it
// is a number with no meaning.
export const raiseCapacity = mutation({
  args: { accessCodeId: v.id("accessCodes"), capacity: v.number() },
  returns: v.null(),
  handler: async (ctx, { accessCodeId, capacity }) => {
    const code = await ownCode(ctx, accessCodeId);
    if (code.stoppedAt !== undefined) throw new Error("that access code has been stopped");
    assertCapacity(capacity);
    const taken = await seatCount(ctx, accessCodeId);
    if (capacity < taken) throw new Error(`${taken} seats have already been taken, so the cap cannot go below that`);
    await ctx.db.patch(accessCodeId, { capacity });
    return null;
  },
});

// **The money event.** The agreement is over, so the code stops granting new seats
// and the organisation is billed for the ones it took.
//
// This is the one place this rail differs structurally from the voucher rail rather
// than cosmetically. `mintBatch` writes its Ledger row at creation because a
// batch's total is known then. An Access Code's total is unknown until somebody
// decides the agreement is over, so **stopping is what creates the row**, and it is
// written in the same mutation that sets `stoppedAt` so a stopped code can never
// exist without its bill.
//
// The Ledger row is shaped exactly like a batch's, deliberately: `kind: "batch"`,
// `fee: 0` (no gateway took a cut, so net == gross), the standard split through
// `splitNet` so payout arithmetic is identical on every rail, and `buyerEmail` =
// the **organisation's** billing contact, never a member's. It carries neither
// `pfPaymentId` nor `eftRef`: its provenance is the code row that points back at it.
//
// `status: "unpaid"` is the whole payout guard, and it needs no new logic anywhere.
// `ledger.owedPayouts` reads the `by_status` index for `"owed"`, so an unpaid row is
// invisible to payouts with no filter a later edit could forget to apply, and
// `sales.ts`'s `salesOnly` is an allow-list that already excludes `"batch"` rows
// from the per-course report. Neither file was edited for this rail. **A ticket
// that finds itself editing `ledger.ts` or `sales.ts` has drifted.**
//
// **Zero seats writes no row at all.** A deal that went nowhere has nothing to
// settle and must not put a R0.00 line on the operator's queue for them to work out
// how to clear.
//
// **Stopping is one way.** There is no restart, because a restart would reopen a
// Ledger row the operator may already have invoiced against, and a second stop
// would then write a second row for seats that were already billed.
//
// **Stopping is neither a refund nor a revocation.** Seats already taken keep
// working forever: their Entitlements are ordinary and carry no provenance, so
// nothing here can find them, and that is by design rather than a limitation to
// engineer around. An agent who sets out to make stopping retroactive will end up
// adding the provenance back and destroying the feature. The Seller's confirm says
// this in plain words (ticket 08).
export const stopCode = mutation({
  args: { accessCodeId: v.id("accessCodes") },
  returns: v.null(),
  handler: async (ctx, { accessCodeId }) => {
    const code = await ownCode(ctx, accessCodeId);
    // Refused rather than ignored. A silent second stop would look to the Seller
    // like it worked, and the difference between "already billed" and "just billed"
    // is a conversation with the organisation.
    if (code.stoppedAt !== undefined) throw new Error("that access code has already been stopped");

    const taken = await seatCount(ctx, accessCodeId);
    if (taken === 0) {
      await ctx.db.patch(accessCodeId, { stoppedAt: Date.now() });
      return null;
    }

    const total = taken * code.pricePerSeat;
    const { sellerShare, platformShare } = splitNet(total, platformFeeBps());
    const ledgerId = await ctx.db.insert("ledger", {
      topicId: code.topicId,
      lang: code.lang,
      sellerId: code.sellerId,
      buyerEmail: code.orgContact,
      gross: total,
      fee: 0,
      net: total,
      sellerShare,
      platformShare,
      kind: "batch",
      status: "unpaid",
    });
    // One patch, one row, one transaction: `stoppedAt` and `ledgerId` land together
    // or not at all.
    await ctx.db.patch(accessCodeId, { stoppedAt: Date.now(), ledgerId });
    return null;
  },
});

// ---- The operator's settlement queue (ticket 07) ---------------------------------

// The stopped codes whose transfer has not been logged yet: the operator's queue,
// shaped after `vouchers.pendingBatches` because to the operator this is the same
// job they already do, and a queue that looks like a stranger is a queue that gets
// missed.
//
// **Everything needed to raise the invoice is on the line, and nothing else.** The
// platform generates no invoice document (ADR 0031): SARS wants seven fields plus a
// serial and a date within 21 days of supply, and a serial series is a thing to own
// forever and never duplicate. So the line carries the organisation, the billing
// contact, the seat count, the per-seat price and the total, and the operator raises
// the invoice in whatever they already use.
//
// **It returns no code string, no nickname and no userId, and the returns validator
// is where that is enforced** - not a page that chooses not to render them. The
// money role and the selling role are separated by what the query can say, so a
// later UI change cannot undo it. The code string is withheld for the same reason
// `pendingBatches` withholds its codes: the operator has no use for it and holding
// it would let the money role hand out seats.
export const pendingAccessCodes = query({
  args: {},
  returns: v.array(
    v.object({
      accessCodeId: v.id("accessCodes"),
      courseTitle: v.string(),
      lang: v.string(),
      sellerEmail: v.string(),
      orgName: v.string(),
      orgContact: v.string(),
      seats: v.number(),
      pricePerSeat: v.number(),
      total: v.number(),
      stoppedAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    // An ABSENT `paymentRef` is the queue, indexed rather than filtered, exactly as
    // on the voucher rail. Then filtered to STOPPED codes in memory: a live code has
    // no bill yet, so it is not work waiting on the operator. Capped anyway, because
    // a hand-reconciled queue is small by definition and one that is not is a signal
    // rather than a page to paginate.
    const rows = await ctx.db
      .query("accessCodes")
      .withIndex("by_payment_ref", (q) => q.eq("paymentRef", undefined))
      .take(500);
    const stopped = rows.filter((r) => r.stoppedAt !== undefined);
    const lines = await Promise.all(
      stopped.map(async (c) => {
        const [seller, topic, seats] = await Promise.all([
          ctx.db.get(c.sellerId),
          ctx.db.get(c.topicId),
          seatCount(ctx, c._id),
        ]);
        return {
          accessCodeId: c._id,
          courseTitle: topic?.title ?? "(deleted course)",
          lang: c.lang,
          sellerEmail: seller?.email ?? "(unknown)",
          orgName: c.orgName,
          orgContact: c.orgContact,
          seats,
          pricePerSeat: c.pricePerSeat,
          total: seats * c.pricePerSeat,
          stoppedAt: c.stoppedAt ?? 0,
        };
      }),
    );
    // A code stopped with zero seats settles to nothing and has no Ledger row, so it
    // is not paperwork and does not belong on a to-do list. Dropped here rather than
    // shown as R0.00 for the operator to work out how to clear.
    return lines.filter((l) => l.seats > 0).sort((a, b) => a.stoppedAt - b.stoppedAt);
  },
});

// The organisation's transfer landed: record the reference against the code and flip
// its Ledger row `unpaid` -> `owed`, which is what makes the Seller's share payable
// in the ordinary payout run. Sysadmin only.
//
// **This is bookkeeping, not a gate**, and rather more so than on the voucher rail:
// by the time a code is stopped the seats have been granted, used and finished with.
// Nothing in here reads or invalidates a seat, and the operator never sees the code.
//
// Idempotent on the reference already being recorded, like `logBatchPayment` and
// `confirmEftPayment`: a second click must never move a second Ledger row or
// overwrite the reference that reconciles the statement line.
export const logAccessCodePayment = mutation({
  args: { accessCodeId: v.id("accessCodes"), reference: v.string() },
  returns: v.null(),
  handler: async (ctx, { accessCodeId, reference }) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const ref = reference.trim();
    // The whole point is being able to point at the bank statement line later.
    if (!ref) throw new Error("the bank reference or transaction id is required");
    const code = await ctx.db.get(accessCodeId);
    if (!code) throw new Error("that access code does not exist");
    if (code.stoppedAt === undefined) throw new Error("that access code has not been stopped, so nothing is due yet");
    if (code.paymentRef !== undefined) return null;

    await ctx.db.patch(accessCodeId, { paymentRef: ref });
    // Only an `unpaid` row moves. A row somehow already `owed` or `paid` keeps its
    // state rather than being re-owed, the same posture `markPaid` takes from the
    // other end of the lifecycle. A zero-seat code has no row at all, which is why
    // this is a conditional read rather than an assertion.
    if (code.ledgerId) {
      const row = await ctx.db.get(code.ledgerId);
      if (row?.status === "unpaid") await ctx.db.patch(code.ledgerId, { status: "owed" });
    }
    return null;
  },
});

// ---- The member's own Seat (tickets 10 and 11) -----------------------------------

// The caller's Seat, or null. **The one query that returns a nickname**, and it
// returns it only to the person who chose it: this is what `/join` and the settings
// panel read to know a Seat exists at all, and it is scoped to `getAuthUserId` so
// there is no argument by which one member could ask about another.
//
// Null for a Guest and null for an ordinary email-and-password account, which is
// how the PIN-change and delete-my-seat controls stay invisible to everybody who has
// no Seat rather than being hidden by a page's own judgement.
export const mySeat = query({
  args: {},
  returns: v.union(
    v.object({
      accessCodeId: v.id("accessCodes"),
      nickname: v.string(),
      orgName: v.string(),
      topicSlug: v.string(),
      courseTitle: v.string(),
      lang: v.string(),
      consentVersion: v.string(),
      consentedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const seat = await ownSeat(ctx, userId);
    if (!seat) return null;
    const code = await ctx.db.get(seat.accessCodeId);
    if (!code) return null;
    const topic = await ctx.db.get(code.topicId);
    return {
      accessCodeId: seat.accessCodeId,
      nickname: seat.nicknameKey ?? "",
      orgName: code.orgName,
      topicSlug: topic?.slug ?? "",
      courseTitle: topic?.title ?? "(deleted course)",
      lang: code.lang,
      // Which wording they agreed to and when, shown back to them. The record exists
      // to discharge s11(2)'s burden of proof, and a record the person it is about
      // cannot see is a worse record.
      consentVersion: seat.consentVersion,
      consentedAt: seat.consentedAt,
    };
  },
});

// The caller's own live Seat row. A member holds at most one in practice (a join
// creates a fresh account, so one account is one Seat), and `by_user` finding more
// than one would mean an account was linked to two Seats, which nothing can do.
// A STRIPPED row (ticket 11) is not a Seat any more and is excluded here by its
// absent `nicknameKey`.
async function ownSeat(ctx: QueryCtx, userId: Id<"users">): Promise<Doc<"seats"> | null> {
  const seat = await ctx.db
    .query("seats")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  return seat && seat.nicknameKey !== undefined ? seat : null;
}

// The Seat's account identity, for the PIN change (ticket 10). Internal, and it
// takes no arguments on purpose: the caller is `ctx.auth`, so there is no id a
// caller could pass to change somebody else's PIN.
export const mySeatAccount = internalQuery({
  args: {},
  returns: v.union(v.object({ accessCodeId: v.id("accessCodes"), nicknameKey: v.string() }), v.null()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const seat = await ownSeat(ctx, userId);
    if (!seat?.nicknameKey) return null;
    return { accessCodeId: seat.accessCodeId, nicknameKey: seat.nicknameKey };
  },
});

// ---- Deleting a Seat (ticket 11) --------------------------------------------------

// POPIA s11 gives a member the right to withdraw consent, and s27(1)(a) consent is
// the entire legal basis for this rail, so a withdrawal that cannot be exercised is
// not a right. The `seats` row is the one place the link between a person and the
// organisation's cohort exists, so removing it is the meaningful act.
//
// **Three things happen, and the third is the one nobody expects.**
//
//   1. The row is STRIPPED, not deleted: `userId` and `nicknameKey` go, and
//      `consentedAt` / `consentVersion` stay. What is left says "one seat was
//      consumed on this code" and nothing about who consumed it. The seat COUNT must
//      not move, because the bill is for seats consumed during the agreement and
//      this member did consume one. A decrement would let a member reduce an invoice
//      the organisation already agreed to, and worse, change a number under an
//      operator who had already raised it. The cap ledger and the personal link are
//      two different facts, and only one of them is being deleted.
//   2. The `authAccounts` row goes, which is what makes the credential stop working
//      immediately. It has to go: `providerAccountId` is
//      `${accessCodeId}:${nicknameKey}`, so leaving it would leave the nickname and
//      the link to the organisation in plain text, which is exactly what was asked
//      to be forgotten.
//   3. **The Entitlement is left alone, and the honest consequence of (2) is that it
//      becomes unreachable.** The member stays signed in on the device they are
//      holding, for as long as their session lasts, and the course keeps working
//      there. But there is no longer a nickname and PIN that reaches this account, so
//      they cannot sign in again on another phone. That is not a bug to engineer
//      around: the credential IS the personal link, so keeping one means keeping the
//      other. `/join`'s confirm says this in those words, because a member who was
//      not told will reasonably believe they can come back.
//
// **The nickname is freed for reuse**, and that is the choice rather than an
// oversight. Retiring it permanently would mean keeping the handle in a tombstone,
// and a kept handle is arguably still a record of the person who asked to be
// forgotten, which defeats the whole act. The cost is that a stranger can later
// claim a departed member's handle on the same code. That cost is affordable
// precisely because the handle was never a real name.
export const deleteMySeat = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("sign in to delete your seat");
    const seat = await ownSeat(ctx, userId);
    // Idempotent: a second click on a Seat that is already gone is not an error the
    // member can do anything with.
    if (!seat?.nicknameKey) return null;

    // Through the shared builder, not a template literal spelled out again: this id
    // has to match byte for byte what `accessCodeAuth.ts` created, or the credential
    // survives a withdrawal.
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", ACCESS_CODE_PROVIDER_ID).eq("providerAccountId", seatAccountId(seat.accessCodeId, seat.nicknameKey!)),
      )
      .unique();
    if (account) await ctx.db.delete(account._id);

    // The strip. `undefined` on an optional field removes it, so the row genuinely
    // carries no nickname and no user id afterwards rather than carrying blanks.
    await ctx.db.patch(seat._id, { userId: undefined, nicknameKey: undefined });
    return null;
  },
});
