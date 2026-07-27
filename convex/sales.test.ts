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

test("filters by the sale timestamp; all-time returns everything", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");
  const author = await seedUser(t, "author@example.com");
  const topicId = await t.run((ctx) =>
    ctx.db.insert("topics", { ownerId: author, slug: "hindi", title: "Hindi", status: "completed" as const }),
  );

  // convex-test freezes the clock, so both sales share one creation time `at`.
  // That's enough to pin down the boundary semantics: from is inclusive, to is
  // exclusive.
  const first = await seedSale(t, { topicId, sellerId: author, lang: "en", gross: 10000, pf: "s1" });
  await seedSale(t, { topicId, sellerId: author, lang: "en", gross: 20000, pf: "s2" });
  const at = (await t.run((ctx) => ctx.db.get(first)))!._creationTime;

  // All time: both sales.
  const all = await asUser(t, admin).query(api.sales.report, {});
  expect(all[0]).toMatchObject({ gross: 30000, count: 2 });

  // from is inclusive: `at` keeps both, `at + 1` drops both.
  expect((await asUser(t, admin).query(api.sales.report, { from: at }))[0]).toMatchObject({ gross: 30000, count: 2 });
  expect(await asUser(t, admin).query(api.sales.report, { from: at + 1 })).toEqual([]);

  // to is exclusive: `at` drops both, `at + 1` keeps both.
  expect(await asUser(t, admin).query(api.sales.report, { to: at })).toEqual([]);
  expect((await asUser(t, admin).query(api.sales.report, { to: at + 1 }))[0]).toMatchObject({
    gross: 30000,
    count: 2,
  });
});
