/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

// The manual EFT rail (ywampotch-launch ticket 02): the **operator's collection**
// bank account. Two seams:
//   1. `operatorBank` / `saveOperatorBank` — the sys-admin editor. Sys admin only:
//      a tenant admin must not be able to change where the platform's money is
//      collected, so the authorisation negative is asserted server-side, not by
//      the absence of a button.
//   2. `eftDetails` — the buyer-facing read on the paygate. Returns the details
//      only while the rail is `enabled`, and only to a signed-in caller.
// Fixtures seed only what production writes: `users` rows as auth writes them and
// `whitelist` rows as `whitelist.seedEmail`/`scopeToTenant` write them (a sys
// admin is `isAdmin` with no slug; a tenant admin is `isAdmin` + a slug). The
// operatorBank row is never hand-seeded — every test writes it through the
// mutation, which is the only thing that ever creates it.

const modules = import.meta.glob("./**/*.ts");

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
async function seedTenantAdmin(t: ReturnType<typeof convexTest>, email: string, tenantSlug: string) {
  const id = await seedUser(t, email);
  await t.run((ctx) => ctx.db.insert("whitelist", { email, isAdmin: true, tenantSlug }));
  return id;
}

const BANK = {
  accountHolder: "YWAM Potch",
  bank: "FNB",
  accountNumber: "62000000001",
  branchCode: "250655",
};

// ---- Seam — the sys-admin editor --------------------------------------------

test("only a sys admin can write the operator's collection account", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedSysAdmin(t, "admin@example.com");
  const tenantAdmin = await seedTenantAdmin(t, "potch@example.com", "ywampotch");
  const member = await seedUser(t, "learner@example.com");

  // A tenant admin is the important negative: they administer a subdomain, but
  // not where the platform's money lands.
  await expect(
    asUser(t, tenantAdmin).mutation(api.eft.saveOperatorBank, { ...BANK, enabled: true }),
  ).rejects.toThrow();
  await expect(
    asUser(t, member).mutation(api.eft.saveOperatorBank, { ...BANK, enabled: true }),
  ).rejects.toThrow();
  await expect(t.mutation(api.eft.saveOperatorBank, { ...BANK, enabled: true })).rejects.toThrow();

  // Nothing was written by any of the refusals.
  expect(await asUser(t, sys).query(api.eft.operatorBank, {})).toBeNull();

  // The sys admin can, and reads it back.
  await asUser(t, sys).mutation(api.eft.saveOperatorBank, { ...BANK, enabled: true });
  expect(await asUser(t, sys).query(api.eft.operatorBank, {})).toEqual({ ...BANK, enabled: true });
});

test("only a sys admin can read the editor's view of the account", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedSysAdmin(t, "admin@example.com");
  const tenantAdmin = await seedTenantAdmin(t, "potch@example.com", "ywampotch");
  await asUser(t, sys).mutation(api.eft.saveOperatorBank, { ...BANK, enabled: true });

  await expect(asUser(t, tenantAdmin).query(api.eft.operatorBank, {})).rejects.toThrow();
  await expect(t.query(api.eft.operatorBank, {})).rejects.toThrow();
});

test("saving edits the one row in place — never a second account", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedSysAdmin(t, "admin@example.com");

  await asUser(t, sys).mutation(api.eft.saveOperatorBank, { ...BANK, enabled: true });
  await asUser(t, sys).mutation(api.eft.saveOperatorBank, {
    ...BANK,
    accountNumber: "62999999999",
    enabled: false,
  });

  const rows = await t.run((ctx) => ctx.db.query("operatorBank").collect());
  expect(rows).toHaveLength(1);
  expect(await asUser(t, sys).query(api.eft.operatorBank, {})).toEqual({
    ...BANK,
    accountNumber: "62999999999",
    enabled: false,
  });
});

test("saveOperatorBank rejects blank or non-numeric fields", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedSysAdmin(t, "admin@example.com");

  for (const bad of [
    { ...BANK, accountHolder: "   " },
    { ...BANK, bank: "" },
    { ...BANK, accountNumber: "not-digits" },
    { ...BANK, branchCode: "12ab" },
  ]) {
    await expect(
      asUser(t, sys).mutation(api.eft.saveOperatorBank, { ...bad, enabled: true }),
    ).rejects.toThrow();
  }
  expect(await asUser(t, sys).query(api.eft.operatorBank, {})).toBeNull();
});

// ---- Seam — the buyer-facing read -------------------------------------------

test("the buyer read returns the details only while the rail is enabled", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedSysAdmin(t, "admin@example.com");
  const buyer = await seedUser(t, "buyer@example.com");

  // Unconfigured rail → nothing to show (no row at all).
  expect(await asUser(t, buyer).query(api.eft.eftDetails, {})).toBeNull();

  // Configured but switched off → still nothing: the toggle is the rail's off switch.
  await asUser(t, sys).mutation(api.eft.saveOperatorBank, { ...BANK, enabled: false });
  expect(await asUser(t, buyer).query(api.eft.eftDetails, {})).toBeNull();

  // Enabled → a signed-in buyer sees the account to pay into.
  await asUser(t, sys).mutation(api.eft.saveOperatorBank, { ...BANK, enabled: true });
  expect(await asUser(t, buyer).query(api.eft.eftDetails, {})).toEqual(BANK);
});

test("the buyer read is signed-in only — an anonymous visitor gets nothing", async () => {
  const t = convexTest(schema, modules);
  const sys = await seedSysAdmin(t, "admin@example.com");
  await asUser(t, sys).mutation(api.eft.saveOperatorBank, { ...BANK, enabled: true });

  // Checkout is auth-first (.scratch/auth-first-checkout), so the paygate always
  // has an account behind it — an anonymous read has no reason to see the account.
  expect(await t.query(api.eft.eftDetails, {})).toBeNull();
});
