/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

// The nudges mail through `scheduleInvite`, which builds links with `appUrl`.
process.env.SITE_URL = "https://app.example.com";

function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}

async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}

async function seedTopic(t: ReturnType<typeof convexTest>, ownerId: Id<"users">) {
  return await t.run((ctx) => ctx.db.insert("topics", { ownerId, slug: "hindi", title: "Hindi", status: "active" }));
}

// The scheduled sends, read back off the scheduler queue: each nudge is a
// `sendInvite` job, so the queue is where "who got mailed, with what link" lives.
async function scheduled(t: ReturnType<typeof convexTest>) {
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return jobs
    .filter((j) => String(j.name).includes("sendInvite"))
    .map((j) => j.args[0] as { to: string; kind: string; link: string });
}

test("reminds the buyers of every language who have never opened the course", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const idleAf = await seedUser(t, "idle-af@example.com");
  const idleEs = await seedUser(t, "idle-es@example.com");
  const reader = await seedUser(t, "reader@example.com");
  const topicId = await seedTopic(t, owner);

  await t.run(async (ctx) => {
    await ctx.db.insert("entitlements", { userId: idleAf, topicId, lang: "af" });
    await ctx.db.insert("entitlements", { userId: idleEs, topicId, lang: "es" });
    await ctx.db.insert("entitlements", { userId: reader, topicId, lang: "af" });
    // The owner's own seat is never nudged.
    await ctx.db.insert("entitlements", { userId: owner, topicId, lang: "en" });
    // One opened lesson is the whole definition of "started".
    await ctx.db.insert("progress", { userId: reader, topicId, lessonKey: "0001-a", status: "opened" });
  });

  const as = asUser(t, owner);
  // The tab is showing the English source; the audience is still the course.
  expect(await as.query(api.nudges.nudgeAudience, { topicSlug: "hindi" })).toEqual({ buyers: 2, translators: 0 });

  expect(await as.mutation(api.nudges.remindUnstartedBuyers, { topicSlug: "hindi" })).toBe(2);
  const sent = await scheduled(t);
  expect(sent.map((s) => s.to).sort()).toEqual(["idle-af@example.com", "idle-es@example.com"]);
  expect(sent.every((s) => s.kind === "reminder")).toBe(true);
  // Each lands in the Edition they actually hold, not the tab's Edition.
  expect(sent.find((s) => s.to === "idle-af@example.com")?.link).toBe(
    "https://app.example.com/courses/hindi?lang=af",
  );
  expect(sent.find((s) => s.to === "idle-es@example.com")?.link).toBe(
    "https://app.example.com/courses/hindi?lang=es",
  );
});

test("a buyer holding several Editions is reminded once, at their preferred one", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const buyer = await seedUser(t, "buyer@example.com");
  const topicId = await seedTopic(t, owner);

  await t.run(async (ctx) => {
    await ctx.db.insert("entitlements", { userId: buyer, topicId, lang: "af" });
    await ctx.db.insert("entitlements", { userId: buyer, topicId, lang: "en" });
  });

  const as = asUser(t, owner);
  expect(await as.query(api.nudges.nudgeAudience, { topicSlug: "hindi" })).toMatchObject({ buyers: 1 });
  expect(await as.mutation(api.nudges.remindUnstartedBuyers, { topicSlug: "hindi" })).toBe(1);

  const sent = await scheduled(t);
  expect(sent).toHaveLength(1);
  // `preferEdition` puts the source Edition ahead of whatever else they hold.
  expect(sent[0]).toMatchObject({ to: "buyer@example.com", link: "https://app.example.com/courses/hindi" });
});

test("nudges the invited translators of every language, each at their own edition", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedTopic(t, owner);

  await t.run(async (ctx) => {
    await ctx.db.insert("pendingShares", { topicId, email: "af@example.com", lang: "af", role: "editor" });
    await ctx.db.insert("pendingShares", { topicId, email: "de@example.com", lang: "de", role: "editor" });
    // A pending VIEWER is not a translator.
    await ctx.db.insert("pendingShares", { topicId, email: "viewer@example.com", lang: "af", role: "viewer" });
  });

  const as = asUser(t, owner);
  // Asked from the English source tab, where no translator is invited at all.
  expect(await as.query(api.nudges.nudgeAudience, { topicSlug: "hindi" })).toMatchObject({ translators: 2 });

  expect(await as.mutation(api.nudges.remindPendingTranslators, { topicSlug: "hindi" })).toBe(2);
  const sent = await scheduled(t);
  expect(sent.map((s) => s.to).sort()).toEqual(["af@example.com", "de@example.com"]);
  expect(sent.every((s) => s.kind === "translator")).toBe(true);
  // The deep link IS the sign-up door: AppGate renders sign-in at this URL.
  expect(sent.find((s) => s.to === "de@example.com")?.link).toBe("https://app.example.com/courses/hindi?lang=de");
});

test("a translator invited to two languages gets one email per language", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedTopic(t, owner);

  await t.run(async (ctx) => {
    await ctx.db.insert("pendingShares", { topicId, email: "poly@example.com", lang: "af", role: "editor" });
    await ctx.db.insert("pendingShares", { topicId, email: "poly@example.com", lang: "de", role: "editor" });
  });

  const as = asUser(t, owner);
  expect(await as.mutation(api.nudges.remindPendingTranslators, { topicSlug: "hindi" })).toBe(2);
  const sent = await scheduled(t);
  expect(sent.map((s) => s.link).sort()).toEqual([
    "https://app.example.com/courses/hindi?lang=af",
    "https://app.example.com/courses/hindi?lang=de",
  ]);
});

test("only the owner may see the audience or send either nudge", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const stranger = await seedUser(t, "stranger@example.com");
  await seedTopic(t, owner);

  const as = asUser(t, stranger);
  await expect(as.query(api.nudges.nudgeAudience, { topicSlug: "hindi" })).rejects.toThrow(/topic not found/);
  await expect(as.mutation(api.nudges.remindUnstartedBuyers, { topicSlug: "hindi" })).rejects.toThrow(
    /topic not found/,
  );
  await expect(as.mutation(api.nudges.remindPendingTranslators, { topicSlug: "hindi" })).rejects.toThrow(
    /topic not found/,
  );
});

test("an unconfigured Resend makes the nudge a no-op rather than a failure", async () => {
  const t = convexTest(schema, modules);
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  delete process.env.RESEND_API_KEY;
  delete process.env.INVITE_FROM_EMAIL;

  await t.action(internal.email.sendInvite, {
    to: "idle@example.com",
    kind: "reminder",
    courseTitle: "Hindi",
    langName: "Afrikaans",
    inviterEmail: "owner@example.com",
    role: "viewer",
    link: "https://app.example.com/courses/hindi?lang=af",
  });

  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
});
