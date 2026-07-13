/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";
import { claimPendingShares, getEditableTopic, shareRole } from "./lib";

// Editor role, model layer (edition-editor-rights issue 01): the write-side
// resolver `getEditableTopic` and role-preserving claim, exercised directly
// through `t.run` (they're plain helpers, not registered functions).

const modules = import.meta.glob("./**/*.ts");

async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}

test("getEditableTopic: owner and an editor-Share holder pass; everyone else is null", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const editor = await seedUser(t, "editor@example.com");
  const viewer = await seedUser(t, "viewer@example.com");
  const stranger = await seedUser(t, "stranger@example.com");
  const topicId = await t.run((ctx) => ctx.db.insert("topics", { ownerId: owner, slug: "hindi", title: "Hindi", status: "active" }));
  await t.run(async (ctx) => {
    // Editor of the English (source) edition; a plain Viewer of English.
    await ctx.db.insert("shares", { topicId, viewerId: editor, lang: "en", role: "editor" });
    await ctx.db.insert("shares", { topicId, viewerId: viewer, lang: "en" });
  });

  await t.run(async (ctx) => {
    // Owner always edits (any lang).
    expect((await getEditableTopic(ctx, owner, "hindi"))?._id).toBe(topicId);
    // Editor of the requested lang passes.
    expect((await getEditableTopic(ctx, editor, "hindi", "en"))?._id).toBe(topicId);
    // Viewer, stranger, unknown slug → null.
    expect(await getEditableTopic(ctx, viewer, "hindi", "en")).toBeNull();
    expect(await getEditableTopic(ctx, stranger, "hindi", "en")).toBeNull();
    expect(await getEditableTopic(ctx, editor, "nope", "en")).toBeNull();
  });
});

test("getEditableTopic: an editor of lang A cannot edit lang B", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const editor = await seedUser(t, "editor@example.com");
  const topicId = await t.run((ctx) => ctx.db.insert("topics", { ownerId: owner, slug: "hindi", title: "Hindi", status: "active" }));
  // Editor of Afrikaans only.
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId: editor, lang: "af", role: "editor" }));

  await t.run(async (ctx) => {
    expect((await getEditableTopic(ctx, editor, "hindi", "af"))?._id).toBe(topicId);
    // The English edition (and the default lang) is not authorised.
    expect(await getEditableTopic(ctx, editor, "hindi", "en")).toBeNull();
    expect(await getEditableTopic(ctx, editor, "hindi")).toBeNull();
  });
});

test("getEditableTopic: a legacy (no-lang) editor-Share authorises the English edition", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const editor = await seedUser(t, "editor@example.com");
  const topicId = await t.run((ctx) => ctx.db.insert("topics", { ownerId: owner, slug: "hindi", title: "Hindi", status: "active" }));
  // No `lang` → reads as English (shareLang default).
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId: editor, role: "editor" }));

  await t.run(async (ctx) => {
    expect((await getEditableTopic(ctx, editor, "hindi"))?._id).toBe(topicId);
    expect((await getEditableTopic(ctx, editor, "hindi", "en"))?._id).toBe(topicId);
    expect(await getEditableTopic(ctx, editor, "hindi", "af")).toBeNull();
  });
});

test("claimPendingShares: a pending editor invite becomes an editor Share on sign-up", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await t.run((ctx) => ctx.db.insert("topics", { ownerId: owner, slug: "hindi", title: "Hindi", status: "active" }));
  await t.run(async (ctx) => {
    await ctx.db.insert("pendingShares", { topicId, email: "newbie@example.com", lang: "en", role: "editor" });
    // A second pending invite with no role → claims as a Viewer.
    await ctx.db.insert("pendingShares", { topicId, email: "newbie@example.com", lang: "af" });
  });

  // The email signs up: a users row is created, then the callback claims invites.
  const newbie = await seedUser(t, "newbie@example.com");
  await t.run((ctx) => claimPendingShares(ctx, newbie, "newbie@example.com"));

  const shares = await t.run((ctx) =>
    ctx.db.query("shares").withIndex("by_topic_viewer", (q) => q.eq("topicId", topicId).eq("viewerId", newbie)).collect(),
  );
  const byLang = Object.fromEntries(shares.map((s) => [s.lang, shareRole(s)]));
  expect(byLang).toEqual({ en: "editor", af: "viewer" });
  // Invites are consumed.
  const leftover = await t.run((ctx) =>
    ctx.db.query("pendingShares").withIndex("by_email", (q) => q.eq("email", "newbie@example.com")).collect(),
  );
  expect(leftover).toHaveLength(0);
});
