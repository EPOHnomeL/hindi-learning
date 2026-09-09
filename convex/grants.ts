// The **grant tables**: `shares`, `entitlements`, `enrollments`, `seats`. One
// module for "what does this caller hold on this Topic", and the only place those
// four tables are read for a caller or an Entitlement is written.
//
// Split out of `edition.ts` on 2026-09-08 (ticket 28, candidate 4 of the
// 2026-09-04 architecture review). The same question was being answered in four
// shapes across four files and the shapes had already drifted:
//
//   - `edition.ts` `grantsFor`: shares + entitlements + enrollments + free
//     published. The declared one place.
//   - `edition.ts` `hasEntitlement`: entitlements only. A second, narrower reader.
//   - `catalogue.ts` `heldPersonally`: three index reads, language ignored. A third.
//   - `vouchers.ts` `redeem`: owner check + `hasEntitlement` + its own enrollments
//     read. A fourth.
//   - `accessCodes.ts` `claimSeat`: no check at all, which was the live defect.
//
// The questions genuinely differ, so this module keeps them as separate named
// predicates rather than one flag with options, and each stays as cheap as the
// hand-written copy it replaced: the three table reads are named once at the top
// and every predicate is composed from them, short-circuiting where its caller
// used to. What is gone is four files each writing their own index read.
//
// **`enrollments` is read-only in production.** Four modules read it and nothing
// writes it: the only `insert("enrollments")` calls in the repo are in tests
// (verified 2026-09-08). It is a grandfathered-rows-only table. ADR 0023 stands
// as the record of what self-enroll was decided to be; this is what the code does
// now.
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { shareLang } from "./shareGrants";
import { freePublishedLangs } from "./publishedEditions";

// A **Grant** is one row in one of the three grant tables, resolved to what it
// lets the holder do. `preview`/`none` are absences, not grants, so they live on
// `EditionAccess` in `edition.ts` rather than here. `owner` is NOT a Grant: an
// owner holds the source plus every ready translation from `translationJobs`, not
// a table row, so it is resolved by the callers, never here.
export type Grant = "viewer" | "entitled" | "enrolled";

// THE grant walk (edition-deepening/02): the one place shares/entitlements/
// enrollments are read for a caller, each held lang mapped to its provenance.
// Precedence is viewer, then entitled, then enrolled, encoded in walk order
// (Shares set unconditionally; the paid/self-serve twins fill only langs still
// unclaimed) so a lang held by more than one grant keeps the same badge
// `editionAccessLevel` showed before the collapse. Adding a grant type is one
// more block here plus one member on `Grant`, and nothing else moves.
export async function grantsFor(
  ctx: QueryCtx,
  topicId: Id<"topics">,
  userId: Id<"users">,
): Promise<Map<string, Grant>> {
  const grants = new Map<string, Grant>();
  for (const s of await shareRows(ctx, topicId, userId)) grants.set(shareLang(s), "viewer");
  for (const e of await entitlementRows(ctx, topicId, userId)) if (!grants.has(e.lang)) grants.set(e.lang, "entitled");
  for (const e of await enrollmentRows(ctx, topicId, userId)) if (!grants.has(e.lang)) grants.set(e.lang, "enrolled");
  // Published and free (course-publishing): the only grant that is not a row
  // about THIS caller. An Edition the owner listed in the catalogue and left free
  // reads as a Viewer for every signed-in account, with no join click and nothing
  // stored. Lowest precedence, so a real grant above keeps its own badge. Being
  // live rather than stored, it also ends when the owner unpublishes or prices the
  // Edition; grandfathering an already-joined learner is what an `enrollments` row
  // is for (still honoured above, unused by the catalogue path).
  for (const lang of await freePublishedLangs(ctx, topicId)) if (!grants.has(lang)) grants.set(lang, "viewer");
  return grants;
}

// The three table reads, each named once. Every predicate below is composed from
// these, so a caller never writes an index read of a grant table again, and the
// predicates stay as cheap as the hand-written versions they replaced: a narrow
// question still costs one read, not a walk of all three.
//
// Legacy Share rows carry no `lang`; `shareLang` (applied by the callers) reads
// them as the English Edition, consistent with `getEditableTopic`.
function shareRows(ctx: QueryCtx, topicId: Id<"topics">, userId: Id<"users">) {
  return ctx.db
    .query("shares")
    .withIndex("by_topic_viewer", (q) => q.eq("topicId", topicId).eq("viewerId", userId))
    .collect();
}
function entitlementRows(ctx: QueryCtx, topicId: Id<"topics">, userId: Id<"users">) {
  return ctx.db
    .query("entitlements")
    .withIndex("by_topic_user", (q) => q.eq("topicId", topicId).eq("userId", userId))
    .collect();
}
function enrollmentRows(ctx: QueryCtx, topicId: Id<"topics">, userId: Id<"users">) {
  return ctx.db
    .query("enrollments")
    .withIndex("by_topic_user", (q) => q.eq("topicId", topicId).eq("userId", userId))
    .collect();
}

// Does this account already hold a paid grant on ONE Edition? The narrow question
// `grantsFor` does not answer, and the one every Entitlement writer asks.
//
// **It reads `entitlements` and nothing else, deliberately.** A Share, a free
// published Edition or a grandfathered Enrollment are all access without an
// Entitlement, and every caller here is about to WRITE an Entitlement (or refuse
// to spend a seat that would write one), so widening this to "has any access"
// would suppress grants the buyer has paid for. `vouchers.redeem` asks the wider
// question through `survivesTheOwner` below, where it is named.
export async function hasEntitlement(
  ctx: QueryCtx,
  topicId: Id<"topics">,
  userId: Id<"users">,
  lang: string,
): Promise<boolean> {
  return (await entitlementRows(ctx, topicId, userId)).some((e) => e.lang === lang);
}

// Does this caller hold access to this Edition that the owner cannot take away?
//
// The question the voucher rail asks, and the reason a Share does not count:
// both a Share and a free published Edition are access the caller has TODAY and
// can lose tomorrow (the owner revokes the Share, or unpublishes or prices the
// Edition), so redeeming a code on top of one of those converts revocable access
// into an Entitlement nobody can withdraw. That is not nothing, so the seat is
// not wasted and the code is spent. Ownership, an Entitlement and a grandfathered
// Enrollment are the three that survive anything the owner does.
//
// Ownership is the caller's to check: it needs the Topic row, which this module
// deliberately does not load.
export async function survivesTheOwner(
  ctx: QueryCtx,
  topicId: Id<"topics">,
  userId: Id<"users">,
  lang: string,
): Promise<boolean> {
  if (await hasEntitlement(ctx, topicId, userId, lang)) return true;
  return (await enrollmentRows(ctx, topicId, userId)).some((e) => e.lang === lang);
}

// Does this caller hold this Topic personally, by any route that is not "it
// happens to be free right now"?
//
// Language is ignored on purpose: the catalogue card is one course with its
// Editions as chips, so a caller holding any one of them would otherwise be shown
// a card whose primary action opens the Edition they already have.
export async function heldPersonally(ctx: QueryCtx, topicId: Id<"topics">, userId: Id<"users">): Promise<boolean> {
  // Ordered cheapest-likeliest first and short-circuited, the way the hand-written
  // copy in `catalogue.ts` was: this runs once per card in the Catalogue.
  if ((await entitlementRows(ctx, topicId, userId)).length > 0) return true;
  if ((await shareRows(ctx, topicId, userId)).length > 0) return true;
  return (await enrollmentRows(ctx, topicId, userId)).length > 0;
}

// Does this account hold a **Seat** on an Organisation Voucher? (ADR 0031.)
//
// The `seats` table is written by `accessCodes.ts` and read here, which is where
// it belongs: `seats` is a grant table, and this module owns the grant tables. It
// lived in `edition.ts` until 2026-09-08, which put a read of another rail's table
// inside the Edition reader and paygate core.
//
// A row stripped of its `userId` by a withdrawal cannot match, which is correct:
// that member no longer holds a Seat.
export async function holdsSeat(ctx: QueryCtx, userId: Id<"users">): Promise<boolean> {
  const seat = await ctx.db
    .query("seats")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  return seat !== null;
}

// ---- the one Entitlement writer -------------------------------------------------

// Grant one Edition to one account, once. Returns which happened, so each rail
// decides what an existing hold means for it.
//
// Five rails minted Entitlements and they ran three different idempotence
// policies: `market.ts` (twice) and `eft.ts` guarded with `hasEntitlement`,
// `vouchers.ts` threw so the code stayed unspent, and `accessCodes.ts` checked
// NOTHING, so a member who had already bought an Edition and then joined by
// access code got a second `entitlements` row. That last one was a defect no ADR
// sanctioned: ADR 0031 governs which fields the row carries, not how many rows
// exist.
//
// **Provenance stays the caller's, and is never derived here.** ADR 0029 and ADR
// 0031 both decide that a voucher seat's and a Seat's Entitlement carry no
// provenance at all, so that a redeemed seat is byte-identical to an Admin comp.
// Passing nothing is how a rail says "anonymous", and this module must not infer
// otherwise.
// Take one Edition's Entitlement away. The ONLY revocation path in the product
// (there are no automated refunds), and the counterpart of `grantEdition`, so
// that both sides of the `entitlements` table live behind one interface.
//
// Scoped to one language on purpose: other Editions the buyer holds of the same
// course are untouched. A no-op when there is no matching row.
export async function revokeEdition(
  ctx: MutationCtx,
  revoke: { userId: Id<"users">; topicId: Id<"topics">; lang: string },
): Promise<"revoked" | "not-held"> {
  const rows = (await entitlementRows(ctx, revoke.topicId, revoke.userId)).filter((e) => e.lang === revoke.lang);
  for (const e of rows) await ctx.db.delete(e._id);
  return rows.length > 0 ? "revoked" : "not-held";
}

export async function grantEdition(
  ctx: MutationCtx,
  grant: {
    userId: Id<"users">;
    topicId: Id<"topics">;
    lang: string;
    // At most one, and only from the two rails that record a sale. Absent means
    // anonymous, which is the decided shape for a voucher seat and an org Seat.
    pfPaymentId?: string;
    eftRef?: string;
  },
): Promise<"granted" | "already-held"> {
  const { userId, topicId, lang, pfPaymentId, eftRef } = grant;
  if (await hasEntitlement(ctx, topicId, userId, lang)) return "already-held";
  await ctx.db.insert("entitlements", { userId, topicId, lang, pfPaymentId, eftRef });
  return "granted";
}
