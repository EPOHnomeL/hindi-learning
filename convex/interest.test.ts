/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { isDeliverableShape, MAX_EMAIL_LENGTH } from "./interest";
import type { Id } from "./_generated/dataModel";

// The **interest list** (ADR 0028) — the landing pages' second conversion, and the
// only PUBLIC MUTATION in the codebase. The things that must hold, because this is
// the one write an anonymous stranger on the internet can reach:
//   1. it grants NOTHING — no user, no entitlement, only a row on a marketing list;
//   2. it cannot accrue rows — a repeat submit patches, so hammering it is bounded;
//   3. `source` is a closed set, so the attribution number stays trustworthy;
//   4. nothing unauthenticated can read the list back out.

const modules = import.meta.glob("./**/*.ts");

function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}

async function seedAdmin(t: ReturnType<typeof convexTest>, email: string, tenantSlug?: string) {
  const id = await t.run((ctx) => ctx.db.insert("users", { email }));
  await t.run((ctx) => ctx.db.insert("whitelist", { email, isAdmin: true, ...(tenantSlug ? { tenantSlug } : {}) }));
  return id;
}

async function leads(t: ReturnType<typeof convexTest>) {
  return await t.run((ctx) => ctx.db.query("interestLeads").take(100));
}

test("an anonymous visitor can register interest, and it grants nothing", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.interest.register, {
    email: "stranger@example.com",
    tenantSlug: "default",
    source: "landing-footer",
  });

  const rows = await leads(t);
  expect(rows).toMatchObject([
    { email: "stranger@example.com", tenantSlug: "default", source: "landing-footer", submissions: 1 },
  ]);
  // The whole point: a lead is not an account and not an entitlement.
  expect(await t.run((ctx) => ctx.db.query("users").take(10))).toEqual([]);
  expect(await t.run((ctx) => ctx.db.query("entitlements").take(10))).toEqual([]);
});

test("the address is normalised, so casing and whitespace can't split one person into two rows", async () => {
  const t = convexTest(schema, modules);
  for (const email of ["Asha@Example.com", "  asha@example.com  ", "ASHA@EXAMPLE.COM"]) {
    await t.mutation(api.interest.register, { email, tenantSlug: "default", source: "landing-footer" });
  }
  const rows = await leads(t);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ email: "asha@example.com", submissions: 3 });
});

test("a repeat submit patches instead of inserting, so the table can't be grown by hammering", async () => {
  const t = convexTest(schema, modules);
  for (let i = 0; i < 25; i++) {
    await t.mutation(api.interest.register, {
      email: "keen@example.com",
      tenantSlug: "default",
      source: "landing-footer",
    });
  }
  const rows = await leads(t);
  expect(rows).toHaveLength(1);
  expect(rows[0]!.submissions).toBe(25);
});

test("the latest CTA wins on a re-submit — it's the ask that made them try again", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.interest.register, {
    email: "keen@example.com",
    tenantSlug: "default",
    source: "landing-hero",
  });
  await t.mutation(api.interest.register, {
    email: "keen@example.com",
    tenantSlug: "default",
    source: "landing-footer",
  });
  expect((await leads(t))[0]).toMatchObject({ source: "landing-footer", submissions: 2 });
});

test("the same address on two tenants is two leads — a ministry's list is its own", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.interest.register, {
    email: "asha@example.com",
    tenantSlug: "default",
    source: "landing-footer",
  });
  await t.mutation(api.interest.register, {
    email: "asha@example.com",
    tenantSlug: "ywampotch",
    source: "ywampotch-footer",
  });
  expect(await leads(t)).toHaveLength(2);
});

test("an undeliverable address is refused server-side, not just in the form", async () => {
  const t = convexTest(schema, modules);
  for (const email of ["nope", "no@domain", "two@at@signs.com", "@example.com", "has space@example.com", ""]) {
    await expect(
      t.mutation(api.interest.register, { email, tenantSlug: "default", source: "landing-footer" }),
    ).rejects.toThrow(/valid email/);
  }
  expect(await leads(t)).toEqual([]);
});

test("an over-long address is refused rather than truncated into someone else's mailbox", async () => {
  const t = convexTest(schema, modules);
  const email = `${"a".repeat(MAX_EMAIL_LENGTH)}@example.com`;
  expect(isDeliverableShape(email)).toBe(false);
  await expect(
    t.mutation(api.interest.register, { email, tenantSlug: "default", source: "landing-footer" }),
  ).rejects.toThrow(/valid email/);
});

test("an unplanned `source` is refused by the validator, so the attribution number stays trustworthy", async () => {
  const t = convexTest(schema, modules);
  await expect(
    // @ts-expect-error — the closed set is the point: this must not compile either.
    t.mutation(api.interest.register, { email: "a@example.com", tenantSlug: "default", source: "twitter-bio" }),
  ).rejects.toThrow();
  expect(await leads(t)).toEqual([]);
});

test("nothing unauthenticated can read the list back out", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.interest.register, {
    email: "stranger@example.com",
    tenantSlug: "default",
    source: "landing-footer",
  });
  await expect(t.query(api.interest.listLeads, { tenantSlug: "default" })).rejects.toThrow(/forbidden/);
});

test("a sys admin reads any tenant's list; a tenant admin reads only their own", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.interest.register, {
    email: "a@example.com",
    tenantSlug: "ywampotch",
    source: "ywampotch-footer",
  });

  const sys = await seedAdmin(t, "sys@example.com");
  expect(await asUser(t, sys).query(api.interest.listLeads, { tenantSlug: "ywampotch" })).toMatchObject([
    { email: "a@example.com", source: "ywampotch-footer", submissions: 1 },
  ]);

  const tenantAdmin = await seedAdmin(t, "potch@example.com", "ywampotch");
  expect(await asUser(t, tenantAdmin).query(api.interest.listLeads, { tenantSlug: "ywampotch" })).toHaveLength(1);
  // ...but not the platform's list.
  await expect(asUser(t, tenantAdmin).query(api.interest.listLeads, { tenantSlug: "default" })).rejects.toThrow(
    /forbidden/,
  );
});

test("the read is row-shaped, so a future field on the table can't leak by accident", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.interest.register, {
    email: "a@example.com",
    tenantSlug: "default",
    source: "landing-footer",
  });
  const sys = await seedAdmin(t, "sys@example.com");
  const rows = await asUser(t, sys).query(api.interest.listLeads, { tenantSlug: "default" });
  expect(Object.keys(rows[0]!).sort()).toEqual(["email", "lastSubmittedAt", "source", "submissions"]);
});
