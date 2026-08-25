/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { beforeAll, expect, test } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

// The shared capped Access Code rail (ADR 0031, the shared-access-codes map).
// Everything here is asserted through the Convex function boundary: what a query
// returns, whether a mutation throws, and what rows exist afterwards. Never on how
// a code is generated or how a mutation is structured inside.
//
// Fixtures follow `convex/vouchers.test.ts` and `convex/eft.test.ts`: `users` rows
// as auth writes them, `whitelist` rows as `whitelist.seedEmail` writes them, and
// everything else through the production mutation that owns it. **An `accessCodes`
// or `seats` row is NEVER hand-inserted** - a test mints a code and joins through
// the real credentials provider, so the only writers that exist are the ones being
// exercised.

const modules = import.meta.glob("./**/*.ts");

// Convex Auth signs a session JWT on a successful sign-in, which needs a private
// key and an issuer in the environment. Minted here exactly as `auth.test.ts` does
// it, so the accepted join path can actually complete rather than being asserted
// one mutation short of the thing that matters.
beforeAll(() => {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  process.env.JWT_PRIVATE_KEY = privateKey as string;
  process.env.CONVEX_SITE_URL = "https://example.convex.site";
  // `setEnvDefaults` materialises the Google provider off these, and
  // `getProviderOrThrow` walks the whole providers array. The values are never
  // used: no HTTP hop runs here.
  process.env.AUTH_GOOGLE_ID = "test-google-client-id";
  process.env.AUTH_GOOGLE_SECRET = "test-google-client-secret";
});

function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}
async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}
async function seedSysAdmin(t: ReturnType<typeof convexTest>, email: string) {
  const id = await seedUser(t, email);
  await t.run((ctx) => ctx.db.insert("whitelist", { email, isAdmin: true }));
  return id;
}

const PAYOUT = { accountHolder: "A. Author", bank: "FNB", accountNumber: "62000000001", branchCode: "250655" };
const ORG = { orgName: "The Party", orgContact: "billing@party.example.org" };

// A Seller who may mint: the admin grants can-sell, the Seller saves payout
// details, and the owner publishes their own completed course. Only `topics` and
// `lessons` are hand-inserted, following `vouchers.test.ts`.
//
// Deliberately NOT priced. A shared code needs a PUBLISHED Edition, not a priced
// one - the Seller states the per-seat price - so pricing it here would test a gate
// that does not exist.
async function seedSeller(t: ReturnType<typeof convexTest>, admin: Id<"users">, email: string, slug: string) {
  const seller = await seedUser(t, email);
  const topicId = await t.run((ctx) =>
    ctx.db.insert("topics", { ownerId: seller, slug, title: slug, status: "completed" as const }),
  );
  await t.run(async (ctx) => {
    const htmlStorageId = await ctx.storage.store(new Blob(["<p>lesson</p>"], { type: "text/html" }));
    await ctx.db.insert("lessons", { topicId, key: "0001", seq: 1, title: "Lesson 1", htmlStorageId });
  });
  await asUser(t, admin).mutation(api.sellers.grantCanSell, { email });
  await asUser(t, seller).mutation(api.sellers.savePayoutDetails, PAYOUT);
  await asUser(t, seller).mutation(api.catalogue.setEditionPublished, { topicSlug: slug, lang: "en", published: true });
  return { seller, topicId };
}

const MINT = { topicSlug: "hindi", lang: "en", capacity: 3, pricePerSeat: 15000, ...ORG };

async function ledgerRows(t: ReturnType<typeof convexTest>) {
  return await t.run((ctx) => ctx.db.query("ledger").take(200));
}
async function seatRows(t: ReturnType<typeof convexTest>) {
  return await t.run((ctx) => ctx.db.query("seats").take(200));
}

// ---- Minting (ticket 02) ------------------------------------------------------

test("minting writes one code row, no ledger row, and no seats", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller, topicId } = await seedSeller(t, admin, "author@example.com", "hindi");

  const { accessCodeId, code } = await asUser(t, seller).mutation(api.accessCodes.mintAccessCode, MINT);

  const row = await t.run((ctx) => ctx.db.get(accessCodeId));
  expect(row).toMatchObject({
    topicId,
    lang: "en",
    sellerId: seller,
    code,
    capacity: 3,
    pricePerSeat: 15000,
    orgName: "The Party",
    orgContact: "billing@party.example.org",
  });
  // Absent until the code stops. **This is the structural difference from a
  // Voucher Batch**, which writes its Ledger row at mint because its total is known
  // then: an Access Code's total is unknown until somebody ends the agreement.
  expect(row).not.toHaveProperty("stoppedAt");
  expect(row).not.toHaveProperty("ledgerId");
  expect(row).not.toHaveProperty("paymentRef");
  expect(await ledgerRows(t)).toEqual([]);
  expect(await seatRows(t)).toEqual([]);

  // `GRP-7K4-Q2X-9MB`: a different SHAPE from a voucher's `MYC-7K4Q-2XR9`, not just
  // a different prefix, because both rails can be live on one Edition at once.
  // No O, I, 0 or 1 anywhere in it: this code gets read out loud at a meeting.
  expect(code).toMatch(/^GRP(-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{3}){3}$/);
});

test("a freshly minted code is invisible to payouts and to the sales report", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");

  await asUser(t, seller).mutation(api.accessCodes.mintAccessCode, MINT);

  // Nothing to be invisible to yet, which is the point: no money event exists.
  expect(await asUser(t, admin).query(api.ledger.owedPayouts, {})).toEqual([]);
  expect(await asUser(t, admin).query(api.sales.report, {})).toEqual([]);
});

test("minting is refused for anybody but a ready Seller who owns a published edition", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");
  const stranger = await seedUser(t, "stranger@example.com");

  // Signed out.
  await expect(t.mutation(api.accessCodes.mintAccessCode, MINT)).rejects.toThrow();
  // Signed in, but not this course's owner - asserted SERVER-side, not by which
  // Editions a page lists.
  await expect(asUser(t, stranger).mutation(api.accessCodes.mintAccessCode, MINT)).rejects.toThrow();

  // Owner, granted, with payout details, but the Edition is unpublished.
  await asUser(t, seller).mutation(api.catalogue.setEditionPublished, {
    topicSlug: "hindi",
    lang: "en",
    published: false,
  });
  await expect(asUser(t, seller).mutation(api.accessCodes.mintAccessCode, MINT)).rejects.toThrow();
});

test("the cap and the per-seat price are both bounded", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");
  const mint = (args: Partial<typeof MINT>) =>
    asUser(t, seller).mutation(api.accessCodes.mintAccessCode, { ...MINT, ...args });

  await expect(mint({ capacity: 0 })).rejects.toThrow();
  await expect(mint({ capacity: -1 })).rejects.toThrow();
  await expect(mint({ capacity: 2.5 })).rejects.toThrow();
  await expect(mint({ capacity: 100000 })).rejects.toThrow();
  // Zero is refused as well as negative: a free shared code is a free published
  // Edition, and a R0.00 settlement line is a puzzle for the operator.
  await expect(mint({ pricePerSeat: 0 })).rejects.toThrow();
  await expect(mint({ pricePerSeat: -100 })).rejects.toThrow();
  // The organisation and its billing contact are what the operator invoices.
  await expect(mint({ orgName: "  " })).rejects.toThrow();
  await expect(mint({ orgContact: "" })).rejects.toThrow();
  expect(await seatRows(t)).toEqual([]);
});

test("one Seller may mint two codes for the same edition - two organisations are two bills", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");

  const one = await asUser(t, seller).mutation(api.accessCodes.mintAccessCode, MINT);
  const two = await asUser(t, seller).mutation(api.accessCodes.mintAccessCode, {
    ...MINT,
    orgName: "Another Party",
    orgContact: "billing@another.example.org",
    pricePerSeat: 20000,
  });

  expect(one.code).not.toEqual(two.code);
  const mine = await asUser(t, seller).query(api.accessCodes.myAccessCodes, {});
  expect(mine).toHaveLength(2);
  expect(mine.map((c) => c.orgName).sort()).toEqual(["Another Party", "The Party"]);
});

test("myAccessCodes lists the caller's own codes with a derived count, and never another Seller's", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");
  const { seller: other } = await seedSeller(t, admin, "other@example.com", "urdu");

  const { accessCodeId, code } = await asUser(t, seller).mutation(api.accessCodes.mintAccessCode, MINT);
  await asUser(t, other).mutation(api.accessCodes.mintAccessCode, {
    ...MINT,
    topicSlug: "urdu",
    orgName: "Someone Else",
  });

  const mine = await asUser(t, seller).query(api.accessCodes.myAccessCodes, {});
  expect(mine).toHaveLength(1);
  expect(mine[0]).toMatchObject({
    accessCodeId,
    topicSlug: "hindi",
    courseTitle: "hindi",
    lang: "en",
    code,
    capacity: 3,
    // Nobody has joined, so the derived count is zero and so is the running total.
    taken: 0,
    pricePerSeat: 15000,
    runningTotal: 0,
    orgName: "The Party",
    stoppedAt: null,
    paymentRef: null,
  });

  // Signed out sees nothing rather than throwing: the Seller's dialog mounts this
  // query before auth has settled.
  expect(await t.query(api.accessCodes.myAccessCodes, {})).toEqual([]);
});

// ---- Joining (ticket 03) -------------------------------------------------------

const CONSENT = "2026-08-23";

// Join a code the way `/join` does: through Convex Auth's own `signIn` action and
// the real credentials provider. Nothing about a Seat is ever hand-inserted, so
// every row a test reads was written by the code that writes it in production.
async function join(
  t: ReturnType<typeof convexTest>,
  params: { code: string; nickname: string; pin: string; consentVersion?: string },
) {
  return await t.action(api.auth.signIn, {
    provider: "accessCode",
    params: { flow: "join", consentVersion: CONSENT, ...params },
  });
}
async function comeBack(t: ReturnType<typeof convexTest>, params: { code: string; nickname: string; pin: string }) {
  return await t.action(api.auth.signIn, { provider: "accessCode", params: { flow: "return", ...params } });
}

async function entitlementRows(t: ReturnType<typeof convexTest>) {
  return await t.run((ctx) => ctx.db.query("entitlements").take(200));
}
async function tagOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (e) {
    // `data` is what survives a production deployment. A plain `Error` would arrive
    // at the member as "Server Error", which is the whole reason these are tagged.
    return e instanceof ConvexError && typeof e.data === "string" ? e.data : `untagged: ${String(e)}`;
  }
  return "did not throw";
}

test("a member joins with a nickname and a PIN and is in the course, with no email anywhere", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller, topicId } = await seedSeller(t, admin, "author@example.com", "hindi");
  const { accessCodeId, code } = await asUser(t, seller).mutation(api.accessCodes.mintAccessCode, MINT);

  await join(t, { code, nickname: "Thandi", pin: "1234" });

  const seats = await seatRows(t);
  expect(seats).toHaveLength(1);
  expect(seats[0]).toMatchObject({
    accessCodeId,
    // Normalised: trimmed, inner whitespace collapsed, lower-cased. The key has to
    // be stable across devices, because it is half the account identity.
    nicknameKey: "thandi",
    consentVersion: CONSENT,
    consentedAt: expect.any(Number),
  });
  // **No PIN is anywhere in this row.** It is the `secret` Convex Auth hashed into
  // `authAccounts`, so nothing in `seats` can verify one, by construction.
  expect(Object.keys(seats[0]!).sort()).toEqual([
    "_creationTime",
    "_id",
    "accessCodeId",
    "consentVersion",
    "consentedAt",
    "nicknameKey",
    "userId",
  ]);

  // The member's `users` row carries **no `email` field at all**, not an empty
  // string and not `undefined`. This is trap 1's fix asserted directly: an absent
  // field is absent from the `email` index, so no two Seats can collide there.
  const member = await t.run((ctx) => ctx.db.get(seats[0]!.userId!));
  expect(member).not.toHaveProperty("email");
  expect(Object.keys(member!).sort()).toEqual(["_creationTime", "_id"]);

  // The Entitlement, and **its key set is pinned exactly** (ADR 0031, keeping ADR
  // 0029's decision 3 by half). A Seat's Entitlement is byte-identical to an Admin
  // comp: no `accessCodeId`, no `pfPaymentId`, no `eftRef`. A refactor that adds
  // provenance back must fail HERE rather than quietly ending the promise the
  // organisation's members were given. Do not delete this as redundant.
  const held = await entitlementRows(t);
  expect(held).toHaveLength(1);
  expect(held[0]).toMatchObject({ userId: seats[0]!.userId, topicId, lang: "en" });
  expect(Object.keys(held[0]!).sort()).toEqual(["_creationTime", "_id", "lang", "topicId", "userId"]);
});

test("three members joining one code are three accounts with three entitlements (trap 1)", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");
  const { code } = await asUser(t, seller).mutation(api.accessCodes.mintAccessCode, MINT);

  // **Three, not two, and the number is the assertion.** Trap 1 (vouchers ticket 11,
  // re-verified against @convex-dev/auth@0.0.80 on 2026-08-23) is that a provider
  // supplying no email makes `createOrUpdateUser` insert `email: ""`; the SECOND
  // member then matches that row on the `email` index and signs in as the first,
  // inheriting their Entitlement and progress, and the THIRD makes `.unique()`
  // throw. With one tester it looks perfect.
  await join(t, { code, nickname: "Thandi", pin: "1234" });
  await join(t, { code, nickname: "Sipho", pin: "5678" });
  await join(t, { code, nickname: "Naledi", pin: "4321" });

  const seats = await seatRows(t);
  expect(seats).toHaveLength(3);
  expect(seats.map((s) => s.nicknameKey).sort()).toEqual(["naledi", "sipho", "thandi"]);
  // Three DISTINCT users, which is the thing trap 1 destroys.
  expect(new Set(seats.map((s) => s.userId)).size).toBe(3);
  const held = await entitlementRows(t);
  expect(held).toHaveLength(3);
  expect(new Set(held.map((e) => e.userId)).size).toBe(3);
});

test("the cap is atomic: two joins at the last seat, exactly one wins", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");
  const { code } = await asUser(t, seller).mutation(api.accessCodes.mintAccessCode, { ...MINT, capacity: 2 });

  await join(t, { code, nickname: "Thandi", pin: "1234" });

  // Two members arriving on the last seat at once. The cap is read and consumed in
  // ONE mutation, so the loser is refused rather than both being let in and both
  // being billed. A cap read in one function and consumed in another sells this
  // seat twice.
  const results = await Promise.allSettled([
    join(t, { code, nickname: "Sipho", pin: "5678" }),
    join(t, { code, nickname: "Naledi", pin: "4321" }),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(await seatRows(t)).toHaveLength(2);
  expect(await entitlementRows(t)).toHaveLength(2);

  // And the next member is told the seats are gone, distinguishably from a code
  // that never existed: one is their organisation's problem, the other is a typo.
  expect(await tagOf(join(t, { code, nickname: "Lerato", pin: "1111" }))).toEqual("access/code-full");
});

test("every member-facing refusal is a tagged ConvexError, and taken-nickname is not wrong-PIN", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");
  const { code } = await asUser(t, seller).mutation(api.accessCodes.mintAccessCode, MINT);
  await join(t, { code, nickname: "Thandi", pin: "1234" });

  expect(await tagOf(join(t, { code: "GRP-AAA-AAA-AAA", nickname: "Zola", pin: "1234" }))).toEqual(
    "access/code-unknown",
  );
  // **The distinction the spec insists on.** "Pick another nickname" and "you typed
  // your PIN wrong" send the member to two different actions, and one blurred
  // message sends them to neither. The cost is that a nickname's existence leaks to
  // anybody holding the code, which ADR 0031 records as accepted, not overlooked:
  // it is inherent to a name being the lookup key, and it is why the nickname is
  // self-chosen rather than a real name.
  expect(await tagOf(join(t, { code, nickname: "Thandi", pin: "9999" }))).toEqual("access/nickname-taken");
  expect(await tagOf(comeBack(t, { code, nickname: "Thandi", pin: "9999" }))).toEqual("access/pin-wrong");
  // Case and spacing are one nickname: to everybody in the room `Thandi` and
  // ` thandi ` are the same person, so the second must not silently get a seat.
  expect(await tagOf(join(t, { code, nickname: "  THANDI ", pin: "0000" }))).toEqual("access/nickname-taken");

  // **Consent is refused server-side**, not merely hidden in the UI. An absent
  // version and a stale one are both refused: s11(2) puts the burden of proving
  // consent on us, and a stale cached page must not record a member as agreeing to
  // wording it never showed them.
  expect(await tagOf(join(t, { code, nickname: "Zola", pin: "1234", consentVersion: "" }))).toEqual(
    "access/consent-required",
  );
  expect(await tagOf(join(t, { code, nickname: "Zola", pin: "1234", consentVersion: "1999-01-01" }))).toEqual(
    "access/consent-required",
  );
  // Refused means refused: no seat and no entitlement.
  expect(await seatRows(t)).toHaveLength(1);
  expect(await entitlementRows(t)).toHaveLength(1);
});

test("no Seller-facing query can return a nickname or a userId", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");
  const { code } = await asUser(t, seller).mutation(api.accessCodes.mintAccessCode, MINT);
  await join(t, { code, nickname: "Thandi", pin: "1234" });
  await join(t, { code, nickname: "Sipho", pin: "5678" });

  // The rows exist on this rail, unlike on the voucher one, so "who took a seat" is
  // a query that COULD be written. The promise is kept by the returns validator, not
  // by which fields a page chooses to render, so it is asserted on the shape.
  const mine = await asUser(t, seller).query(api.accessCodes.myAccessCodes, {});
  expect(mine).toHaveLength(1);
  expect(mine[0]).toMatchObject({ taken: 2, runningTotal: 30000 });
  const serialised = JSON.stringify(mine).toLowerCase();
  for (const leak of ["thandi", "sipho", "nickname", "userid", "seatid"]) {
    expect(serialised).not.toContain(leak);
  }
});

test("the grant walk is untouched: a Seat reads a priced edition like any entitlement holder", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");
  const { code } = await asUser(t, seller).mutation(api.accessCodes.mintAccessCode, MINT);
  await join(t, { code, nickname: "Thandi", pin: "1234" });
  const [seat] = await seatRows(t);

  // `lib.ts`'s grant walk was not edited for this rail and does not need to be: a
  // Seat mints an ordinary Entitlement and the walk already treats its presence as
  // access. A ticket that finds itself editing the walk has drifted.
  const mine = await asUser(t, seat!.userId!).query(api.market.myPurchases, {});
  expect(mine.map((row) => row.slug)).toEqual(["hindi"]);
  expect(mine[0]!.langs.map((l) => l.lang)).toEqual(["en"]);
});

// ---- Raising the cap, and stopping (ticket 06) ----------------------------------

test("stopping writes exactly one unpaid batch ledger row for the seats taken", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller, topicId } = await seedSeller(t, admin, "author@example.com", "hindi");
  const { accessCodeId, code } = await asUser(t, seller).mutation(api.accessCodes.mintAccessCode, MINT);
  await join(t, { code, nickname: "Thandi", pin: "1234" });
  await join(t, { code, nickname: "Sipho", pin: "5678" });

  await asUser(t, seller).mutation(api.accessCodes.stopCode, { accessCodeId });

  const row = await t.run((ctx) => ctx.db.get(accessCodeId));
  expect(row!.stoppedAt).toEqual(expect.any(Number));

  // ONE row, for `seats consumed x per-seat price`. Shaped exactly like a batch's:
  // `fee: 0` because no gateway took a cut, the standard split so payout arithmetic
  // is identical on every rail, and `buyerEmail` is the ORGANISATION's billing
  // contact, never a member's.
  const ledger = await ledgerRows(t);
  expect(ledger).toHaveLength(1);
  expect(ledger[0]).toMatchObject({
    topicId,
    lang: "en",
    sellerId: seller,
    buyerEmail: "billing@party.example.org",
    gross: 30000,
    fee: 0,
    net: 30000,
    sellerShare: 15000,
    platformShare: 15000,
    kind: "batch",
    status: "unpaid",
  });
  expect(ledger[0]).not.toHaveProperty("pfPaymentId");
  expect(ledger[0]).not.toHaveProperty("eftRef");
  expect(row!.ledgerId).toEqual(ledger[0]!._id);

  // **Invisible to payouts and to the sales report, with `ledger.ts` and `sales.ts`
  // unedited.** `owedPayouts` reads `by_status` for "owed" and `salesOnly` is an
  // allow-list that excludes batch rows, so both exclusions are free. A ticket that
  // finds itself editing either file has drifted.
  expect(await asUser(t, admin).query(api.ledger.owedPayouts, {})).toEqual([]);
  expect(await asUser(t, admin).query(api.sales.report, {})).toEqual([]);
});

test("stopping a code with zero seats writes no ledger row at all", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");
  const { accessCodeId } = await asUser(t, seller).mutation(api.accessCodes.mintAccessCode, MINT);

  await asUser(t, seller).mutation(api.accessCodes.stopCode, { accessCodeId });

  // A deal that went nowhere settles to nothing and costs no admin. No row, no
  // `ledgerId`, and nothing on the operator's queue to clear.
  const row = await t.run((ctx) => ctx.db.get(accessCodeId));
  expect(row!.stoppedAt).toEqual(expect.any(Number));
  expect(row).not.toHaveProperty("ledgerId");
  expect(await ledgerRows(t)).toEqual([]);
  expect(await asUser(t, admin).query(api.accessCodes.pendingAccessCodes, {})).toEqual([]);
});

test("stopping twice is refused and writes no second row", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");
  const { accessCodeId, code } = await asUser(t, seller).mutation(api.accessCodes.mintAccessCode, MINT);
  await join(t, { code, nickname: "Thandi", pin: "1234" });

  await asUser(t, seller).mutation(api.accessCodes.stopCode, { accessCodeId });
  // Refused rather than ignored: a silent second stop looks to the Seller like it
  // worked, and "already billed" and "just billed" are different conversations with
  // the organisation. And there is no restart, because a restart would reopen a row
  // the operator may already have invoiced against.
  await expect(asUser(t, seller).mutation(api.accessCodes.stopCode, { accessCodeId })).rejects.toThrow();
  expect(await ledgerRows(t)).toHaveLength(1);
});

test("a stopped code grants no new seat, and existing seats keep working", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");
  const { accessCodeId, code } = await asUser(t, seller).mutation(api.accessCodes.mintAccessCode, MINT);
  await join(t, { code, nickname: "Thandi", pin: "1234" });
  await asUser(t, seller).mutation(api.accessCodes.stopCode, { accessCodeId });

  // Distinguishable from a full code and from a code that never existed: the reason
  // is the agreement, not the member's typing, and only one of the three is
  // something they can do anything about.
  expect(await tagOf(join(t, { code, nickname: "Sipho", pin: "5678" }))).toEqual("access/code-stopped");
  expect(await seatRows(t)).toHaveLength(1);
  expect(await entitlementRows(t)).toHaveLength(1);

  // **Stopping is not a revocation.** The seat already taken still signs in, and the
  // Entitlement was never touched: it carries no provenance, so nothing on this rail
  // could find it even if somebody tried.
  await expect(comeBack(t, { code, nickname: "Thandi", pin: "1234" })).resolves.toBeDefined();
});

test("only the minting Seller can stop or raise, and lowering below the seats taken is refused", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");
  const { seller: other } = await seedSeller(t, admin, "other@example.com", "urdu");
  const { accessCodeId, code } = await asUser(t, seller).mutation(api.accessCodes.mintAccessCode, MINT);
  await join(t, { code, nickname: "Thandi", pin: "1234" });
  await join(t, { code, nickname: "Sipho", pin: "5678" });

  // Server-side, not by which codes a page lists. A stop is a money event and a cap
  // raise is a bill increase, so both are things one Seller could do to another's
  // deal.
  await expect(asUser(t, other).mutation(api.accessCodes.stopCode, { accessCodeId })).rejects.toThrow();
  await expect(
    asUser(t, other).mutation(api.accessCodes.raiseCapacity, { accessCodeId, capacity: 500 }),
  ).rejects.toThrow();
  await expect(t.mutation(api.accessCodes.stopCode, { accessCodeId })).rejects.toThrow();

  // Raising works and lets the organisation carry on without a second code and a
  // split bill.
  await asUser(t, seller).mutation(api.accessCodes.raiseCapacity, { accessCodeId, capacity: 10 });
  expect((await t.run((ctx) => ctx.db.get(accessCodeId)))!.capacity).toEqual(10);
  // Down to the count is allowed - it stops new joins without ending the agreement.
  await asUser(t, seller).mutation(api.accessCodes.raiseCapacity, { accessCodeId, capacity: 2 });
  // Below it is not: those two seats exist, their Entitlements are permanent, and
  // nothing on this rail can find them to un-grant.
  await expect(
    asUser(t, seller).mutation(api.accessCodes.raiseCapacity, { accessCodeId, capacity: 1 }),
  ).rejects.toThrow();
  await expect(
    asUser(t, seller).mutation(api.accessCodes.raiseCapacity, { accessCodeId, capacity: 100000 }),
  ).rejects.toThrow();

  // And a stopped code has no meaningful cap.
  await asUser(t, seller).mutation(api.accessCodes.stopCode, { accessCodeId });
  await expect(
    asUser(t, seller).mutation(api.accessCodes.raiseCapacity, { accessCodeId, capacity: 50 }),
  ).rejects.toThrow();
});

// ---- The operator settles (ticket 07) ------------------------------------------

test("a stopped code appears on the operator's queue with everything an invoice needs", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");
  const { accessCodeId, code } = await asUser(t, seller).mutation(api.accessCodes.mintAccessCode, MINT);
  await join(t, { code, nickname: "Thandi", pin: "1234" });
  await join(t, { code, nickname: "Sipho", pin: "5678" });

  // A LIVE code is not on the queue: there is no bill yet, so it is not work waiting
  // on the operator.
  expect(await asUser(t, admin).query(api.accessCodes.pendingAccessCodes, {})).toEqual([]);
  await asUser(t, seller).mutation(api.accessCodes.stopCode, { accessCodeId });

  const queue = await asUser(t, admin).query(api.accessCodes.pendingAccessCodes, {});
  expect(queue).toHaveLength(1);
  expect(queue[0]).toMatchObject({
    accessCodeId,
    courseTitle: "hindi",
    lang: "en",
    sellerEmail: "author@example.com",
    orgName: "The Party",
    orgContact: "billing@party.example.org",
    seats: 2,
    pricePerSeat: 15000,
    total: 30000,
  });
  // **No code string, no nickname, no userId**, enforced in the returns validator
  // the way `pendingBatches` enforces "no codes". The money role and the selling
  // role are separated by what the query CAN say, so a later UI change cannot undo
  // it.
  const serialised = JSON.stringify(queue).toLowerCase();
  for (const leak of [code.toLowerCase(), "thandi", "sipho", "nickname", "userid"]) {
    expect(serialised).not.toContain(leak);
  }

  // Admin-only, server-side.
  await expect(asUser(t, seller).query(api.accessCodes.pendingAccessCodes, {})).rejects.toThrow();
  await expect(t.query(api.accessCodes.pendingAccessCodes, {})).rejects.toThrow();
});

test("logging the reference makes the Seller payable, and logging it twice is harmless", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");
  const { accessCodeId, code } = await asUser(t, seller).mutation(api.accessCodes.mintAccessCode, MINT);
  await join(t, { code, nickname: "Thandi", pin: "1234" });
  await asUser(t, seller).mutation(api.accessCodes.stopCode, { accessCodeId });

  await asUser(t, admin).mutation(api.accessCodes.logAccessCodePayment, { accessCodeId, reference: "FNB-8814" });

  // `unpaid` -> `owed` is the whole of "the Seller's share is payable now", and it
  // goes through the EXISTING payouts path with no change to it.
  const owed = await asUser(t, admin).query(api.ledger.owedPayouts, {});
  expect(owed).toHaveLength(1);
  expect(owed[0]).toMatchObject({ email: "author@example.com", totalOwed: 7500 });
  expect(owed[0]!.sales[0]).toMatchObject({ kind: "batch", buyerEmail: "billing@party.example.org" });

  // A second click is a no-op: it must never move a second row or overwrite the
  // reference that reconciles the statement line.
  await asUser(t, admin).mutation(api.accessCodes.logAccessCodePayment, { accessCodeId, reference: "TYPO-0000" });
  expect((await t.run((ctx) => ctx.db.get(accessCodeId)))!.paymentRef).toEqual("FNB-8814");
  expect(await ledgerRows(t)).toHaveLength(1);
  // Settled, so it leaves the queue. This is a to-do list, not a log.
  expect(await asUser(t, admin).query(api.accessCodes.pendingAccessCodes, {})).toEqual([]);

  // Admin-only, and nothing is due on a code that has not stopped.
  await expect(
    asUser(t, seller).mutation(api.accessCodes.logAccessCodePayment, { accessCodeId, reference: "X" }),
  ).rejects.toThrow();
  const live = await asUser(t, seller).mutation(api.accessCodes.mintAccessCode, MINT);
  await expect(
    asUser(t, admin).mutation(api.accessCodes.logAccessCodePayment, {
      accessCodeId: live.accessCodeId,
      reference: "TOO-SOON",
    }),
  ).rejects.toThrow();
});

// ---- Returning to a Seat (ticket 04) -------------------------------------------

test("returning lands in the same seat with the same entitlement and progress, and costs no seat", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller, topicId } = await seedSeller(t, admin, "author@example.com", "hindi");
  const { accessCodeId, code } = await asUser(t, seller).mutation(api.accessCodes.mintAccessCode, MINT);

  await join(t, { code, nickname: "Thandi", pin: "1234" });
  const [seat] = await seatRows(t);
  const member = seat!.userId!;
  // Progress written the way the reader writes it, so what is being asserted is the
  // member's real work and not a hand-seeded row.
  await asUser(t, member).mutation(api.capture.setProgress, {
    topicSlug: "hindi",
    lessonKey: "0001",
    status: "completed",
  });

  // A different phone: the same three things typed again, nothing else carried over.
  await comeBack(t, { code, nickname: "  thandi ", pin: "1234" });

  // **The same `users` row**, so the same Entitlement and the same progress. A second
  // row here is trap 1 wearing a different hat.
  const seats = await seatRows(t);
  expect(seats).toHaveLength(1);
  expect(seats[0]!.userId).toEqual(member);
  expect(await entitlementRows(t)).toHaveLength(1);
  const progress = await t.run((ctx) => ctx.db.query("progress").collect());
  expect(progress).toHaveLength(1);
  expect(progress[0]).toMatchObject({ userId: member, topicId, lessonKey: "0001", status: "completed" });

  // **Returning consumes no seat**, which is the assertion the whole bill rests on:
  // a member who switches phones twice must not cost the organisation three seats.
  const mine = await asUser(t, seller).query(api.accessCodes.myAccessCodes, {});
  expect(mine[0]).toMatchObject({ taken: 1, runningTotal: 15000 });
  expect(accessCodeId).toEqual(mine[0]!.accessCodeId);
});

test("a full code still admits an existing seat", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");
  const { code } = await asUser(t, seller).mutation(api.accessCodes.mintAccessCode, { ...MINT, capacity: 1 });
  await join(t, { code, nickname: "Thandi", pin: "1234" });

  // The cap is about NEW seats. A full code is full of seats that all still have to
  // work, or a member is locked out of a course by the success of the campaign that
  // gave it to them.
  expect(await tagOf(join(t, { code, nickname: "Sipho", pin: "5678" }))).toEqual("access/code-full");
  await expect(comeBack(t, { code, nickname: "Thandi", pin: "1234" })).resolves.toBeDefined();
});

test("failed PIN attempts are rate limited per seat, and the limit survives signing out", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");
  const { code } = await asUser(t, seller).mutation(api.accessCodes.mintAccessCode, MINT);
  await join(t, { code, nickname: "Thandi", pin: "1234" });
  await join(t, { code, nickname: "Sipho", pin: "5678" });

  // **Without this the credential is decorative.** A shared code plus a guessable
  // handle plus a four-digit PIN is 10,000 guesses, which is an afternoon for
  // anybody who was ever given the code - and that is everybody.
  const tags: string[] = [];
  for (let i = 0; i < 12; i++) {
    tags.push(await tagOf(comeBack(t, { code, nickname: "Thandi", pin: "0000" })));
  }
  expect(tags).toContain("access/pin-wrong");
  expect(tags).toContain("access/too-many-attempts");
  // The right PIN is refused too while the limit holds: a limit that the real member
  // can walk past is a limit an attacker can walk past.
  expect(await tagOf(comeBack(t, { code, nickname: "Thandi", pin: "1234" }))).toEqual("access/too-many-attempts");

  // **Per `(accessCodeId, nicknameKey)`**, so one member being attacked never locks
  // the rest of the organisation out of their own course.
  await expect(comeBack(t, { code, nickname: "Sipho", pin: "5678" })).resolves.toBeDefined();
});

// ---- Changing a PIN (ticket 10) --------------------------------------------------

test("a Seat can change its PIN with the old one, and the old one stops working", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller, topicId } = await seedSeller(t, admin, "author@example.com", "hindi");
  const { code } = await asUser(t, seller).mutation(api.accessCodes.mintAccessCode, MINT);
  await join(t, { code, nickname: "Thandi", pin: "1234" });
  const [seat] = await seatRows(t);
  const member = seat!.userId!;
  await asUser(t, member).mutation(api.capture.setProgress, {
    topicSlug: "hindi",
    lessonKey: "0001",
    status: "completed",
  });

  // The wrong old PIN is refused: the only thing that proves a caller owns a Seat is
  // the PIN, so a change that skips it is a takeover, and on this rail there is no
  // email to send a warning to afterwards.
  expect(
    await tagOf(asUser(t, member).action(api.accessCodeAuth.changePin, { oldPin: "0000", newPin: "5678" })),
  ).toEqual("access/pin-wrong");

  await asUser(t, member).action(api.accessCodeAuth.changePin, { oldPin: "1234", newPin: "998877" });

  // Immediately: the new PIN works and the old one does not.
  expect(await tagOf(comeBack(t, { code, nickname: "Thandi", pin: "1234" }))).toEqual("access/pin-wrong");
  await expect(comeBack(t, { code, nickname: "Thandi", pin: "998877" })).resolves.toBeDefined();

  // **The Seat, its Entitlement and its progress are untouched**, asserted on the
  // key sets rather than on a count: a PIN change happens in `authAccounts`, and
  // anything it moved in `seats` or `entitlements` would be a bug hiding as a
  // convenience.
  const after = await seatRows(t);
  expect(after).toHaveLength(1);
  expect(after[0]).toMatchObject({ userId: member, nicknameKey: "thandi", consentVersion: CONSENT });
  expect(after[0]!.consentedAt).toEqual(seat!.consentedAt);
  const held = await entitlementRows(t);
  expect(held).toHaveLength(1);
  expect(Object.keys(held[0]!).sort()).toEqual(["_creationTime", "_id", "lang", "topicId", "userId"]);
  const progress = await t.run((ctx) => ctx.db.query("progress").collect());
  expect(progress[0]).toMatchObject({ userId: member, topicId, status: "completed" });
});

test("nobody without a Seat can change a PIN, and the change shares sign-in's rate limit", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");
  const { code } = await asUser(t, seller).mutation(api.accessCodes.mintAccessCode, MINT);
  await join(t, { code, nickname: "Thandi", pin: "1234" });
  const [seat] = await seatRows(t);
  const ordinary = await seedUser(t, "ordinary@example.com");

  // Asserted server-side, not by which control a page renders: a Guest and an
  // ordinary email-and-password account both hold no Seat, so there is no PIN of
  // theirs to change and no argument by which they could name somebody else's.
  await expect(t.action(api.accessCodeAuth.changePin, { oldPin: "1234", newPin: "5678" })).rejects.toThrow();
  await expect(
    asUser(t, ordinary).action(api.accessCodeAuth.changePin, { oldPin: "1234", newPin: "5678" }),
  ).rejects.toThrow();
  expect(await asUser(t, ordinary).query(api.accessCodes.mySeat, {})).toBeNull();
  expect(await t.query(api.accessCodes.mySeat, {})).toBeNull();

  // **Not a way around ticket 04's limit.** The old-PIN check goes through
  // `retrieveAccount`, where the library's per-account limiter lives, so guessing
  // here costs what guessing at the sign-in box costs.
  const tags: string[] = [];
  for (let i = 0; i < 12; i++) {
    tags.push(
      await tagOf(asUser(t, seat!.userId!).action(api.accessCodeAuth.changePin, { oldPin: "0000", newPin: "5678" })),
    );
  }
  expect(tags).toContain("access/too-many-attempts");
  // And the limit is shared with sign-in rather than being a second counter beside it.
  expect(await tagOf(comeBack(t, { code, nickname: "Thandi", pin: "1234" }))).toEqual("access/too-many-attempts");

  // A short PIN is refused rather than accepted and then unusable.
  await expect(
    asUser(t, seat!.userId!).action(api.accessCodeAuth.changePin, { oldPin: "1234", newPin: "12" }),
  ).rejects.toThrow();
});

// ---- Deleting a Seat (ticket 11) --------------------------------------------------

test("a member deletes their Seat: the link goes, the count stays, the credential dies", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");
  const { accessCodeId, code } = await asUser(t, seller).mutation(api.accessCodes.mintAccessCode, MINT);
  await join(t, { code, nickname: "Thandi", pin: "1234" });
  await join(t, { code, nickname: "Sipho", pin: "5678" });
  const before = await asUser(t, seller).query(api.accessCodes.myAccessCodes, {});
  expect(before[0]).toMatchObject({ taken: 2, runningTotal: 30000 });

  const seat = (await seatRows(t)).find((s) => s.nicknameKey === "thandi");
  const member = seat!.userId!;
  expect(await asUser(t, member).query(api.accessCodes.mySeat, {})).toMatchObject({
    accessCodeId,
    nickname: "thandi",
    orgName: "The Party",
    courseTitle: "hindi",
    consentVersion: CONSENT,
  });

  await asUser(t, member).mutation(api.accessCodes.deleteMySeat, {});

  // **The link is gone**: no nickname, no user id, nothing tying a person to the
  // organisation's cohort. That row is the only place the link ever existed.
  const rows = await seatRows(t);
  expect(rows).toHaveLength(2);
  const stripped = rows.find((r) => r.nicknameKey === undefined);
  expect(stripped).toBeDefined();
  expect(stripped).not.toHaveProperty("userId");
  expect(stripped).not.toHaveProperty("nicknameKey");
  expect(Object.keys(stripped!).sort()).toEqual([
    "_creationTime",
    "_id",
    "accessCodeId",
    "consentVersion",
    "consentedAt",
  ]);

  // **The seat count does NOT move**, which is the real design question in this
  // ticket. The bill is for seats consumed during the agreement and this member did
  // consume one; a decrement would let a member reduce an invoice the organisation
  // already agreed to, and change a number under an operator who may have raised it.
  const after = await asUser(t, seller).query(api.accessCodes.myAccessCodes, {});
  expect(after[0]).toMatchObject({ taken: 2, runningTotal: 30000 });
  await asUser(t, seller).mutation(api.accessCodes.stopCode, { accessCodeId });
  expect((await ledgerRows(t))[0]).toMatchObject({ gross: 30000, status: "unpaid" });

  // **The credential stops working immediately.** The `authAccounts` row had to go:
  // its `providerAccountId` is `${accessCodeId}:${nicknameKey}`, so leaving it would
  // leave the nickname and the link in plain text.
  expect(await tagOf(comeBack(t, { code, nickname: "Thandi", pin: "1234" }))).toEqual("access/pin-wrong");
  expect(await asUser(t, member).query(api.accessCodes.mySeat, {})).toBeNull();

  // **The Entitlement is left alone.** The honest consequence, stated in the
  // confirm copy: the member keeps the course on the device they are holding for as
  // long as their session lasts, and cannot sign in again anywhere else, because the
  // credential IS the personal link.
  const held = await entitlementRows(t);
  expect(held).toHaveLength(2);
  expect(held.some((e) => e.userId === member)).toBe(true);

  // A second click is harmless.
  await asUser(t, member).mutation(api.accessCodes.deleteMySeat, {});
  expect(await seatRows(t)).toHaveLength(2);
});

test("a deleted Seat frees its nickname, and reclaiming it consumes a new seat", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedSysAdmin(t, "admin@example.com");
  const { seller } = await seedSeller(t, admin, "author@example.com", "hindi");
  const { code } = await asUser(t, seller).mutation(api.accessCodes.mintAccessCode, MINT);
  await join(t, { code, nickname: "Thandi", pin: "1234" });
  const seat = (await seatRows(t))[0]!;
  await asUser(t, seat.userId!).mutation(api.accessCodes.deleteMySeat, {});

  // **Reuse, not retirement**, and the reasoning is the whole choice: retiring the
  // nickname permanently means keeping the handle in a tombstone, and a kept handle
  // is arguably still a record of the person who asked to be forgotten. The cost is
  // that a stranger can claim a departed member's handle, which is affordable
  // precisely because the handle was never a real name.
  await join(t, { code, nickname: "Thandi", pin: "9999" });

  // And it costs a NEW seat. That is correct rather than harsh: this is a different
  // person taking a place, and the departed member's place was consumed during the
  // agreement.
  const mine = await asUser(t, seller).query(api.accessCodes.myAccessCodes, {});
  expect(mine[0]).toMatchObject({ taken: 2, runningTotal: 30000 });
  // The newcomer's PIN is theirs, and the departed member's does not reach it.
  await expect(comeBack(t, { code, nickname: "Thandi", pin: "9999" })).resolves.toBeDefined();
  expect(await tagOf(comeBack(t, { code, nickname: "Thandi", pin: "1234" }))).toEqual("access/pin-wrong");
});
