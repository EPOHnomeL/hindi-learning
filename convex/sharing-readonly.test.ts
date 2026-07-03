/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

// Read-only Viewers (topic-sharing issues 02–05): a Viewer reads the owner's
// Resources, Mission, and Questions/Replies, but those writes are refused
// server-side. Progress is the exception — a Viewer tracks their OWN, starting
// clean on a shared Topic. Exercised at the Convex function seam, like shares.test.ts.

const modules = import.meta.glob("./**/*.ts");

function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}

async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}

async function seedTopic(
  t: ReturnType<typeof convexTest>,
  ownerId: Id<"users">,
  slug: string,
  title: string,
  mission?: string,
) {
  return await t.run((ctx) => ctx.db.insert("topics", { ownerId, slug, title, status: "active", mission }));
}

// A shared Topic with one Lesson, shared owner → viewer. The common fixture.
async function sharedFixture(t: ReturnType<typeof convexTest>, mission?: string) {
  const owner = await seedUser(t, "owner@example.com");
  const viewer = await seedUser(t, "viewer@example.com");
  const stranger = await seedUser(t, "stranger@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi", mission);
  await t.run((ctx) => ctx.db.insert("lessons", { topicId, key: "0001-a", seq: 1, title: "A", html: "<p>a</p>" }));
  await asUser(t, owner).mutation(api.shares.shareTopic, { topicSlug: "hindi", email: "viewer@example.com" });
  return { owner, viewer, stranger, topicId };
}

// ---- courseHeader: the reader's title + role signal ------------------------

test("courseHeader reports the role: owner, viewer, or null for a stranger", async () => {
  const t = convexTest(schema, modules);
  const { owner, viewer, stranger } = await sharedFixture(t);

  expect(await asUser(t, owner).query(api.content.courseHeader, { topicSlug: "hindi" })).toEqual({
    title: "Hindi",
    role: "owner",
  });
  expect(await asUser(t, viewer).query(api.content.courseHeader, { topicSlug: "hindi" })).toEqual({
    title: "Hindi",
    role: "viewer",
  });
  // A non-Viewer can't even learn the Topic's title (private Topics don't leak).
  expect(await asUser(t, stranger).query(api.content.courseHeader, { topicSlug: "hindi" })).toBeNull();
});

// ---- 02: Resources, read-only for Viewers ----------------------------------

test("a Viewer reads the owner's Resources but cannot add any", async () => {
  const t = convexTest(schema, modules);
  const { owner, viewer, topicId } = await sharedFixture(t);
  await t.run((ctx) =>
    ctx.db.insert("resources", {
      topicId,
      ownerId: owner,
      filename: "Handbook",
      url: "https://example.com/handbook",
      contentHash: "https://example.com/handbook",
      status: "ready",
      kind: "url",
    }),
  );

  // Read: the Viewer sees the owner's Resource with its open link.
  const seen = await asUser(t, viewer).query(api.resources.listResources, { topicSlug: "hindi" });
  expect(seen).toMatchObject([{ filename: "Handbook", url: "https://example.com/handbook", kind: "url" }]);

  // Write: the Viewer can't add a link or a file resource.
  await expect(
    asUser(t, viewer).mutation(api.resources.addUrlResource, { topicSlug: "hindi", url: "https://evil.example" }),
  ).rejects.toThrow();
  await expect(
    asUser(t, viewer).mutation(api.resources.addResource, {
      topicSlug: "hindi",
      filename: "x.pdf",
      storageId: "nope" as Id<"_storage">,
    }),
  ).rejects.toThrow();

  // The owner is unaffected: still adds a link.
  await asUser(t, owner).mutation(api.resources.addUrlResource, { topicSlug: "hindi", url: "https://ok.example" });
  const after = await asUser(t, owner).query(api.resources.listResources, { topicSlug: "hindi" });
  expect(after.map((r) => r.url)).toContain("https://ok.example");
});

// ---- 03: Mission, read-only for Viewers ------------------------------------

test("a Viewer sees the owner's Mission on the shared card but cannot edit or rename", async () => {
  const t = convexTest(schema, modules);
  const { viewer } = await sharedFixture(t, "Learn enough Hindi to chat with family.");

  // Read: the Mission rides along on "Shared with me".
  const shared = await asUser(t, viewer).query(api.shares.listSharedTopics, {});
  expect(shared).toMatchObject([{ slug: "hindi", mission: "Learn enough Hindi to chat with family." }]);

  // Write: editing the Mission and renaming the Topic are refused.
  await expect(
    asUser(t, viewer).mutation(api.content.editMission, { topicSlug: "hindi", mission: "hacked" }),
  ).rejects.toThrow();
  await expect(
    asUser(t, viewer).mutation(api.content.renameTopic, { topicSlug: "hindi", title: "Hacked" }),
  ).rejects.toThrow();
});

// ---- 04: Questions, read-only for Viewers ----------------------------------

test("a Viewer reads the owner's Questions and Replies but cannot ask", async () => {
  const t = convexTest(schema, modules);
  const { owner, viewer, topicId } = await sharedFixture(t);
  await t.run((ctx) =>
    ctx.db.insert("questions", {
      userId: owner,
      topicId,
      lessonKey: "0001-a",
      text: "Why the ne postposition?",
      status: "answered",
      reply: "It marks the agent in the perfective.",
    }),
  );

  // Read: the Viewer sees the owner's thread with the reply.
  const seen = await asUser(t, viewer).query(api.capture.myQuestions, { topicSlug: "hindi" });
  expect(seen).toMatchObject([
    { lessonKey: "0001-a", text: "Why the ne postposition?", reply: "It marks the agent in the perfective." },
  ]);

  // Write: the Viewer can't ask a Question on the owner's Topic.
  await expect(
    asUser(t, viewer).mutation(api.capture.askQuestion, { topicSlug: "hindi", lessonKey: "0001-a", text: "mine?" }),
  ).rejects.toThrow();

  // And asking never leaked into the owner's thread.
  const ownerThread = await asUser(t, owner).query(api.capture.myQuestions, { topicSlug: "hindi" });
  expect(ownerThread).toHaveLength(1);
});

// ---- 05: Progress, per-Viewer (their own, starting clean) ------------------

test("a Viewer tracks their own Progress, starting clean and independent of the owner's", async () => {
  const t = convexTest(schema, modules);
  const { owner, viewer } = await sharedFixture(t);
  await asUser(t, owner).mutation(api.capture.setProgress, { topicSlug: "hindi", lessonKey: "0001-a", status: "completed" });

  // The Viewer starts clean — the owner's completion is not theirs.
  expect(await asUser(t, viewer).query(api.capture.myProgress, { topicSlug: "hindi" })).toEqual([]);

  // The Viewer marks their own; it's recorded against them, not the owner.
  await asUser(t, viewer).mutation(api.capture.setProgress, { topicSlug: "hindi", lessonKey: "0001-a", status: "completed" });
  expect(await asUser(t, viewer).query(api.capture.myProgress, { topicSlug: "hindi" })).toEqual([
    { lessonKey: "0001-a", status: "completed" },
  ]);

  // The owner's Progress is unchanged by the Viewer's write.
  expect(await asUser(t, owner).query(api.capture.myProgress, { topicSlug: "hindi" })).toEqual([
    { lessonKey: "0001-a", status: "completed" },
  ]);
});

test("a Viewer still cannot record quiz responses or fire authoring", async () => {
  const t = convexTest(schema, modules);
  const { owner, viewer } = await sharedFixture(t);

  // Quiz responses stay owner-only — a Viewer's attempts aren't recorded.
  await expect(
    asUser(t, viewer).mutation(api.capture.recordResponse, {
      topicSlug: "hindi",
      lessonKey: "0001-a",
      quizId: "q1",
      answer: "A",
      correct: true,
    }),
  ).rejects.toThrow();

  // Fire: the Viewer can't trigger the next-lesson Routine or setup on the owner's Topic.
  await expect(asUser(t, viewer).action(api.routine.requestNextLesson, { topicSlug: "hindi" })).rejects.toThrow();
  await expect(asUser(t, viewer).action(api.routine.requestSetup, { topicSlug: "hindi" })).rejects.toThrow();

  // The owner passes the ownership gate (and no-ops because the Frontier isn't
  // completed — so no external fire is attempted).
  const fired = await asUser(t, owner).action(api.routine.requestNextLesson, { topicSlug: "hindi" });
  expect(fired.fired).toBe(false);
});

test("a Viewer completing the Frontier does not open the owner's authoring gate", async () => {
  const t = convexTest(schema, modules);
  const { viewer } = await sharedFixture(t);

  // The Viewer completes the only (Frontier) lesson in their own Progress.
  await asUser(t, viewer).mutation(api.capture.setProgress, { topicSlug: "hindi", lessonKey: "0001-a", status: "completed" });

  // The gate is owner-scoped: a Viewer's completion must never fire authoring.
  const acq = await t.mutation(internal.routine.tryAcquireGeneration, { topicSlug: "hindi" });
  expect(acq).toMatchObject({ acquired: false, reason: "frontier-not-completed" });
});

test("Shared-with-me counts reflect the Viewer's own progress, not the owner's", async () => {
  const t = convexTest(schema, modules);
  const { owner, viewer } = await sharedFixture(t);

  // The owner completes the lesson; the Viewer's card still reads 0/1.
  await asUser(t, owner).mutation(api.capture.setProgress, { topicSlug: "hindi", lessonKey: "0001-a", status: "completed" });
  expect(await asUser(t, viewer).query(api.shares.listSharedTopics, {})).toMatchObject([
    { slug: "hindi", lessonCount: 1, completedCount: 0 },
  ]);

  // Once the Viewer completes it, their card reads 1/1.
  await asUser(t, viewer).mutation(api.capture.setProgress, { topicSlug: "hindi", lessonKey: "0001-a", status: "completed" });
  expect(await asUser(t, viewer).query(api.shares.listSharedTopics, {})).toMatchObject([
    { slug: "hindi", lessonCount: 1, completedCount: 1 },
  ]);
});

// ---- Cross-check: the owner's experience is unchanged ----------------------

test("the owner still reads their own Progress and Questions after sharing", async () => {
  const t = convexTest(schema, modules);
  const { owner } = await sharedFixture(t);
  await asUser(t, owner).mutation(api.capture.setProgress, { topicSlug: "hindi", lessonKey: "0001-a", status: "opened" });
  await asUser(t, owner).mutation(api.capture.askQuestion, { topicSlug: "hindi", lessonKey: "0001-a", text: "mine" });

  expect(await asUser(t, owner).query(api.capture.myProgress, { topicSlug: "hindi" })).toEqual([
    { lessonKey: "0001-a", status: "opened" },
  ]);
  expect(await asUser(t, owner).query(api.capture.myQuestions, { topicSlug: "hindi" })).toMatchObject([
    { lessonKey: "0001-a", text: "mine" },
  ]);
});
