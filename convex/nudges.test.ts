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

test("reminds only the buyers of this Edition who have never opened it", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const idle = await seedUser(t, "idle@example.com");
  const reader = await seedUser(t, "reader@example.com");
  const otherLang = await seedUser(t, "spanish@example.com");
  const topicId = await seedTopic(t, owner);

  await t.run(async (ctx) => {
    await ctx.db.insert("entitlements", { userId: idle, topicId, lang: "af" });
    await ctx.db.insert("entitlements", { userId: reader, topicId, lang: "af" });
    await ctx.db.insert("entitlements", { userId: otherLang, topicId, lang: "es" });
    // The reader opened one lesson, which is the whole definition of "started".
    await ctx.db.insert("progress", { userId: reader, topicId, lessonKey: "0001-a", status: "opened" });
  });

  const as = asUser(t, owner);
  expect(await as.query(api.nudges.nudgeAudience, { topicSlug: "hindi", lang: "af" })).toEqual({
    buyers: 1,
    translators: 0,
  });

  expect(await as.mutation(api.nudges.remindUnstartedBuyers, { topicSlug: "hindi", lang: "af" })).toBe(1);
  const sent = await scheduled(t);
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ to: "idle@example.com", kind: "reminder" });
  // Straight into the Edition they bought, not the site root.
  expect(sent[0]?.link).toBe("https://app.example.com/courses/hindi?lang=af");
});

test("nudges the invited translators of this Edition who have no account", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedTopic(t, owner);

  await t.run(async (ctx) => {
    await ctx.db.insert("pendingShares", { topicId, email: "translator@example.com", lang: "af", role: "editor" });
    // A pending VIEWER is not a translator, and an Editor on another Edition is
    // not this Edition's translator.
    await ctx.db.insert("pendingShares", { topicId, email: "viewer@example.com", lang: "af", role: "viewer" });
    await ctx.db.insert("pendingShares", { topicId, email: "spanish@example.com", lang: "es", role: "editor" });
  });

  const as = asUser(t, owner);
  expect(await as.query(api.nudges.nudgeAudience, { topicSlug: "hindi", lang: "af" })).toMatchObject({
    translators: 1,
  });

  expect(await as.mutation(api.nudges.remindPendingTranslators, { topicSlug: "hindi", lang: "af" })).toBe(1);
  const sent = await scheduled(t);
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({
    to: "translator@example.com",
    kind: "translator",
    // The deep link IS the sign-up door: AppGate renders sign-in at this URL.
    link: "https://app.example.com/courses/hindi?lang=af",
  });
});

test("only the owner may see the audience or send either nudge", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const stranger = await seedUser(t, "stranger@example.com");
  await seedTopic(t, owner);

  const as = asUser(t, stranger);
  await expect(as.query(api.nudges.nudgeAudience, { topicSlug: "hindi", lang: "af" })).rejects.toThrow(
    /topic not found/,
  );
  await expect(as.mutation(api.nudges.remindUnstartedBuyers, { topicSlug: "hindi", lang: "af" })).rejects.toThrow(
    /topic not found/,
  );
  await expect(as.mutation(api.nudges.remindPendingTranslators, { topicSlug: "hindi", lang: "af" })).rejects.toThrow(
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
