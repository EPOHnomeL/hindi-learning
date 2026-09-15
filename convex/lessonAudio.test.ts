/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

// **The narration pilot's gate, which is a production permission boundary.**
// `lessonAudio.status` is what decides whether the play button exists at all, so
// every one of these tests is really asking "can this person make us spend money
// on ElevenLabs, on a course that is live on a real tenant?".
//
// The suite is written around `status` rather than `speak` on purpose: they share
// `pilotLesson`, and `status` is the one a learner's browser subscribes to
// unprompted. `speak` is covered for the one thing `status` cannot show, which is
// that the action re-checks instead of trusting its caller.

const modules = import.meta.glob("./**/*.ts");

const TENANT = "ywampotch";
const SLUG = "prophetic-school";

function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}

async function user(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}

// An Allowlist admin row. No `tenantSlug` is a sys admin (passes every tenant's
// check); a slug makes them that tenant's admin and nobody else's.
async function admin(t: ReturnType<typeof convexTest>, email: string, tenantSlug?: string) {
  const userId = await user(t, email);
  await t.run((ctx) => ctx.db.insert("whitelist", { email, isAdmin: true, tenantSlug }));
  return userId;
}

// The pilot course as it actually exists: on the `ywampotch` tenant, two lessons,
// a body blob on each so a passing gate has something to narrate.
async function seedCourse(t: ReturnType<typeof convexTest>, ownerId: Id<"users">) {
  return await t.run(async (ctx) => {
    const topicId = await ctx.db.insert("topics", { ownerId, slug: SLUG, title: "Prophetic School", tenantSlug: TENANT });
    const html = await ctx.storage.store(new Blob(["<p>Listen first.</p>"], { type: "text/html" }));
    await ctx.db.insert("lessons", { topicId, key: "l1", seq: 1, title: "One", htmlStorageId: html });
    await ctx.db.insert("lessons", { topicId, key: "l2", seq: 2, title: "Two", htmlStorageId: html });
    return topicId;
  });
}

const ask = (t: ReturnType<typeof convexTest>, key = "l1", lang?: string) =>
  t.query(api.lessonAudio.status, { topicSlug: SLUG, key, lang });

// ---- who gets the button ---------------------------------------------------

test("the course owner sees it", async () => {
  const t = convexTest(schema, modules);
  const owner = await user(t, "owner@example.com");
  await seedCourse(t, owner);
  expect(await ask(asUser(t, owner))).toEqual({ eligible: true, url: null });
});

test("an admin of this course's tenant sees it", async () => {
  const t = convexTest(schema, modules);
  await seedCourse(t, await user(t, "owner@example.com"));
  const ta = await admin(t, "ta@ywam.example", TENANT);
  expect(await ask(asUser(t, ta))).toEqual({ eligible: true, url: null });
});

test("a sys admin sees it, being an administrator of every tenant", async () => {
  const t = convexTest(schema, modules);
  await seedCourse(t, await user(t, "owner@example.com"));
  const sys = await admin(t, "sys@example.com");
  expect(await ask(asUser(t, sys))).toEqual({ eligible: true, url: null });
});

// ---- who does not ----------------------------------------------------------

test("a learner does not, which is the whole point of the gate", async () => {
  const t = convexTest(schema, modules);
  await seedCourse(t, await user(t, "owner@example.com"));
  const learner = await user(t, "learner@example.com");
  expect(await ask(asUser(t, learner))).toEqual({ eligible: false, url: null });
});

test("ANOTHER tenant's admin does not", async () => {
  // The reason `isCallerAdmin` is passed `topic.tenantSlug` rather than called
  // bare: an unscoped check would hand every branded site's administrator a
  // button on every other site's course.
  const t = convexTest(schema, modules);
  await seedCourse(t, await user(t, "owner@example.com"));
  const other = await admin(t, "ta@othertenant.example", "othertenant");
  expect(await ask(asUser(t, other))).toEqual({ eligible: false, url: null });
});

test("an allowlisted member who is not an admin does not", async () => {
  // Being admitted to CREATE courses (ADR 0021) is not being an administrator.
  const t = convexTest(schema, modules);
  await seedCourse(t, await user(t, "owner@example.com"));
  const member = await user(t, "member@example.com");
  await t.mutation(internal.whitelist.seedEmail, { email: "member@example.com" });
  expect(await ask(asUser(t, member))).toEqual({ eligible: false, url: null });
});

test("a signed-out visitor does not", async () => {
  const t = convexTest(schema, modules);
  await seedCourse(t, await user(t, "owner@example.com"));
  expect(await ask(t)).toEqual({ eligible: false, url: null });
});

// ---- the rest of the pilot's scope ----------------------------------------

test("not the second lesson, even for a sys admin", async () => {
  const t = convexTest(schema, modules);
  await seedCourse(t, await user(t, "owner@example.com"));
  const sys = await admin(t, "sys@example.com");
  expect(await ask(asUser(t, sys), "l2")).toEqual({ eligible: false, url: null });
});

test("not a translated Edition, even for a sys admin", async () => {
  const t = convexTest(schema, modules);
  await seedCourse(t, await user(t, "owner@example.com"));
  const sys = await admin(t, "sys@example.com");
  expect(await ask(asUser(t, sys), "l1", "hi")).toEqual({ eligible: false, url: null });
  // An absent `?lang` IS the English Edition, so it must still pass.
  expect(await ask(asUser(t, sys), "l1", undefined)).toEqual({ eligible: true, url: null });
});

test("not another course, even for its own owner", async () => {
  const t = convexTest(schema, modules);
  const owner = await user(t, "owner@example.com");
  await t.run((ctx) => ctx.db.insert("topics", { ownerId: owner, slug: "other-course", title: "Other", tenantSlug: TENANT }));
  const res = await asUser(t, owner).query(api.lessonAudio.status, { topicSlug: "other-course", key: "l1" });
  expect(res).toEqual({ eligible: false, url: null });
});

// ---- the action re-checks ---------------------------------------------------

test("speak refuses a learner rather than trusting the caller", async () => {
  // `status` hiding the button is UX. This is the boundary: a learner who calls
  // the action directly must be refused, and must not be told why.
  const t = convexTest(schema, modules);
  await seedCourse(t, await user(t, "owner@example.com"));
  const learner = await user(t, "learner@example.com");
  await expect(
    asUser(t, learner).action(api.lessonAudio.speak, { topicSlug: SLUG, key: "l1" }),
  ).rejects.toThrow(/not available/i);
});

test("speak refuses an admin on the wrong lesson with the same words", async () => {
  // The refusal is deliberately identical for "wrong lesson" and "not an
  // administrator", so probing it leaks nothing about the gate's shape.
  const t = convexTest(schema, modules);
  await seedCourse(t, await user(t, "owner@example.com"));
  const sys = await admin(t, "sys@example.com");
  await expect(
    asUser(t, sys).action(api.lessonAudio.speak, { topicSlug: SLUG, key: "l2" }),
  ).rejects.toThrow(/not available/i);
});

test("an admin past the gate still stops at an unconfigured deployment", async () => {
  // The order that matters: the gate first, THEN configuration. An admin is told
  // the key is missing; a learner never learns that much.
  const t = convexTest(schema, modules);
  await seedCourse(t, await user(t, "owner@example.com"));
  const sys = await admin(t, "sys@example.com");
  const had = process.env.ELEVENLABS_API_KEY;
  delete process.env.ELEVENLABS_API_KEY;
  try {
    await expect(
      asUser(t, sys).action(api.lessonAudio.speak, { topicSlug: SLUG, key: "l1" }),
    ).rejects.toThrow(/ELEVENLABS_API_KEY/);
  } finally {
    if (had !== undefined) process.env.ELEVENLABS_API_KEY = had;
  }
});

// ---- the audition budget ----------------------------------------------------

test("a sample and a full render are different cache entries", async () => {
  // The trap this pins: if `sampleChars` were not in the key, turning sampling on
  // would replay the full lesson (so the audition never happens), and turning it
  // off would replay the 600-character snippet forever.
  const t = convexTest(schema, modules);
  const topicId = await seedCourse(t, await user(t, "owner@example.com"));
  const sys = await admin(t, "sys@example.com");
  await t.run(async (ctx) => {
    const lesson = await ctx.db
      .query("lessons")
      .withIndex("by_topic_seq", (q) => q.eq("topicId", topicId))
      .first();
    const storageId = await ctx.storage.store(new Blob(["mp3"], { type: "audio/mpeg" }));
    await ctx.db.insert("lessonAudio", {
      topicId,
      lessonKey: "l1",
      lang: "en",
      voiceId: "21m00Tcm4TlvDq8ikWAM",
      modelId: "eleven_multilingual_v2",
      sampleChars: 0,
      sourceStorageId: lesson!.htmlStorageId,
      storageId,
      chars: 20,
    });
  });

  // Sampling off: the cached full render is a hit.
  expect((await ask(asUser(t, sys))).url).not.toBeNull();

  // Sampling on: a miss, because what is cached is not what was asked for.
  process.env.ELEVENLABS_SAMPLE_CHARS = "600";
  try {
    expect((await ask(asUser(t, sys))).url).toBeNull();
  } finally {
    delete process.env.ELEVENLABS_SAMPLE_CHARS;
  }
});

test("a malformed sample budget reads as off rather than breaking the button", async () => {
  const t = convexTest(schema, modules);
  await seedCourse(t, await user(t, "owner@example.com"));
  const sys = await admin(t, "sys@example.com");
  for (const bad of ["", "abc", "-5", "0"]) {
    process.env.ELEVENLABS_SAMPLE_CHARS = bad;
    try {
      expect(await ask(asUser(t, sys))).toEqual({ eligible: true, url: null });
    } finally {
      delete process.env.ELEVENLABS_SAMPLE_CHARS;
    }
  }
});

test("the voices diagnostic refuses without the operator secret", async () => {
  const t = convexTest(schema, modules);
  await expect(t.action(api.lessonAudio.voices, { secret: "wrong" })).rejects.toThrow(/unauthorized/i);
});
