/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

// The admin sales report (.scratch/admin-sales, issue 01): the operator sees
// which courses and which editions sold how much over a chosen period. Groups
// ALL ledger rows (owed + paid) by course, then by edition, summing gross and
// counting sales. Admin-only.

const modules = import.meta.glob("./**/*.ts");

function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}
async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}
async function seedAdmin(t: ReturnType<typeof convexTest>, email: string) {
  const id = await t.run((ctx) => ctx.db.insert("users", { email }));
  await t.run((ctx) => ctx.db.insert("whitelist", { email, isAdmin: true }));
  return id;
}

// One ledger sale. `gross` drives the report; the split fields are irrelevant to
// it but kept realistic. `status` defaults to "owed" but can be "paid".
async function seedSale(
  t: ReturnType<typeof convexTest>,
  opts: {
    topicId: Id<"topics">;
    sellerId: Id<"users">;
    lang: string;
    gross: number;
    pf: string;
    status?: "owed" | "paid";
  },
) {
  return await t.run((ctx) =>
    ctx.db.insert("ledger", {
      topicId: opts.topicId,
      lang: opts.lang,
      sellerId: opts.sellerId,
      buyerEmail: `${opts.pf}@example.com`,
      gross: opts.gross,
      fee: 0,
      net: opts.gross,
      sellerShare: Math.round(opts.gross / 2),
      platformShare: opts.gross - Math.round(opts.gross / 2),
      pfPaymentId: opts.pf,
      status: opts.status ?? "owed",
    }),
  );
}

test("report is Admin-only", async () => {
  const t = convexTest(schema, modules);
  const user = await seedUser(t, "u@example.com");
  await expect(asUser(t, user).query(api.sales.report, {})).rejects.toThrow();
  // Unauthenticated too.
  await expect(t.query(api.sales.report, {})).rejects.toThrow();
});

test("groups by course then edition, sums gross and counts, owed + paid both counted", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");
  const author = await seedUser(t, "author@example.com");

  const hindi = await t.run((ctx) =>
    ctx.db.insert("topics", { ownerId: author, slug: "hindi", title: "Hindi", status: "completed" as const }),
  );
  const tamil = await t.run((ctx) =>
    ctx.db.insert("topics", { ownerId: author, slug: "tamil", title: "Tamil", status: "completed" as const }),
  );
  // A translated edition title for Hindi / es.
  await t.run((ctx) =>
    ctx.db.insert("translations", {
      topicId: hindi,
      lang: "es",
      kind: "title" as const,
      key: "",
      text: "Hindi (español)",
      sourceHash: "h",
    }),
  );

  // Hindi: two en sales (owed + paid) + one es sale. Tamil: one en sale.
  await seedSale(t, { topicId: hindi, sellerId: author, lang: "en", gross: 10000, pf: "h1", status: "owed" });
  await seedSale(t, { topicId: hindi, sellerId: author, lang: "en", gross: 20000, pf: "h2", status: "paid" });
  await seedSale(t, { topicId: hindi, sellerId: author, lang: "es", gross: 5000, pf: "h3", status: "owed" });
  await seedSale(t, { topicId: tamil, sellerId: author, lang: "en", gross: 7000, pf: "t1", status: "paid" });

  const report = await asUser(t, admin).query(api.sales.report, {});

  // Courses sorted by gross desc: Hindi (35000) before Tamil (7000).
  expect(report.map((c) => c.courseTitle)).toEqual(["Hindi", "Tamil"]);

  const hindiRow = report[0]!;
  expect(hindiRow).toMatchObject({ topicId: hindi, courseTitle: "Hindi", gross: 35000, count: 3 });
  // Editions sorted by gross desc: en (30000) before es (5000).
  expect(hindiRow.editions).toEqual([
    { lang: "en", title: "Hindi", gross: 30000, count: 2 },
    { lang: "es", title: "Hindi (español)", gross: 5000, count: 1 },
  ]);

  const tamilRow = report[1]!;
  expect(tamilRow).toMatchObject({ topicId: tamil, gross: 7000, count: 1 });
  expect(tamilRow.editions).toEqual([{ lang: "en", title: "Tamil", gross: 7000, count: 1 }]);
});

test("byDay is Admin-only", async () => {
  const t = convexTest(schema, modules);
  const user = await seedUser(t, "u@example.com");
  await expect(asUser(t, user).query(api.sales.byDay, {})).rejects.toThrow();
  await expect(t.query(api.sales.byDay, {})).rejects.toThrow();
});

test("byDay buckets the window by day and splits each day by edition", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");
  const author = await seedUser(t, "author@example.com");
  const topicId = await t.run((ctx) =>
    ctx.db.insert("topics", { ownerId: author, slug: "hindi", title: "Hindi", status: "completed" as const }),
  );

  // convex-test freezes the clock, so every sale lands in the same day bucket.
  await seedSale(t, { topicId, sellerId: author, lang: "en", gross: 10000, pf: "s1" });
  await seedSale(t, { topicId, sellerId: author, lang: "en", gross: 20000, pf: "s2", status: "paid" });
  const third = await seedSale(t, { topicId, sellerId: author, lang: "af", gross: 5000, pf: "s3" });
  const at = (await t.run((ctx) => ctx.db.get(third)))!._creationTime;

  const DAY = 86_400_000;
  const today = Math.floor(at / DAY) * DAY;

  const days = await asUser(t, admin).query(api.sales.byDay, {});
  const sold = days.find((d) => d.dayMs === today)!;
  expect(sold).toMatchObject({ count: 3, gross: 35000 });
  expect([...sold.editions].sort((a, b) => a.lang.localeCompare(b.lang))).toEqual([
    { lang: "af", count: 1, gross: 5000 },
    { lang: "en", count: 2, gross: 30000 },
  ]);

  // An empty window is an empty axis, not a row of zeroes.
  expect(await asUser(t, admin).query(api.sales.byDay, { to: today })).toEqual([]);
});

test("byDay returns every day in the window, sales or not, and honours the bounds", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");
  const author = await seedUser(t, "author@example.com");
  const topicId = await t.run((ctx) =>
    ctx.db.insert("topics", { ownerId: author, slug: "hindi", title: "Hindi", status: "completed" as const }),
  );
  const sale = await seedSale(t, { topicId, sellerId: author, lang: "en", gross: 10000, pf: "s1" });
  const at = (await t.run((ctx) => ctx.db.get(sale)))!._creationTime;

  const DAY = 86_400_000;
  const today = Math.floor(at / DAY);

  // A 7-day window ending today: 7 buckets, only the last one with a sale, so
  // the chart draws a real timeline with visible gaps.
  const week = await asUser(t, admin).query(api.sales.byDay, { from: (today - 6) * DAY });
  expect(week.length).toBe(7);
  expect(week.map((d) => d.dayMs)).toEqual([...Array(7).keys()].map((i) => (today - 6 + i) * DAY));
  expect(week.slice(0, 6).every((d) => d.count === 0 && d.editions.length === 0)).toBe(true);
  expect(week.at(-1)).toMatchObject({ count: 1, gross: 10000 });

  // A bounded window stops at its last sale rather than padding trailing days.
  const bounded = await asUser(t, admin).query(api.sales.byDay, { from: (today - 1) * DAY, to: (today + 5) * DAY });
  expect(bounded.map((d) => d.dayMs)).toEqual([(today - 1) * DAY, today * DAY]);
});

test("filters by the sale timestamp; all-time returns everything", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");
  const author = await seedUser(t, "author@example.com");
  const topicId = await t.run((ctx) =>
    ctx.db.insert("topics", { ownerId: author, slug: "hindi", title: "Hindi", status: "completed" as const }),
  );

  // The two sales bracket the window under test. They USUALLY land on the same
  // millisecond, but not always — convex-test does not freeze the clock (an
  // earlier version of this test assumed it did, and flaked under a loaded full
  // suite run), so the bounds are taken from the real first and last rows.
  const first = await seedSale(t, { topicId, sellerId: author, lang: "en", gross: 10000, pf: "s1" });
  const second = await seedSale(t, { topicId, sellerId: author, lang: "en", gross: 20000, pf: "s2" });
  const at = (await t.run((ctx) => ctx.db.get(first)))!._creationTime;
  const last = (await t.run((ctx) => ctx.db.get(second)))!._creationTime;

  // All time: both sales.
  const all = await asUser(t, admin).query(api.sales.report, {});
  expect(all[0]).toMatchObject({ gross: 30000, count: 2 });

  // from is inclusive: the first sale's own time keeps both; past the last drops both.
  expect((await asUser(t, admin).query(api.sales.report, { from: at }))[0]).toMatchObject({ gross: 30000, count: 2 });
  expect(await asUser(t, admin).query(api.sales.report, { from: last + 1 })).toEqual([]);

  // to is exclusive: the first sale's own time drops both; past the last keeps both.
  expect(await asUser(t, admin).query(api.sales.report, { to: at })).toEqual([]);
  expect((await asUser(t, admin).query(api.sales.report, { to: last + 1 }))[0]).toMatchObject({
    gross: 30000,
    count: 2,
  });
});

// A Voucher Batch's money event must NOT reach the sales report (vouchers ticket 01,
// ADR 0029). A batch row carries a topicId and a lang, so the old "not a donation"
// predicate would have admitted it - and an `unpaid` batch is money that has not
// arrived, so the report would have overstated revenue the moment batches shipped.
// This is the allow-list `salesOnly`'s own comment asked for.
test("a voucher batch row is excluded from the sales report", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");
  const author = await seedUser(t, "author@example.com");
  const hindi = await t.run((ctx) =>
    ctx.db.insert("topics", { ownerId: author, slug: "hindi", title: "Hindi", status: "completed" as const }),
  );

  // One ordinary sale, and one batch for the same Edition at ten times the money.
  await seedSale(t, { topicId: hindi, sellerId: author, lang: "en", gross: 10000, pf: "h1" });
  await t.run((ctx) =>
    ctx.db.insert("ledger", {
      topicId: hindi,
      lang: "en",
      sellerId: author,
      buyerEmail: "billing@party.example.org",
      gross: 100000,
      fee: 0,
      net: 100000,
      sellerShare: 50000,
      platformShare: 50000,
      kind: "batch" as const,
      status: "unpaid" as const,
    }),
  );

  const report = await asUser(t, admin).query(api.sales.report, {});
  // Only the real sale counts - the batch's 100000 is absent, not folded in.
  expect(report).toHaveLength(1);
  expect(report[0]).toMatchObject({ topicId: hindi, gross: 10000, count: 1 });
  expect(report[0]!.editions).toEqual([{ lang: "en", title: "Hindi", gross: 10000, count: 1 }]);
});
