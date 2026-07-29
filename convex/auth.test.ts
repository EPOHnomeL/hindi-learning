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
  // `setEnvDefaults` reads the Google client credentials off the environment
  // (provider_utils.ts), and the provider isn't materialised without them — so
  // `getProviderOrThrow("google")` would fail. Real deployments carry these as
  // Convex env vars; the values are never used here because no HTTP hop runs.
  process.env.AUTH_GOOGLE_ID = "test-google-client-id";
  process.env.AUTH_GOOGLE_SECRET = "test-google-client-secret";
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

// A Google sign-in, driven through the exact mutations the real round-trip runs:
// `signIn` mints the verifier, the `/api/auth/signin/google` route signs it, and
// the `/api/auth/callback/google` route calls `userOAuth` — which is what invokes
// our `createOrUpdateUser`. Only Google's own HTTP hop is skipped, so every row
// here is written by the same library mutation that writes it in production
// (no hand-seeded shapes — see the PRD's testing rule).
//
// `profile` is what the provider's `profile()` has already reduced Google's
// response to, minus the `id` the callback strips: `{ name, email, image }`
// (provider_utils.ts `defaultProfile`). Note it carries **no** `emailVerified`,
// which is why `createOrUpdateUser` has to derive verification from the provider
// type itself.
async function signInWithGoogle(
  t: ReturnType<typeof convexTest>,
  profile: { email: string; name?: string; image?: string },
  opts: { sub?: string } = {},
) {
  const sub = opts.sub ?? `google-sub-${profile.email}`;
  const signature = `sig-${sub}`;
  const verifier = await t.mutation(internal.auth.store, { args: { type: "verifier" } });
  await t.mutation(internal.auth.store, {
    args: { type: "verifierSignature", verifier, signature },
  });
  return await t.mutation(internal.auth.store, {
    args: { type: "userOAuth", provider: "google", providerAccountId: sub, profile, signature },
  });
}

const usersByEmail = (t: ReturnType<typeof convexTest>, email: string) =>
  t.run((ctx) => ctx.db.query("users").withIndex("email", (q) => q.eq("email", email)).collect());

test("Google sign-in on an unknown email creates one account and claims its pending Shares", async () => {
  const t = convexTest(schema, modules);
  const topicId = await t.run(async (ctx) => {
    const owner = await ctx.db.insert("users", { email: "owner@example.com" });
    const topicId = await ctx.db.insert("topics", { ownerId: owner, slug: "hindi", title: "Hindi", status: "active" });
    await ctx.db.insert("pendingShares", { topicId, email: "newcomer@example.com" });
    return topicId;
  });

  await signInWithGoogle(t, { email: "newcomer@example.com", name: "New Comer", image: "https://img/x.png" });

  const users = await usersByEmail(t, "newcomer@example.com");
  expect(users).toHaveLength(1);
  const shares = await t.run((ctx) =>
    ctx.db.query("shares").withIndex("by_viewer", (q) => q.eq("viewerId", users[0]._id)).collect(),
  );
  expect(shares.map((s) => s.topicId)).toEqual([topicId]);
});

test("Google sign-in on an email that already has a password account lands in that account, not a second one", async () => {
  const t = convexTest(schema, modules);
  await signUp(t, "learner@example.com", "hunter2-strong");
  const before = await usersByEmail(t, "learner@example.com");
  // The purchases/progress the fork would have stranded — a real Entitlement, so
  // the assertion is about the account that owns the money, not just a row count.
  const topicId = await t.run(async (ctx) => {
    const owner = await ctx.db.insert("users", { email: "seller@example.com" });
    return await ctx.db.insert("topics", { ownerId: owner, slug: "tswana", title: "Basic Tswana", status: "active" });
  });
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId: before[0]._id, lang: "en", role: "viewer" }));

  await signInWithGoogle(t, { email: "learner@example.com", name: "Google Name" });

  const after = await usersByEmail(t, "learner@example.com");
  expect(after).toHaveLength(1);
  expect(after[0]._id).toBe(before[0]._id);
  const shares = await t.run((ctx) =>
    ctx.db.query("shares").withIndex("by_viewer", (q) => q.eq("viewerId", after[0]._id)).collect(),
  );
  expect(shares.map((s) => s.topicId)).toEqual([topicId]);
});

test("linking never overwrites a name the user chose — it is what Certificates print", async () => {
  const t = convexTest(schema, modules);
  await signUp(t, "graduate@example.com", "hunter2-strong");
  const [user] = await usersByEmail(t, "graduate@example.com");
  await t.run((ctx) => ctx.db.patch(user._id, { name: "Thabo M. Nkosi" }));

  await signInWithGoogle(t, { email: "graduate@example.com", name: "thabo nkosi" });

  const [after] = await usersByEmail(t, "graduate@example.com");
  expect(after.name).toBe("Thabo M. Nkosi");
});

test("a new Google account stores the profile name and image, and counts the email as verified", async () => {
  const t = convexTest(schema, modules);

  await signInWithGoogle(t, { email: "fresh@example.com", name: "Fresh Face", image: "https://img/f.png" });

  const [user] = await usersByEmail(t, "fresh@example.com");
  expect(user.name).toBe("Fresh Face");
  expect(user.image).toBe("https://img/f.png");
  // Google has verified the address; nothing wrote this field before now.
  expect(user.emailVerificationTime).toBeTypeOf("number");
});

test("email normalisation holds across rails, so provider casing can't fork the account", async () => {
  const t = convexTest(schema, modules);
  await signUp(t, "foo@bar.com", "hunter2-strong");
  const before = await usersByEmail(t, "foo@bar.com");

  await signInWithGoogle(t, { email: "Foo@Bar.com" });

  const after = await usersByEmail(t, "foo@bar.com");
  expect(after).toHaveLength(1);
  expect(after[0]._id).toBe(before[0]._id);
  // And no mixed-case row was created alongside it.
  expect(await usersByEmail(t, "Foo@Bar.com")).toEqual([]);
});

test("sign-up succeeds for an email with no Allowlist row (open sign-up)", async () => {
  const t = convexTest(schema, modules);
  // The Allowlist gates course creation, not sign-up (ADR 0021). A non-empty
  // table that doesn't include this email must not matter.
  await t.mutation(internal.whitelist.seedEmail, { email: "someone-else@example.com" });

  await signUp(t, "stranger@example.com", "hunter2-strong");

  const user = await t.run((ctx) =>
    ctx.db.query("users").withIndex("email", (q) => q.eq("email", "stranger@example.com")).unique(),
  );
  expect(user?.email).toBe("stranger@example.com");
});

test("sign-up normalises the stored email, so casing can't mint a second identity", async () => {
  const t = convexTest(schema, modules);
  // Typed with scattered casing, stored normalised — otherwise the same person
  // could sign up again as a distinct mixed-case account.
  await signUp(t, "Learner@Example.com", "hunter2-strong");

  const users = await t.run((ctx) => ctx.db.query("users").collect());
  expect(users.map((u) => u.email)).toEqual(["learner@example.com"]);
});

test("signing up claims a Share invited before the account existed", async () => {
  const t = convexTest(schema, modules);
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

test("an existing account still signs in after its Allowlist row is removed (the Allowlist never gates auth)", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.whitelist.seedEmail, { email: "member@example.com" });
  await signUp(t, "member@example.com", "hunter2-strong");

  // Remove the email from the Allowlist — that revokes course creation, nothing else.
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query("whitelist")
      .withIndex("by_email", (q) => q.eq("email", "member@example.com"))
      .unique();
    if (row) await ctx.db.delete(row._id);
  });

  const result = await signIn(t, "member@example.com", "hunter2-strong");
  expect(result).toMatchObject({ tokens: expect.anything() });
});
