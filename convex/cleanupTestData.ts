import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";

// **A one-off operator tool, not a feature.** Written 2026-08-27 to clear the test
// Bulk Vouchers and Organisation Vouchers that were sitting on the sysadmin's two
// settlement queues in production. Delete this file once it has been run.
//
// It exists because neither rail cascades and two of the links are one-way:
//
//   - An Entitlement carries NO provenance, by design (ADR 0029/0031). A voucher
//     redemption's Entitlement cannot be found from the batch at all, and a Seat's
//     can only be found while the Seat row still exists to name the `userId`. Delete
//     the Seat first by hand and the Entitlement is orphaned beyond recovery.
//   - A Seat member is a whole Convex Auth identity - `users` with no email plus
//     `authAccounts`, `authSessions`, `authRefreshTokens` - minted by `/join`.
//
// So: `apply: false` (the default posture - always run it that way first) walks the
// graph and returns the exact list of documents it would delete, touching nothing.
// Only `apply: true` deletes, in child-before-parent order.
//
// Internal-only, so nothing client-side can reach it; run it from the dashboard's
// function runner or `npx convex run --prod`.

const MAX = 2000;

type Doomed = { table: string; id: string; note: string };

// A Seat member's whole footprint. **Guarded on the emailless invariant**: `/join`
// creates its accounts with no email field at all (see `auth.ts`'s
// `createOrUpdateUser`), so a `userId` on a Seat that DOES have an email is a real
// signed-in person who joined with a code, and blowing their account away would take
// their other courses with it. Those are reported and skipped, never deleted.
async function purgeSeatMember(
  ctx: MutationCtx,
  userId: Id<"users">,
  topicId: Id<"topics">,
  doomed: Doomed[],
): Promise<void> {
  const user = await ctx.db.get(userId);
  if (!user) return;
  if (user.email !== undefined) {
    doomed.push({ table: "users", id: userId, note: `SKIPPED - has email ${user.email}, not a nickname account` });
    return;
  }

  for (const e of await ctx.db
    .query("entitlements")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(MAX)) {
    doomed.push({ table: "entitlements", id: e._id, note: `${e.lang} edition of ${e.topicId}` });
  }
  for (const e of await ctx.db
    .query("enrollments")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(MAX)) {
    doomed.push({ table: "enrollments", id: e._id, note: e.lang });
  }
  for (const p of await ctx.db
    .query("userPrefs")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(MAX)) {
    doomed.push({ table: "userPrefs", id: p._id, note: p.locale ?? "" });
  }
  for (const p of await ctx.db
    .query("progress")
    .withIndex("by_user_lastReadAt", (q) => q.eq("userId", userId))
    .take(MAX)) {
    doomed.push({ table: "progress", id: p._id, note: `${p.lessonKey} ${p.status}` });
  }

  // These three lead their indexes with `topicId`, so they are read per-topic and
  // filtered rather than scanned. A Seat member only ever had access to the one
  // Edition the code sold, so the topic the code points at is their whole history.
  for (const r of await ctx.db
    .query("responses")
    .withIndex("by_topic", (q) => q.eq("topicId", topicId))
    .take(MAX)) {
    if (r.userId === userId) doomed.push({ table: "responses", id: r._id, note: `${r.lessonKey}/${r.quizId}` });
  }
  for (const c of await ctx.db
    .query("certificates")
    .withIndex("by_topic_user", (q) => q.eq("topicId", topicId).eq("userId", userId))
    .take(MAX)) {
    doomed.push({ table: "certificates", id: c._id, note: c.learnerName });
  }
  for (const asked of await ctx.db
    .query("questions")
    .withIndex("by_topic_user", (q) => q.eq("topicId", topicId).eq("userId", userId))
    .take(MAX)) {
    doomed.push({ table: "questions", id: asked._id, note: asked.lessonKey });
  }

  // The auth identity. Refresh tokens hang off sessions and verification codes off
  // accounts, so both are walked from their parent rather than guessed at.
  for (const s of await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .take(MAX)) {
    for (const t of await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", s._id))
      .take(MAX)) {
      doomed.push({ table: "authRefreshTokens", id: t._id, note: "" });
    }
    doomed.push({ table: "authSessions", id: s._id, note: "" });
  }
  for (const a of await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
    .take(MAX)) {
    for (const c of await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", a._id))
      .take(MAX)) {
      doomed.push({ table: "authVerificationCodes", id: c._id, note: "" });
    }
    doomed.push({ table: "authAccounts", id: a._id, note: `${a.provider}:${a.providerAccountId}` });
  }
  doomed.push({ table: "users", id: userId, note: user.name ?? "(nickname account)" });
}

export const purgeVoucherTestData = internalMutation({
  args: {
    // Matched against `voucherBatches.orgName` / `accessCodes.orgName` exactly, which
    // is what the sysadmin queue shows in bold on each line. Both tables are small
    // enough to scan; no index exists on the name and adding one for a throwaway
    // would be worse than the scan.
    batchOrgNames: v.array(v.string()),
    accessCodeOrgNames: v.array(v.string()),
    // The Entitlements minted by VOUCHER REDEMPTIONS, which nothing links back to the
    // batch (ADR 0029). The dry run lists every Entitlement on the batch's Edition
    // with its holder's email so you can pick; pass the ids back here to delete them.
    // Left empty they survive, which is the safe direction.
    redemptionEntitlementIds: v.array(v.id("entitlements")),
    apply: v.boolean(),
  },
  returns: v.object({
    apply: v.boolean(),
    doomed: v.array(v.object({ table: v.string(), id: v.string(), note: v.string() })),
    candidates: v.array(v.object({ entitlementId: v.string(), holder: v.string(), note: v.string() })),
    counts: v.any(),
  }),
  handler: async (ctx, args) => {
    const doomed: Doomed[] = [];
    const candidates: { entitlementId: string; holder: string; note: string }[] = [];

    // ---- Bulk Vouchers -------------------------------------------------------
    const batches = await ctx.db.query("voucherBatches").take(MAX);
    for (const b of batches.filter((row) => args.batchOrgNames.includes(row.orgName))) {
      const issued = await ctx.db
        .query("vouchers")
        .withIndex("by_batch", (q) => q.eq("batchId", b._id))
        .take(MAX);
      for (const c of issued) {
        doomed.push({ table: "vouchers", id: c._id, note: c.redeemedAt === undefined ? "unredeemed" : "REDEEMED" });
      }
      // The redemptions' Entitlements, offered rather than taken: this is every
      // holder of the Edition, and a real buyer looks identical to a redeemer here.
      if (issued.some((c) => c.redeemedAt !== undefined)) {
        for (const e of await ctx.db
          .query("entitlements")
          .withIndex("by_topic", (q) => q.eq("topicId", b.topicId))
          .take(MAX)) {
          if (e.lang !== b.lang) continue;
          const holder = await ctx.db.get(e.userId);
          candidates.push({
            entitlementId: e._id,
            holder: holder?.email ?? "(no email - nickname account)",
            // A rail-stamped Entitlement was bought, so it is NOT a redemption.
            note: e.pfPaymentId
              ? "PayFast sale - leave"
              : e.eftRef
                ? "EFT sale - leave"
                : "no rail - comp or redemption",
          });
        }
      }
      doomed.push({ table: "voucherBatches", id: b._id, note: `${b.orgName} / ${b.seats} seats` });
      doomed.push({ table: "ledger", id: b.ledgerId, note: `batch row for ${b.orgName}` });
    }

    // ---- Organisation Vouchers ----------------------------------------------
    const accessCodes = await ctx.db.query("accessCodes").take(MAX);
    for (const c of accessCodes.filter((row) => args.accessCodeOrgNames.includes(row.orgName))) {
      const taken = await ctx.db
        .query("seats")
        .withIndex("by_access_code", (q) => q.eq("accessCodeId", c._id))
        .take(MAX);
      for (const s of taken) {
        // A stripped Seat (POPIA withdrawal) has no `userId` left - nothing to purge
        // but the row itself.
        if (s.userId) await purgeSeatMember(ctx, s.userId, c.topicId, doomed);
        doomed.push({ table: "seats", id: s._id, note: s.nicknameKey ?? "(stripped)" });
      }
      doomed.push({ table: "accessCodes", id: c._id, note: `${c.orgName} / ${taken.length} of ${c.capacity}` });
      // A code still RUNNING has no Ledger row: the money event is stopping it.
      if (c.ledgerId) doomed.push({ table: "ledger", id: c.ledgerId, note: `stopped-code row for ${c.orgName}` });
    }

    for (const id of args.redemptionEntitlementIds) {
      doomed.push({ table: "entitlements", id, note: "named redemption entitlement" });
    }

    const counts: Record<string, number> = {};
    for (const d of doomed) counts[d.table] = (counts[d.table] ?? 0) + 1;

    if (args.apply) {
      // Child before parent, and Ledger rows last of all: if this transaction were
      // to fail partway the money row is the one you most want still standing.
      const order = [
        "authRefreshTokens",
        "authVerificationCodes",
        "authSessions",
        "authAccounts",
        "responses",
        "progress",
        "questions",
        "certificates",
        "userPrefs",
        "entitlements",
        "enrollments",
        "users",
        "vouchers",
        "seats",
        "voucherBatches",
        "accessCodes",
        "ledger",
      ];
      const seen = new Set<string>();
      for (const table of order) {
        for (const d of doomed) {
          if (d.table !== table) continue;
          if (d.note.startsWith("SKIPPED")) continue;
          // The same Entitlement can arrive twice (a Seat member's `by_user` sweep
          // and a hand-named redemption id); a second delete of one id throws.
          if (seen.has(d.id)) continue;
          seen.add(d.id);
          await ctx.db.delete(d.id as Id<"users">);
        }
      }
    }

    return { apply: args.apply, doomed, candidates, counts };
  },
});
