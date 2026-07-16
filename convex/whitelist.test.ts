/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

// `userId|session` is the subject shape Convex Auth's getAuthUserId parses back.
function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}

async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}

// A signed-in Admin: a user account plus their Admin row in the Allowlist.
async function seedAdmin(t: ReturnType<typeof convexTest>, email: string) {
  const userId = await seedUser(t, email);
  await t.mutation(internal.whitelist.seedEmail, { email, isAdmin: true });
  return userId;
}

// The Allowlist is closed by default: an empty table admits nobody. This is the
// single membership decision the course-creation gate and the tests share.
test("isAdmitted: an empty Allowlist admits nobody", async () => {
  const t = convexTest(schema, modules);
  expect(await t.query(internal.whitelist.isAdmitted, { email: "anyone@example.com" })).toBe(false);
});

test("isAdmitted: a seeded email is admitted, and not after removal", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.whitelist.seedEmail, { email: "learner@example.com" });
  expect(await t.query(internal.whitelist.isAdmitted, { email: "learner@example.com" })).toBe(true);

  // Drop the row directly (removeEmail's authz is exercised separately) — the
  // decision must flip back to closed for that email.
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query("whitelist")
      .withIndex("by_email", (q) => q.eq("email", "learner@example.com"))
      .unique();
    if (row) await ctx.db.delete(row._id);
  });
  expect(await t.query(internal.whitelist.isAdmitted, { email: "learner@example.com" })).toBe(false);
});

test("isAdmitted: matches case-insensitively and ignores surrounding whitespace", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.whitelist.seedEmail, { email: "Learner@Example.com" });
  expect(await t.query(internal.whitelist.isAdmitted, { email: "  LEARNER@EXAMPLE.COM  " })).toBe(true);
});

test("addEmail: the Admin admits an email, normalised, and re-adding is a no-op", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "jvorster63@gmail.com");

  await asUser(t, admin).mutation(api.whitelist.addEmail, { email: "  New.Learner@Example.com " });
  expect(await t.query(internal.whitelist.isAdmitted, { email: "new.learner@example.com" })).toBe(true);

  // Re-adding the same email (any casing) must not throw nor duplicate the row.
  await asUser(t, admin).mutation(api.whitelist.addEmail, { email: "new.learner@example.com" });
  const rows = await t.run((ctx) =>
    ctx.db.query("whitelist").withIndex("by_email", (q) => q.eq("email", "new.learner@example.com")).collect(),
  );
  expect(rows).toHaveLength(1);
});

test("addEmail: obviously malformed input is rejected", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "jvorster63@gmail.com");
  await expect(asUser(t, admin).mutation(api.whitelist.addEmail, { email: "not-an-email" })).rejects.toThrow();
});

test("addEmail: a non-Admin caller is rejected", async () => {
  const t = convexTest(schema, modules);
  await seedAdmin(t, "jvorster63@gmail.com");
  const intruder = await seedUser(t, "intruder@example.com");
  await expect(
    asUser(t, intruder).mutation(api.whitelist.addEmail, { email: "sneaky@example.com" }),
  ).rejects.toThrow();
  // And nothing was admitted.
  expect(await t.query(internal.whitelist.isAdmitted, { email: "sneaky@example.com" })).toBe(false);
});

test("removeEmail: the Admin removes an ordinary email", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "jvorster63@gmail.com");
  await asUser(t, admin).mutation(api.whitelist.addEmail, { email: "learner@example.com" });

  await asUser(t, admin).mutation(api.whitelist.removeEmail, { email: "learner@example.com" });
  expect(await t.query(internal.whitelist.isAdmitted, { email: "learner@example.com" })).toBe(false);
});

test("removeEmail: refuses to remove the Admin's own row", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "jvorster63@gmail.com");
  await expect(
    asUser(t, admin).mutation(api.whitelist.removeEmail, { email: "jvorster63@gmail.com" }),
  ).rejects.toThrow();
  // The Admin is still admitted.
  expect(await t.query(internal.whitelist.isAdmitted, { email: "jvorster63@gmail.com" })).toBe(true);
});

test("removeEmail: a non-Admin caller is rejected", async () => {
  const t = convexTest(schema, modules);
  await seedAdmin(t, "jvorster63@gmail.com");
  await t.mutation(internal.whitelist.seedEmail, { email: "learner@example.com" });
  const intruder = await seedUser(t, "intruder@example.com");
  await expect(
    asUser(t, intruder).mutation(api.whitelist.removeEmail, { email: "learner@example.com" }),
  ).rejects.toThrow();
  expect(await t.query(internal.whitelist.isAdmitted, { email: "learner@example.com" })).toBe(true);
});

test("list: the Admin sees every admitted email with its Admin flag", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "jvorster63@gmail.com");
  await asUser(t, admin).mutation(api.whitelist.addEmail, { email: "learner@example.com" });

  const list = await asUser(t, admin).query(api.whitelist.list, {});
  const byEmail = Object.fromEntries(list.map((r) => [r.email, r.isAdmin]));
  expect(byEmail).toEqual({ "jvorster63@gmail.com": true, "learner@example.com": false });
});

test("list: a non-Admin caller is rejected", async () => {
  const t = convexTest(schema, modules);
  await seedAdmin(t, "jvorster63@gmail.com");
  const intruder = await seedUser(t, "intruder@example.com");
  await expect(asUser(t, intruder).query(api.whitelist.list, {})).rejects.toThrow();
});

test("amIAdmin: true for the Admin, false for a non-Admin, false when unauthenticated", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "jvorster63@gmail.com");
  const intruder = await seedUser(t, "intruder@example.com");

  expect(await asUser(t, admin).query(api.whitelist.amIAdmin, {})).toBe(true);
  expect(await asUser(t, intruder).query(api.whitelist.amIAdmin, {})).toBe(false);
  expect(await t.query(api.whitelist.amIAdmin, {})).toBe(false);
});

test("amIAllowlisted: answers by the caller's Allowlist row, false when unauthenticated", async () => {
  const t = convexTest(schema, modules);
  const member = await seedUser(t, "member@example.com");
  await t.mutation(internal.whitelist.seedEmail, { email: "member@example.com" });
  const outsider = await seedUser(t, "outsider@example.com");

  expect(await asUser(t, member).query(api.whitelist.amIAllowlisted, {})).toBe(true);
  expect(await asUser(t, outsider).query(api.whitelist.amIAllowlisted, {})).toBe(false);
  expect(await t.query(api.whitelist.amIAllowlisted, {})).toBe(false);
});
