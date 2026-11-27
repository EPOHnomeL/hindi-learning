/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { NARRATION_MODEL, NARRATION_VOICES } from "./narrationVoices";
import schema from "./schema";

// **Who hears a narration, and what an upload may do to storage.**
//
// Two boundaries live in `lessonAudio.ts` and this suite is both of them:
//
//  - `status` decides whether the play control exists and hands out a signed URL
//    to a recording, on a course that is live on a real tenant. Until 2026-11-24
//    it also guarded a provider bill; recordings are uploaded now, so what is
//    left to protect is the audio itself: nobody outside the lesson's readers
//    gets a URL.
//  - `saveUpload` and `purgeRetired` DELETE blobs. The tests below pin exactly
//    which ones, because a storage delete has no undo.

const modules = import.meta.glob("./**/*.ts");

const TENANT = "ywampotch";
const SLUG = "prophetic-school";
const SECRET = "test-secret";
const [MICHAEL, EMMA] = NARRATION_VOICES;
// The ElevenLabs pilot's recordings, as they sit in production.
const GEORGE = { voiceId: "JBFqnCBsd6RMkjVDRZzb", modelId: "eleven_multilingual_v2" };

const NOTHING = { eligible: false, url: null, voice: null, voices: [] };

type T = ReturnType<typeof convexTest>;

function asUser(t: T, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}

async function user(t: T, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}

// An Allowlist admin row. No `tenantSlug` is a sys admin (passes every tenant's
// check); a slug makes them that tenant's admin and nobody else's.
async function admin(t: T, email: string, tenantSlug?: string) {
  const userId = await user(t, email);
  await t.run((ctx) => ctx.db.insert("whitelist", { email, isAdmin: true, tenantSlug }));
  return userId;
}

// A course on the `ywampotch` tenant: two lessons, each with its OWN body blob,
// so "a recording of this body" and "of the other lesson's body" differ.
async function seedCourse(t: T, ownerId: Id<"users">, slug = SLUG) {
  return await t.run(async (ctx) => {
    const topicId = await ctx.db.insert("topics", { ownerId, slug, title: "Prophetic School", tenantSlug: TENANT });
    for (const [i, key] of ["l1", "l2"].entries()) {
      const html = await ctx.storage.store(new Blob([`<p>Lesson ${key}.</p>`], { type: "text/html" }));
      await ctx.db.insert("lessons", { topicId, key, seq: i + 1, title: key, htmlStorageId: html });
    }
    return topicId;
  });
}

async function bodyOf(t: T, topicId: Id<"topics">, lessonKey: string) {
  return await t.run(async (ctx) => {
    const lesson = await ctx.db
      .query("lessons")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", lessonKey))
      .unique();
    return lesson!.htmlStorageId!;
  });
}

const mp3 = (t: T, bytes = "mp3") => t.run((ctx) => ctx.storage.store(new Blob([bytes], { type: "audio/mpeg" })));
const blobExists = async (t: T, id: Id<"_storage">) => (await t.run((ctx) => ctx.db.system.get(id))) !== null;
const rowCount = (t: T) => t.run(async (ctx) => (await ctx.db.query("lessonAudio").collect()).length);

// A recording already in the table. Defaults to a current one of the lesson as
// it reads now; `over` bends any part of that.
async function seedRecording(
  t: T,
  topicId: Id<"topics">,
  lessonKey: string,
  voiceId: string,
  over: { modelId?: string; sampleChars?: number; sourceStorageId?: Id<"_storage"> } = {},
) {
  const sourceStorageId = over.sourceStorageId ?? (await bodyOf(t, topicId, lessonKey));
  const storageId = await mp3(t, `${voiceId} reads ${lessonKey}`);
  await t.run((ctx) =>
    ctx.db.insert("lessonAudio", {
      topicId,
      lessonKey,
      lang: "en",
      voiceId,
      modelId: over.modelId ?? NARRATION_MODEL,
      sampleChars: over.sampleChars ?? 0,
      sourceStorageId,
      storageId,
      chars: 100,
    }),
  );
  return storageId;
}

const ask = (t: T, over: { key?: string; lang?: string; voice?: string } = {}) =>
  t.query(api.lessonAudio.status, { topicSlug: SLUG, key: over.key ?? "l1", lang: over.lang, voice: over.voice });

// A course with both voices recorded on l1, and a learner holding a grant on it.
async function recordedCourse(t: T) {
  const owner = await user(t, "owner@example.com");
  const topicId = await seedCourse(t, owner);
  await seedRecording(t, topicId, "l1", MICHAEL);
  await seedRecording(t, topicId, "l1", EMMA);
  const learner = await user(t, "learner@example.com");
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId: learner }));
  return { owner, topicId, learner };
}

// ---- who hears it -----------------------------------------------------------

test("a learner with a grant hears a recorded lesson, in the first voice by default", async () => {
  const t = convexTest(schema, modules);
  const { learner } = await recordedCourse(t);
  const res = await ask(asUser(t, learner));
  expect(res.eligible).toBe(true);
  expect(res.url).not.toBeNull();
  // The default is the FIRST entry of `NARRATION_VOICES`, which is the casting
  // decision, and both are on offer in that order.
  expect(res.voice).toBe(MICHAEL);
  expect(res.voices).toEqual([MICHAEL, EMMA]);
});

test("the course owner hears it", async () => {
  const t = convexTest(schema, modules);
  const { owner } = await recordedCourse(t);
  expect((await ask(asUser(t, owner))).eligible).toBe(true);
});

test("a signed-in visitor to a paid course hears the free preview lesson and no other", async () => {
  // The reader's paywall, not a rule of its own: on a paid Edition a caller
  // with no grant reads the first lesson only, and audio of a lesson IS the
  // lesson. Without this, pricing a course would leave its narration free.
  const t = convexTest(schema, modules);
  const { topicId } = await recordedCourse(t);
  await seedRecording(t, topicId, "l2", MICHAEL);
  await t.run((ctx) => ctx.db.insert("listings", { topicId, lang: "en", amount: 25000, currency: "zar" }));
  const visitor = await user(t, "visitor@example.com");
  expect((await ask(asUser(t, visitor), { key: "l1" })).eligible).toBe(true);
  expect(await ask(asUser(t, visitor), { key: "l2" })).toEqual(NOTHING);
});

// ---- who does not -----------------------------------------------------------

test("a stranger with no grant hears nothing, recorded or not", async () => {
  const t = convexTest(schema, modules);
  await recordedCourse(t);
  const stranger = await user(t, "stranger@example.com");
  expect(await ask(asUser(t, stranger))).toEqual(NOTHING);
});

test("an administrator without a grant hears nothing, sys admin or tenant admin", async () => {
  // Until 2026-11-24 administrators were let in here, because they were the
  // ones who commissioned a render. The reader shows an admin nothing a grant
  // does not, and a recording URL is a permanent link to the whole lesson, so
  // neither does this.
  const t = convexTest(schema, modules);
  await recordedCourse(t);
  const sys = await admin(t, "sys@example.com");
  const ta = await admin(t, "ta@ywam.example", TENANT);
  const other = await admin(t, "ta@othertenant.example", "othertenant");
  for (const who of [sys, ta, other]) expect(await ask(asUser(t, who))).toEqual(NOTHING);
});

test("a learner who holds only a translated Edition hears nothing", async () => {
  // They arrive with no `?lang` and the reader serves them the Hindi lesson.
  // "Holds some grant on the course" would have played English over it, and on
  // a paid English Edition would have handed out the narration of every lesson.
  const t = convexTest(schema, modules);
  const { topicId } = await recordedCourse(t);
  await seedRecording(t, topicId, "l2", MICHAEL);
  const hindi = await user(t, "hindi@example.com");
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId: hindi, lang: "hi" }));
  expect(await ask(asUser(t, hindi))).toEqual(NOTHING);
  expect(await ask(asUser(t, hindi), { lang: "en" })).toEqual(NOTHING);
  await t.run((ctx) => ctx.db.insert("listings", { topicId, lang: "en", amount: 25000, currency: "zar" }));
  expect(await ask(asUser(t, hindi), { key: "l2" })).toEqual(NOTHING);
  expect(await ask(asUser(t, hindi), { lang: "en", key: "l2" })).toEqual(NOTHING);
});

test("an allowlisted member who is not an admin hears nothing", async () => {
  // Being admitted to CREATE courses (ADR 0021) is not a grant on this one.
  const t = convexTest(schema, modules);
  await recordedCourse(t);
  const member = await user(t, "member@example.com");
  await t.mutation(internal.whitelist.seedEmail, { email: "member@example.com" });
  expect(await ask(asUser(t, member))).toEqual(NOTHING);
});

test("a signed-out visitor hears nothing", async () => {
  const t = convexTest(schema, modules);
  await recordedCourse(t);
  expect(await ask(t)).toEqual(NOTHING);
});

test("an absent ?lang is the English Edition for someone who holds it", async () => {
  const t = convexTest(schema, modules);
  const { learner } = await recordedCourse(t);
  expect((await ask(asUser(t, learner), { lang: undefined })).eligible).toBe(true);
  expect((await ask(asUser(t, learner), { lang: "en" })).eligible).toBe(true);
});

test("a superseded lesson is not narrated, as the reader does not show it", async () => {
  const t = convexTest(schema, modules);
  const { owner, topicId } = await recordedCourse(t);
  await t.run(async (ctx) => {
    const lesson = await ctx.db
      .query("lessons")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", "l1"))
      .unique();
    await ctx.db.patch(lesson!._id, { supersededBy: "l1b" });
  });
  expect(await ask(asUser(t, owner))).toEqual(NOTHING);
});

// ---- the gate is "a recording exists" --------------------------------------

test("nobody sees a control on a lesson with no recording, the owner included", async () => {
  // A play button that can only ever fail is worse than no play button. Under
  // the ElevenLabs pilot an administrator saw it anyway, as an invitation to
  // render; nobody can commission a render from the reader any more.
  const t = convexTest(schema, modules);
  const { owner, learner } = await recordedCourse(t);
  for (const who of [owner, learner]) expect(await ask(asUser(t, who), { key: "l2" })).toEqual(NOTHING);
});

test("a lesson that does not exist is the same nothing", async () => {
  const t = convexTest(schema, modules);
  const { owner } = await recordedCourse(t);
  expect(await ask(asUser(t, owner), { key: "no-such-lesson" })).toEqual(NOTHING);
});

test("any course with a recording is narrated, not one named course", async () => {
  // The pilot's `PILOT_SLUG` constant went with the provider bill it guarded.
  const t = convexTest(schema, modules);
  const owner = await user(t, "owner@example.com");
  const topicId = await seedCourse(t, owner, "another-course");
  await seedRecording(t, topicId, "l1", MICHAEL);
  const res = await asUser(t, owner).query(api.lessonAudio.status, { topicSlug: "another-course", key: "l1" });
  expect(res.eligible).toBe(true);
});

// ---- choosing a voice -------------------------------------------------------

test("the learner's chosen voice is the one that plays", async () => {
  const t = convexTest(schema, modules);
  const { learner } = await recordedCourse(t);
  const michael = await ask(asUser(t, learner), { voice: MICHAEL });
  const emma = await ask(asUser(t, learner), { voice: EMMA });
  expect(emma.voice).toBe(EMMA);
  expect(emma.voices).toEqual([MICHAEL, EMMA]);
  // Two different files, not the same one under two names.
  expect(emma.url).not.toBeNull();
  expect(emma.url).not.toBe(michael.url);
});

test("a chosen voice with no recording of this lesson falls back to one that has", async () => {
  // Mid-rollout a lesson can be recorded in one voice only. A learner who chose
  // the other must still be able to listen, and is told which voice they got.
  const t = convexTest(schema, modules);
  const owner = await user(t, "owner@example.com");
  const topicId = await seedCourse(t, owner);
  await seedRecording(t, topicId, "l1", EMMA);
  const res = await ask(asUser(t, owner), { voice: MICHAEL });
  expect(res).toMatchObject({ eligible: true, voice: EMMA, voices: [EMMA] });
  expect(res.url).not.toBeNull();
});

test("a voice nobody cast is ignored rather than trusted", async () => {
  // `voice` is a client argument, so it can be anything, George's old id included.
  const t = convexTest(schema, modules);
  const { learner } = await recordedCourse(t);
  for (const voice of ["", "nonsense", GEORGE.voiceId]) {
    expect((await ask(asUser(t, learner), { voice })).voice).toBe(MICHAEL);
  }
});

// ---- what counts as a recording --------------------------------------------

test("the ElevenLabs pilot's recordings are no longer served", async () => {
  // They stay in the table until `purgeRetired` is run, and must not play.
  const t = convexTest(schema, modules);
  const owner = await user(t, "owner@example.com");
  const topicId = await seedCourse(t, owner);
  await seedRecording(t, topicId, "l1", GEORGE.voiceId, { modelId: GEORGE.modelId });
  expect(await ask(asUser(t, owner))).toEqual(NOTHING);
  expect(await ask(asUser(t, owner), { voice: GEORGE.voiceId })).toEqual(NOTHING);
});

test("a current voice under another model, or a sample, is not a recording", async () => {
  const t = convexTest(schema, modules);
  const owner = await user(t, "owner@example.com");
  const topicId = await seedCourse(t, owner);
  await seedRecording(t, topicId, "l1", MICHAEL, { modelId: "kokoro-v0.19" });
  await seedRecording(t, topicId, "l1", EMMA, { sampleChars: 600 });
  expect(await ask(asUser(t, owner))).toEqual(NOTHING);
});

test("a recording of words the lesson no longer says is not played", async () => {
  // The owner's in-place editor (ADR 0020) repoints the Lesson body. Reading the
  // old words over the new page is worse than silence.
  const t = convexTest(schema, modules);
  const { owner, topicId } = await recordedCourse(t);
  await t.run(async (ctx) => {
    const lesson = await ctx.db
      .query("lessons")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", "l1"))
      .unique();
    const edited = await ctx.storage.store(new Blob(["<p>Edited.</p>"], { type: "text/html" }));
    await ctx.db.patch(lesson!._id, { htmlStorageId: edited });
  });
  expect(await ask(asUser(t, owner))).toEqual(NOTHING);
});

test("a recording whose file has gone is not on offer", async () => {
  const t = convexTest(schema, modules);
  const owner = await user(t, "owner@example.com");
  const topicId = await seedCourse(t, owner);
  const michael = await seedRecording(t, topicId, "l1", MICHAEL);
  await seedRecording(t, topicId, "l1", EMMA);
  await t.run((ctx) => ctx.storage.delete(michael));
  expect(await ask(asUser(t, owner))).toMatchObject({ eligible: true, voice: EMMA, voices: [EMMA] });
});

// ---- the operator's upload rail --------------------------------------------

// `assertAdmin` reads PUBLISH_SECRET at call time.
async function withSecret<R>(run: () => Promise<R>): Promise<R> {
  const had = process.env.PUBLISH_SECRET;
  process.env.PUBLISH_SECRET = SECRET;
  try {
    return await run();
  } finally {
    if (had === undefined) delete process.env.PUBLISH_SECRET;
    else process.env.PUBLISH_SECRET = had;
  }
}

const upload = (
  t: T,
  args: { lessonKey?: string; voiceId?: string; sourceStorageId: Id<"_storage">; storageId: Id<"_storage">; topicSlug?: string },
) =>
  withSecret(() =>
    t.mutation(api.lessonAudio.saveUpload, {
      secret: SECRET,
      topicSlug: args.topicSlug ?? SLUG,
      lessonKey: args.lessonKey ?? "l1",
      voiceId: args.voiceId ?? MICHAEL,
      sourceStorageId: args.sourceStorageId,
      storageId: args.storageId,
      chars: 1234,
    }),
  );

test("an upload becomes a recording a learner can play", async () => {
  const t = convexTest(schema, modules);
  const owner = await user(t, "owner@example.com");
  const topicId = await seedCourse(t, owner);
  const storageId = await mp3(t);
  expect(await upload(t, { sourceStorageId: await bodyOf(t, topicId, "l1"), storageId })).toEqual({ ok: true });
  expect(await ask(asUser(t, owner))).toMatchObject({ eligible: true, voice: MICHAEL, voices: [MICHAEL] });
  const row = await t.run((ctx) => ctx.db.query("lessonAudio").first());
  expect(row).toMatchObject({ lang: "en", voiceId: MICHAEL, modelId: NARRATION_MODEL, sampleChars: 0, chars: 1234, storageId });
});

test("uploading a lesson again replaces the recording and bins the old file", async () => {
  const t = convexTest(schema, modules);
  const topicId = await seedCourse(t, await user(t, "owner@example.com"));
  const source = await bodyOf(t, topicId, "l1");
  const first = await mp3(t, "first take");
  const second = await mp3(t, "second take");
  await upload(t, { sourceStorageId: source, storageId: first });
  await upload(t, { sourceStorageId: source, storageId: second });
  expect(await rowCount(t)).toBe(1);
  expect(await blobExists(t, first)).toBe(false);
  expect(await blobExists(t, second)).toBe(true);
});

test("an upload in one voice leaves the other voice's recording alone", async () => {
  const t = convexTest(schema, modules);
  const topicId = await seedCourse(t, await user(t, "owner@example.com"));
  const emma = await seedRecording(t, topicId, "l1", EMMA);
  await upload(t, { sourceStorageId: await bodyOf(t, topicId, "l1"), storageId: await mp3(t) });
  expect(await rowCount(t)).toBe(2);
  expect(await blobExists(t, emma)).toBe(true);
});

test("sending the same upload twice does not delete it", async () => {
  // A retried request carries the same `storageId`. Replacing the row must not
  // bin the file the new row points at.
  const t = convexTest(schema, modules);
  const topicId = await seedCourse(t, await user(t, "owner@example.com"));
  const source = await bodyOf(t, topicId, "l1");
  const storageId = await mp3(t);
  await upload(t, { sourceStorageId: source, storageId });
  await upload(t, { sourceStorageId: source, storageId });
  expect(await rowCount(t)).toBe(1);
  expect(await blobExists(t, storageId)).toBe(true);
});

test("a refused upload is deleted, so nothing is left orphaned in storage", async () => {
  // Each refusal RETURNS rather than throws: a throw would roll the delete back
  // and leave the mp3 in storage, billed and unreachable.
  const t = convexTest(schema, modules);
  const topicId = await seedCourse(t, await user(t, "owner@example.com"));
  const source = await bodyOf(t, topicId, "l1");
  const refusals: [string, Parameters<typeof upload>[1], RegExp][] = [
    ["an unknown voice", { voiceId: GEORGE.voiceId, sourceStorageId: source, storageId: await mp3(t) }, /not a narration voice/],
    ["a missing course", { topicSlug: "nope", sourceStorageId: source, storageId: await mp3(t) }, /No course/],
    ["a missing lesson", { lessonKey: "l99", sourceStorageId: source, storageId: await mp3(t) }, /No lesson/],
    // l2's body is a real blob, but it is not what l1 reads.
    ["a body the lesson has moved on from", { sourceStorageId: await bodyOf(t, topicId, "l2"), storageId: await mp3(t) }, /edited after/],
  ];
  for (const [name, args, reason] of refusals) {
    const res = await upload(t, args);
    expect(res.ok, name).toBe(false);
    expect(res.reason, name).toMatch(reason);
    expect(await blobExists(t, args.storageId), name).toBe(false);
  }
  expect(await rowCount(t)).toBe(0);
  // The lesson bodies themselves were never candidates for deletion.
  expect(await blobExists(t, source)).toBe(true);
});

test("an upload that IS the lesson body is refused and NOT deleted", async () => {
  // The refusal that keeps its hands off storage. `storageId` is an argument:
  // every other refusal bins it, and aimed at a lesson body that would bin the
  // lesson. The unknown voice here would otherwise trigger exactly that delete.
  //
  // Its sibling, "labelled as something other than audio/mpeg", is NOT covered
  // here: convex-test records no content type on a stored blob, so that branch
  // can only be exercised against a real deployment.
  const t = convexTest(schema, modules);
  const topicId = await seedCourse(t, await user(t, "owner@example.com"));
  const body = await bodyOf(t, topicId, "l1");
  const res = await upload(t, { voiceId: "nonsense", sourceStorageId: body, storageId: body });
  expect(res.ok).toBe(false);
  expect(res.reason).toMatch(/lesson body/);
  expect(await blobExists(t, body)).toBe(true);
});

test("an upload naming a file that is not in storage is refused", async () => {
  const t = convexTest(schema, modules);
  const topicId = await seedCourse(t, await user(t, "owner@example.com"));
  const gone = await mp3(t);
  await t.run((ctx) => ctx.storage.delete(gone));
  const res = await upload(t, { sourceStorageId: await bodyOf(t, topicId, "l1"), storageId: gone });
  expect(res.ok).toBe(false);
  expect(res.reason).toMatch(/not in storage/);
  expect(await rowCount(t)).toBe(0);
});

test("the upload rail refuses a caller without the operator secret", async () => {
  const t = convexTest(schema, modules);
  const topicId = await seedCourse(t, await user(t, "owner@example.com"));
  const storageId = await mp3(t);
  await withSecret(async () => {
    await expect(
      t.mutation(api.lessonAudio.saveUpload, {
        secret: "wrong",
        topicSlug: SLUG,
        lessonKey: "l1",
        voiceId: MICHAEL,
        sourceStorageId: await bodyOf(t, topicId, "l1"),
        storageId,
        chars: 1,
      }),
    ).rejects.toThrow(/unauthorized/i);
    await expect(t.query(api.lessonAudio.uploaded, { secret: "wrong", topicSlug: SLUG })).rejects.toThrow(/unauthorized/i);
  });
  // A stranger's call touches nothing, the file they named included.
  expect(await blobExists(t, storageId)).toBe(true);
  expect(await rowCount(t)).toBe(0);
});

test("the uploader is told what the deployment holds, and only current recordings", async () => {
  const t = convexTest(schema, modules);
  const topicId = await seedCourse(t, await user(t, "owner@example.com"));
  await seedRecording(t, topicId, "l1", MICHAEL);
  await seedRecording(t, topicId, "l2", EMMA);
  await seedRecording(t, topicId, "l1", GEORGE.voiceId, { modelId: GEORGE.modelId });
  const held = await withSecret(() => t.query(api.lessonAudio.uploaded, { secret: SECRET, topicSlug: SLUG }));
  expect(held).toHaveLength(2);
  expect(held).toContainEqual({ lessonKey: "l1", voiceId: MICHAEL, sourceStorageId: await bodyOf(t, topicId, "l1"), chars: 100 });
  expect(held).toContainEqual({ lessonKey: "l2", voiceId: EMMA, sourceStorageId: await bodyOf(t, topicId, "l2"), chars: 100 });
  expect(await withSecret(() => t.query(api.lessonAudio.uploaded, { secret: SECRET, topicSlug: "nope" }))).toEqual([]);
});

test("a recording whose file has gone is not reported as held, so it is sent again", async () => {
  // `status` will not serve it. If the uploader were told it was there, that
  // voice would stay missing for the lesson while every push reported success.
  const t = convexTest(schema, modules);
  const topicId = await seedCourse(t, await user(t, "owner@example.com"));
  const lost = await seedRecording(t, topicId, "l1", MICHAEL);
  await t.run((ctx) => ctx.storage.delete(lost));
  expect(await withSecret(() => t.query(api.lessonAudio.uploaded, { secret: SECRET, topicSlug: SLUG }))).toEqual([]);
  // And the repair works: the dangling row is replaced, not tripped over.
  expect((await upload(t, { sourceStorageId: await bodyOf(t, topicId, "l1"), storageId: await mp3(t) })).ok).toBe(true);
  expect(await rowCount(t)).toBe(1);
});

test("a file that is already another lesson's recording is refused and NOT deleted", async () => {
  // Refusing would bin it, accepting would point two rows at one file, and the
  // next re-upload of either lesson would then delete it from under the other.
  const t = convexTest(schema, modules);
  const topicId = await seedCourse(t, await user(t, "owner@example.com"));
  const l1Michael = await seedRecording(t, topicId, "l1", MICHAEL);
  const asL2 = await upload(t, { lessonKey: "l2", sourceStorageId: await bodyOf(t, topicId, "l2"), storageId: l1Michael });
  const badVoice = await upload(t, { voiceId: "nonsense", sourceStorageId: await bodyOf(t, topicId, "l1"), storageId: l1Michael });
  for (const res of [asL2, badVoice]) {
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/already another lesson's recording/);
  }
  expect(await blobExists(t, l1Michael)).toBe(true);
  expect(await rowCount(t)).toBe(1);
});

test("a superseded lesson takes no new recording", async () => {
  const t = convexTest(schema, modules);
  const topicId = await seedCourse(t, await user(t, "owner@example.com"));
  const source = await bodyOf(t, topicId, "l1");
  await t.run(async (ctx) => {
    const lesson = await ctx.db
      .query("lessons")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", "l1"))
      .unique();
    await ctx.db.patch(lesson!._id, { supersededBy: "l1b" });
  });
  const storageId = await mp3(t);
  expect((await upload(t, { sourceStorageId: source, storageId })).ok).toBe(false);
  expect(await blobExists(t, storageId)).toBe(false);
});

// ---- retiring the pilot's recordings ---------------------------------------

test("purgeRetired is a dry run until it is told to apply", async () => {
  const t = convexTest(schema, modules);
  const topicId = await seedCourse(t, await user(t, "owner@example.com"));
  const george = await seedRecording(t, topicId, "l1", GEORGE.voiceId, { modelId: GEORGE.modelId });
  expect(await t.mutation(internal.lessonAudio.purgeRetired, {})).toEqual({ retired: 1, applied: false, more: false });
  expect(await rowCount(t)).toBe(1);
  expect(await blobExists(t, george)).toBe(true);
});

test("purgeRetired deletes retired recordings and their files, and nothing current", async () => {
  const t = convexTest(schema, modules);
  const topicId = await seedCourse(t, await user(t, "owner@example.com"));
  const george = await seedRecording(t, topicId, "l1", GEORGE.voiceId, { modelId: GEORGE.modelId });
  const sample = await seedRecording(t, topicId, "l2", MICHAEL, { sampleChars: 600 });
  const oldModel = await seedRecording(t, topicId, "l2", EMMA, { modelId: "kokoro-v0.19" });
  const michael = await seedRecording(t, topicId, "l1", MICHAEL);
  const emma = await seedRecording(t, topicId, "l1", EMMA);
  const body = await bodyOf(t, topicId, "l1");

  expect(await t.mutation(internal.lessonAudio.purgeRetired, { apply: true })).toEqual({ retired: 3, applied: true, more: false });

  for (const gone of [george, sample, oldModel]) expect(await blobExists(t, gone)).toBe(false);
  for (const kept of [michael, emma, body]) expect(await blobExists(t, kept)).toBe(true);
  expect(await rowCount(t)).toBe(2);
});

test("purgeRetired survives a row whose file is already gone", async () => {
  // Deleting a missing blob throws, and a throw would roll back the whole batch.
  const t = convexTest(schema, modules);
  const topicId = await seedCourse(t, await user(t, "owner@example.com"));
  const george = await seedRecording(t, topicId, "l1", GEORGE.voiceId, { modelId: GEORGE.modelId });
  await t.run((ctx) => ctx.storage.delete(george));
  await t.mutation(internal.lessonAudio.purgeRetired, { apply: true });
  expect(await rowCount(t)).toBe(0);
});

// ---- a Guest hears what a Guest can read (2026-11-27) -------------------------
//
// The owner's call: any course with recordings plays them in the public reader
// too. It is still the reader's rule and no new one: `public.publicNarration`
// resolves the Guest exactly as `publicLesson` does (Public link token or the
// course's own URL), so the audio opens and locks with the lesson it narrates.

const guestAsk = (t: T, src: { token?: string; slug?: string }, over: { key?: string; voice?: string } = {}) =>
  t.query(api.public.publicNarration, { ...src, key: over.key ?? "l1", voice: over.voice });

async function openToGuests(t: T, topicId: Id<"topics">, token = "tok") {
  await t.run((ctx) => ctx.db.patch(topicId, { publicToken: token }));
  return token;
}

test("a Guest on a Public link hears a recorded lesson, with both voices on offer", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await recordedCourse(t);
  const token = await openToGuests(t, topicId);
  const res = await guestAsk(t, { token });
  expect(res.eligible).toBe(true);
  expect(res.url).not.toBeNull();
  expect(res.voice).toBe(MICHAEL);
  expect(res.voices).toEqual([MICHAEL, EMMA]);
  expect((await guestAsk(t, { token }, { voice: EMMA })).voice).toBe(EMMA);
});

test("a Guest with no link, a wrong link, or on a course that is not open hears nothing", async () => {
  const t = convexTest(schema, modules);
  await recordedCourse(t);
  // Recorded, but no Public link and not published: the Guest reader is shut.
  expect(await guestAsk(t, { token: "nope" })).toEqual(NOTHING);
  expect(await guestAsk(t, { slug: SLUG })).toEqual(NOTHING);
  expect(await guestAsk(t, {})).toEqual(NOTHING);
});

test("a Guest on the course's own URL hears it once the Edition is published with its Public link on", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await recordedCourse(t);
  await openToGuests(t, topicId);
  await t.run((ctx) => ctx.db.insert("publishedEditions", { topicId, lang: "en", published: true }));
  expect((await guestAsk(t, { slug: SLUG })).eligible).toBe(true);
});

test("a Guest on a paid course hears the free preview lesson and no other", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await recordedCourse(t);
  await seedRecording(t, topicId, "l2", MICHAEL);
  const token = await openToGuests(t, topicId);
  await t.run((ctx) => ctx.db.insert("listings", { topicId, lang: "en", amount: 25000, currency: "zar" }));
  expect((await guestAsk(t, { token }, { key: "l1" })).eligible).toBe(true);
  expect(await guestAsk(t, { token }, { key: "l2" })).toEqual(NOTHING);
});

test("a Guest on a translated Edition's link hears nothing: the recording is English", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await recordedCourse(t);
  await t.run((ctx) => ctx.db.insert("publicLinks", { topicId, lang: "af", token: "af-tok" }));
  expect(await guestAsk(t, { token: "af-tok" })).toEqual(NOTHING);
});

test("a Guest sees no control on an open lesson that has no recording", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await recordedCourse(t);
  const token = await openToGuests(t, topicId);
  expect(await guestAsk(t, { token }, { key: "l2" })).toEqual(NOTHING);
});

// ---- a translated Edition (Hindi, 2026-11-27) ---------------------------------
//
// A translated lesson is narrated once a person has edited it: the Edition
// editor's save makes its body a blob, and a recording pins that blob. The
// machine's untouched inline translation is never narrated.

const [OMEGA, ALPHA] = ["hm_omega", "hf_alpha"];

// The Hindi Edition of the seeded course: l1 edited (a blob), l2 still the
// machine's inline html. Returns l1's Hindi body.
async function hindiEdition(t: T, topicId: Id<"topics">) {
  return await t.run(async (ctx) => {
    const html = await ctx.storage.store(new Blob(["<p>पाठ एक।</p>"], { type: "text/html" }));
    await ctx.db.insert("translations", { topicId, lang: "hi", kind: "lesson", key: "l1", htmlStorageId: html, sourceHash: "h1" });
    await ctx.db.insert("translations", { topicId, lang: "hi", kind: "lesson", key: "l2", html: "<p>पाठ दो।</p>", sourceHash: "h2" });
    return html;
  });
}

const uploadHi = (t: T, args: { lessonKey?: string; voiceId?: string; sourceStorageId: Id<"_storage">; storageId: Id<"_storage"> }) =>
  withSecret(() =>
    t.mutation(api.lessonAudio.saveUpload, {
      secret: SECRET,
      topicSlug: SLUG,
      lessonKey: args.lessonKey ?? "l1",
      lang: "hi",
      voiceId: args.voiceId ?? OMEGA,
      sourceStorageId: args.sourceStorageId,
      storageId: args.storageId,
      chars: 500,
    }),
  );

async function hindiLearner(t: T) {
  const owner = await user(t, "owner@example.com");
  const topicId = await seedCourse(t, owner);
  const hiBody = await hindiEdition(t, topicId);
  const learner = await user(t, "hindi@example.com");
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId: learner, lang: "hi" }));
  return { topicId, hiBody, learner };
}

test("a Hindi holder hears the Hindi recordings of an edited lesson, male first", async () => {
  const t = convexTest(schema, modules);
  const { topicId, hiBody, learner } = await hindiLearner(t);
  await seedRecording(t, topicId, "l1", MICHAEL);
  expect(await uploadHi(t, { sourceStorageId: hiBody, storageId: await mp3(t, "a") })).toEqual({ ok: true });
  expect(await uploadHi(t, { voiceId: ALPHA, sourceStorageId: hiBody, storageId: await mp3(t, "b") })).toEqual({ ok: true });
  expect(await ask(asUser(t, learner))).toMatchObject({ eligible: true, voice: OMEGA, voices: [OMEGA, ALPHA] });
  expect(await ask(asUser(t, learner), { voice: ALPHA })).toMatchObject({ voice: ALPHA });
  // An English voice asked for on the Hindi Edition falls back to its first.
  expect(await ask(asUser(t, learner), { voice: MICHAEL })).toMatchObject({ voice: OMEGA });
});

test("a Hindi recording goes silent when its editor saves the lesson again", async () => {
  const t = convexTest(schema, modules);
  const { topicId, hiBody, learner } = await hindiLearner(t);
  await uploadHi(t, { sourceStorageId: hiBody, storageId: await mp3(t) });
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query("translations")
      .withIndex("by_topic_lang_kind_key", (q) => q.eq("topicId", topicId).eq("lang", "hi").eq("kind", "lesson").eq("key", "l1"))
      .unique();
    const edited = await ctx.storage.store(new Blob(["<p>पाठ एक, संशोधित।</p>"], { type: "text/html" }));
    await ctx.db.patch(row!._id, { htmlStorageId: edited });
  });
  expect(await ask(asUser(t, learner))).toEqual(NOTHING);
});

test("an unedited (machine) Hindi lesson refuses an upload and bins it", async () => {
  const t = convexTest(schema, modules);
  const { topicId } = await hindiLearner(t);
  const storageId = await mp3(t);
  const res = await uploadHi(t, { lessonKey: "l2", sourceStorageId: await bodyOf(t, topicId, "l2"), storageId });
  expect(res.ok).toBe(false);
  expect(await blobExists(t, storageId)).toBe(false);
});

test("an English voice is refused on the Hindi Edition, and a Hindi one on English", async () => {
  const t = convexTest(schema, modules);
  const { topicId, hiBody } = await hindiLearner(t);
  expect((await uploadHi(t, { voiceId: MICHAEL, sourceStorageId: hiBody, storageId: await mp3(t, "a") })).ok).toBe(false);
  expect((await upload(t, { voiceId: OMEGA, sourceStorageId: await bodyOf(t, topicId, "l1"), storageId: await mp3(t, "b") })).ok).toBe(false);
});

test("an English holder never hears the Hindi recording, and the uploader lists each Edition apart", async () => {
  const t = convexTest(schema, modules);
  const { topicId, hiBody } = await hindiLearner(t);
  await uploadHi(t, { sourceStorageId: hiBody, storageId: await mp3(t) });
  const english = await user(t, "english@example.com");
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId: english }));
  expect(await ask(asUser(t, english))).toEqual(NOTHING);
  const hi = await withSecret(() => t.query(api.lessonAudio.uploaded, { secret: SECRET, topicSlug: SLUG, lang: "hi" }));
  const en = await withSecret(() => t.query(api.lessonAudio.uploaded, { secret: SECRET, topicSlug: SLUG }));
  expect(hi).toEqual([{ lessonKey: "l1", voiceId: OMEGA, sourceStorageId: hiBody, chars: 500 }]);
  expect(en).toEqual([]);
});
