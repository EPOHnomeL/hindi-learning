/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeAll, expect, test } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

// Convex Auth signs a session JWT on a successful sign-up, which needs a private
// key + issuer in the environment (set by `npx @convex-dev/auth` in real
// deployments). Mint a throwaway RS256 key (PKCS8 PEM, the shape jose expects)
// so the accepted path can complete.
beforeAll(() => {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  process.env.JWT_PRIVATE_KEY = privateKey as string;
  process.env.CONVEX_SITE_URL = "https://example.convex.site";
});

async function signUp(t: ReturnType<typeof convexTest>, email: string, password: string) {
  return await t.action(api.auth.signIn, {
    provider: "password",
    params: { email, password, flow: "signUp" },
  });
}

async function signIn(t: ReturnType<typeof convexTest>, email: string, password: string) {
  return await t.action(api.auth.signIn, {
    provider: "password",
    params: { email, password, flow: "signIn" },
  });
}

test("sign-up is rejected for an email that isn't on the Allowlist", async () => {
  const t = convexTest(schema, modules);
  // Allowlist seeded with someone else — the table is not empty, but this email
  // is not admitted.
  await t.mutation(internal.whitelist.seedEmail, { email: "admitted@example.com" });

  await expect(signUp(t, "stranger@example.com", "hunter2-strong")).rejects.toThrow();
  // No account was created.
  const user = await t.run((ctx) =>
    ctx.db.query("users").withIndex("email", (q) => q.eq("email", "stranger@example.com")).unique(),
  );
  expect(user).toBeNull();
});

test("sign-up creates a user for an admitted email", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.whitelist.seedEmail, { email: "admitted@example.com" });

  await signUp(t, "admitted@example.com", "hunter2-strong");

  const user = await t.run((ctx) =>
    ctx.db.query("users").withIndex("email", (q) => q.eq("email", "admitted@example.com")).unique(),
  );
  expect(user?.email).toBe("admitted@example.com");
});

test("sign-up normalises the stored email, so casing can't mint a second identity", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.whitelist.seedEmail, { email: "admitted@example.com" });

  // Admitted email, typed with different casing. The gate admits it AND the
  // stored account identity must be normalised — otherwise the same person
  // could sign up again as a distinct mixed-case account past one Allowlist row.
  await signUp(t, "Admitted@Example.com", "hunter2-strong");

  const users = await t.run((ctx) => ctx.db.query("users").collect());
  expect(users.map((u) => u.email)).toEqual(["admitted@example.com"]);
});

test("signing up claims a Share invited before the account existed", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.whitelist.seedEmail, { email: "invitee@example.com" });

  // An owner invited invitee@ to a Topic while they still had no account, so it
  // was held as a pending Share.
  const topicId = await t.run(async (ctx) => {
    const owner = await ctx.db.insert("users", { email: "owner@example.com" });
    const topicId = await ctx.db.insert("topics", { ownerId: owner, slug: "hindi", title: "Hindi", status: "active" });
    await ctx.db.insert("pendingShares", { topicId, email: "invitee@example.com" });
    return topicId;
  });

  await signUp(t, "invitee@example.com", "hunter2-strong");

  // On sign-up the invite became a real Share, and the pending row is gone.
  const { sharedTopicIds, pending } = await t.run(async (ctx) => {
    const user = await ctx.db.query("users").withIndex("email", (q) => q.eq("email", "invitee@example.com")).unique();
    const shares = await ctx.db.query("shares").withIndex("by_viewer", (q) => q.eq("viewerId", user!._id)).collect();
    const pending = await ctx.db.query("pendingShares").withIndex("by_email", (q) => q.eq("email", "invitee@example.com")).collect();
    return { sharedTopicIds: shares.map((s) => s.topicId), pending };
  });
  expect(sharedTopicIds).toEqual([topicId]);
  expect(pending).toEqual([]);
});

test("an existing account still signs in after its email is removed (sign-up gate only)", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.whitelist.seedEmail, { email: "admitted@example.com" });
  await signUp(t, "admitted@example.com", "hunter2-strong");

  // Remove the email from the Allowlist — new sign-ups for it are now closed.
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query("whitelist")
      .withIndex("by_email", (q) => q.eq("email", "admitted@example.com"))
      .unique();
    if (row) await ctx.db.delete(row._id);
  });

  // The existing account can still sign in — removal gates sign-up, not sign-in.
  const result = await signIn(t, "admitted@example.com", "hunter2-strong");
  expect(result).toMatchObject({ tokens: expect.anything() });
});
