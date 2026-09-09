/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";
import { grantEdition, hasEntitlement, heldPersonally, holdsSeat, survivesTheOwner } from "./grants";
import { CONSENT_VERSION } from "./joinConsent";

// The grant tables as one module (ticket 28, candidate 4 of the 2026-09-04
// architecture review). Four files each walked `shares`/`entitlements`/
// `enrollments` for themselves and the shapes had drifted; a fifth wrote
// Entitlements with no hold check at all.
//
// `grant-resolver.test.ts` already covers `grantsFor`'s precedence, so this file
// covers what that one cannot: the narrow predicates, and the one writer.

const modules = import.meta.glob("./**/*.ts");

async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}
async function seedTopic(t: ReturnType<typeof convexTest>, ownerId: Id<"users">, slug: string) {
  return await t.run((ctx) => ctx.db.insert("topics", { ownerId, slug, title: slug, status: "completed" as const }));
}

// ---- the one writer -------------------------------------------------------------

test("grantEdition writes one row and reports the second call as already held", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const buyer = await seedUser(t, "buyer@example.com");
  const topicId = await seedTopic(t, owner, "hindi");

  const first = await t.run((ctx) => grantEdition(ctx, { userId: buyer, topicId, lang: "en", pfPaymentId: "pf-1" }));
  const second = await t.run((ctx) => grantEdition(ctx, { userId: buyer, topicId, lang: "en", pfPaymentId: "pf-2" }));

  expect(first).toBe("granted");
  expect(second).toBe("already-held");
  const rows = await t.run((ctx) => ctx.db.query("entitlements").collect());
  expect(rows).toHaveLength(1);
  // The first call's provenance stands. A repeat delivery must not rewrite which
  // payment bought the Edition.
  expect(rows[0]).toMatchObject({ lang: "en", pfPaymentId: "pf-1" });
});

test("grantEdition is per language, so holding one Edition does not suppress another", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const buyer = await seedUser(t, "buyer@example.com");
  const topicId = await seedTopic(t, owner, "hindi");

  expect(await t.run((ctx) => grantEdition(ctx, { userId: buyer, topicId, lang: "en" }))).toBe("granted");
  expect(await t.run((ctx) => grantEdition(ctx, { userId: buyer, topicId, lang: "af" }))).toBe("granted");
  expect(await t.run((ctx) => ctx.db.query("entitlements").collect())).toHaveLength(2);
});

test("grantEdition writes no provenance when the rail passes none, which is the voucher and Seat shape", async () => {
  // ADR 0029 decision 3 and ADR 0031 decision 7: a voucher seat's Entitlement is
  // byte-identical to an Admin comp. The shared writer must not invent a field.
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const member = await seedUser(t, "member@example.com");
  const topicId = await seedTopic(t, owner, "hindi");

  await t.run((ctx) => grantEdition(ctx, { userId: member, topicId, lang: "en" }));

  const [row] = await t.run((ctx) => ctx.db.query("entitlements").collect());
  expect(row!.pfPaymentId).toBeUndefined();
  expect(row!.eftRef).toBeUndefined();
});

// ---- the narrow predicates ------------------------------------------------------

test("hasEntitlement reads entitlements and nothing else", async () => {
  // The point of keeping it narrow: every caller is about to WRITE an Entitlement,
  // and a Share or a free published Edition is access that the owner can withdraw.
  // Widening this would suppress a grant the buyer paid for.
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const viewer = await seedUser(t, "viewer@example.com");
  const topicId = await seedTopic(t, owner, "hindi");
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId: viewer, lang: "en" }));

  expect(await t.run((ctx) => hasEntitlement(ctx, topicId, viewer, "en"))).toBe(false);
  // But it IS a personal hold, which is the wider question the Catalogue asks.
  expect(await t.run((ctx) => heldPersonally(ctx, topicId, viewer))).toBe(true);
});

test("survivesTheOwner counts an Entitlement and an Enrollment, and refuses to count a Share", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const shared = await seedUser(t, "shared@example.com");
  const enrolled = await seedUser(t, "enrolled@example.com");
  const bought = await seedUser(t, "bought@example.com");
  const topicId = await seedTopic(t, owner, "hindi");
  await t.run(async (ctx) => {
    await ctx.db.insert("shares", { topicId, viewerId: shared, lang: "en" });
    await ctx.db.insert("enrollments", { topicId, userId: enrolled, lang: "en" });
    await ctx.db.insert("entitlements", { topicId, userId: bought, lang: "en" });
  });

  // A Share is revocable, so redeeming a voucher on top of one really does buy the
  // member something and the code is spent (ADR 0029, and the voucher rail's own
  // reasoning). The other two survive anything the owner does.
  expect(await t.run((ctx) => survivesTheOwner(ctx, topicId, shared, "en"))).toBe(false);
  expect(await t.run((ctx) => survivesTheOwner(ctx, topicId, enrolled, "en"))).toBe(true);
  expect(await t.run((ctx) => survivesTheOwner(ctx, topicId, bought, "en"))).toBe(true);
  // Per language, like every other hold question here.
  expect(await t.run((ctx) => survivesTheOwner(ctx, topicId, bought, "af"))).toBe(false);
});

test("heldPersonally ignores language, because a Catalogue card is one course", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const buyer = await seedUser(t, "buyer@example.com");
  const stranger = await seedUser(t, "stranger@example.com");
  const topicId = await seedTopic(t, owner, "hindi");
  await t.run((ctx) => ctx.db.insert("entitlements", { topicId, userId: buyer, lang: "af" }));

  expect(await t.run((ctx) => heldPersonally(ctx, topicId, buyer))).toBe(true);
  expect(await t.run((ctx) => heldPersonally(ctx, topicId, stranger))).toBe(false);
});

test("holdsSeat matches a Seat and stops matching once the userId is stripped", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const member = await seedUser(t, "member@example.com");
  const topicId = await seedTopic(t, owner, "hindi");
  const codeId = await t.run((ctx) =>
    ctx.db.insert("accessCodes", {
      topicId,
      lang: "en",
      sellerId: owner,
      code: "GRP-AAA-BBB-CCC",
      capacity: 3,
      pricePerSeat: 15000,
      orgName: "Org",
      orgContact: "billing@org.example",
    }),
  );
  const seatId = await t.run((ctx) =>
    ctx.db.insert("seats", {
      accessCodeId: codeId,
      userId: member,
      nicknameKey: "thandi",
      consentedAt: Date.now(),
      consentVersion: CONSENT_VERSION,
    }),
  );

  expect(await t.run((ctx) => holdsSeat(ctx, member))).toBe(true);
  // A withdrawal strips the userId, and that member no longer holds a Seat.
  await t.run((ctx) => ctx.db.patch(seatId, { userId: undefined }));
  expect(await t.run((ctx) => holdsSeat(ctx, member))).toBe(false);
});

// ---- the fifth writer, which used to check nothing --------------------------------

test("claimSeat grants once even if the joining account somehow already holds the Edition", async () => {
  // `claimSeat` ran no hold check before 2026-09-08. It is NOT reachable with an
  // already-entitled account through the product: `accessCodeAuth.ts` mints a fresh
  // account per (code, nickname), and a returning nickname short-circuits in
  // `forJoin`. So this drives the internal mutation directly, which is the only
  // caller shape that can express the case, and pins the invariant on this rail
  // rather than on the account-minting scheme two files away.
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const member = await seedUser(t, "member@example.com");
  const topicId = await seedTopic(t, owner, "hindi");
  const codeId = await t.run((ctx) =>
    ctx.db.insert("accessCodes", {
      topicId,
      lang: "en",
      sellerId: owner,
      code: "GRP-AAA-BBB-CCC",
      capacity: 3,
      pricePerSeat: 15000,
      orgName: "Org",
      orgContact: "billing@org.example",
    }),
  );
  await t.run((ctx) => ctx.db.insert("entitlements", { topicId, userId: member, lang: "en" }));

  await t.mutation(internal.accessCodes.claimSeat, {
    accessCodeId: codeId,
    userId: member,
    nicknameKey: "thandi",
    consentVersion: CONSENT_VERSION,
  });

  // The seat is consumed (the operator's 2026-09-08 call: a taken seat is taken),
  // and there is still exactly one Entitlement row.
  expect(await t.run((ctx) => ctx.db.query("seats").collect())).toHaveLength(1);
  expect(await t.run((ctx) => ctx.db.query("entitlements").collect())).toHaveLength(1);
});

// ---- the boundary -----------------------------------------------------------------

test("the Entitlement table has exactly one writer, and one per-Edition hold reader", async () => {
  // Ticket 28's actual destination, scoped to what was actually duplicated. Two
  // signatures, and both had four or five copies:
  //
  //   1. Writing `entitlements`. Five rails did. `grantEdition` and
  //      `revokeEdition` do.
  //   2. The per-(Topic, caller) hold read on `entitlements`/`enrollments`. Four
  //      files did. The predicates in this module do.
  //
  // Deliberately NOT in scope: the `shares` table's own rail (invites, roles and
  // translation cloning in `shares.ts`, `shareGrants.ts`, `translate.ts`,
  // `topicAccess.ts`), the `seats` rail's own reads in `accessCodes.ts`, and the
  // by-Topic and by-User rollups in `dashboard.ts` and `market.ts`. Those are
  // different questions rather than copies of this one, and a boundary test that
  // flagged them would be switched off within a week.
  const files = import.meta.glob("./**/*.ts", { query: "?raw", import: "default", eager: true }) as Record<
    string,
    string
  >;
  const src = Object.entries(files).filter(([p]) => !p.endsWith(".test.ts") && p !== "./grants.ts");

  const writers = src.filter(([, s]) => s.includes('insert("entitlements"')).map(([p]) => p);
  expect(writers).toEqual([]);

  const holdRead = /query\("(entitlements|enrollments)"\)\s*\.withIndex\("by_topic_user"/;
  const holdReaders = src.filter(([, s]) => holdRead.test(s)).map(([p]) => p);
  expect(holdReaders).toEqual([]);
});
