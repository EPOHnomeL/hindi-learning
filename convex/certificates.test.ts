/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

// Certificates (ADR 0015, slice 2): a per-(User, Topic) immutable snapshot earned
// when the Topic is `completed` and the caller has completed every non-superseded
// Lesson. Eligibility is derived; issuance is an idempotent claim. Tested at the
// Convex seam, mirroring public/routine/capture test style.

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
  status: "active" | "completed" = "active",
) {
  return await t.run((ctx) => ctx.db.insert("topics", { ownerId, slug, title, status }));
}
async function addLesson(
  t: ReturnType<typeof convexTest>,
  topicId: Id<"topics">,
  key: string,
  seq: number,
  supersededBy?: string,
) {
  await t.run((ctx) => ctx.db.insert("lessons", { topicId, key, seq, title: key, html: "<p>x</p>", supersededBy }));
}
async function complete(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
  topicId: Id<"topics">,
  lessonKey: string,
) {
  await t.run((ctx) => ctx.db.insert("progress", { userId, topicId, lessonKey, status: "completed" }));
}
async function certRows(t: ReturnType<typeof convexTest>, topicId: Id<"topics">, userId: Id<"users">) {
  return await t.run((ctx) =>
    ctx.db
      .query("certificates")
      .withIndex("by_topic_user", (q) => q.eq("topicId", topicId).eq("userId", userId))
      .collect(),
  );
}

test("eligibility needs completed status AND every non-superseded lesson in the caller's progress", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", "active");
  await addLesson(t, topicId, "0001", 1);
  await addLesson(t, topicId, "0002", 2);
  await complete(t, alice, topicId, "0001");
  await complete(t, alice, topicId, "0002");

  // Active but all lessons done → NOT eligible: the course isn't over until it's
  // completed (the buffer-of-one guard).
  expect(await asUser(t, alice).query(api.certificates.myCertificate, { topicSlug: "hindi" })).toMatchObject({
    certificate: null,
    eligible: false,
  });

  // Completing the course flips eligibility on.
  await t.run((ctx) => ctx.db.patch(topicId, { status: "completed" }));
  expect(await asUser(t, alice).query(api.certificates.myCertificate, { topicSlug: "hindi" })).toMatchObject({
    certificate: null,
    eligible: true,
  });
});

test("completed but a lesson unmarked → not eligible; superseded lessons don't block", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", "completed");
  await addLesson(t, topicId, "0001", 1);
  await addLesson(t, topicId, "0002", 2);
  // A superseded lesson the learner never completed must NOT block eligibility.
  await addLesson(t, topicId, "0000", 0, "0001");
  await complete(t, alice, topicId, "0001");

  // 0002 still unmarked → not eligible.
  expect(await asUser(t, alice).query(api.certificates.myCertificate, { topicSlug: "hindi" })).toMatchObject({
    eligible: false,
  });

  await complete(t, alice, topicId, "0002");
  // All non-superseded (0001, 0002) done; the superseded 0000 is ignored → eligible.
  expect(await asUser(t, alice).query(api.certificates.myCertificate, { topicSlug: "hindi" })).toMatchObject({
    eligible: true,
  });
});

test("claimCertificate mints one snapshot row, is idempotent, and refuses the ineligible", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", "completed");
  await addLesson(t, topicId, "0001", 1);
  await addLesson(t, topicId, "0002", 2);

  // Ineligible (no progress yet) → refused.
  await expect(
    asUser(t, alice).mutation(api.certificates.claimCertificate, { topicSlug: "hindi", name: "Alice" }),
  ).rejects.toThrow();

  await complete(t, alice, topicId, "0001");
  await complete(t, alice, topicId, "0002");

  const first = await asUser(t, alice).mutation(api.certificates.claimCertificate, {
    topicSlug: "hindi",
    name: "Alice Kumar",
  });
  expect(first).toMatchObject({ learnerName: "Alice Kumar", courseTitle: "Hindi", lessonCount: 2 });
  expect(typeof first.token).toBe("string");
  expect(first.issuedAt).toBeGreaterThan(0);

  // A second claim returns the SAME row (idempotent) — snapshot unchanged, no dup.
  const second = await asUser(t, alice).mutation(api.certificates.claimCertificate, {
    topicSlug: "hindi",
    name: "Different Name",
  });
  expect(second.token).toBe(first.token);
  expect(second.learnerName).toBe("Alice Kumar");
  expect(await certRows(t, topicId, alice)).toHaveLength(1);
});

test("claimCertificate blank name falls back to the email local-part", async () => {
  const t = convexTest(schema, modules);
  const bob = await seedUser(t, "bob.smith@example.com");
  const topicId = await seedTopic(t, bob, "hindi", "Hindi", "completed");
  await addLesson(t, topicId, "0001", 1);
  await complete(t, bob, topicId, "0001");

  const cert = await asUser(t, bob).mutation(api.certificates.claimCertificate, { topicSlug: "hindi", name: "   " });
  expect(cert.learnerName).toBe("bob.smith");
});

test("owner and a Viewer each earn their own certificate on the same completed topic", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const viewer = await seedUser(t, "viewer@example.com");
  const stranger = await seedUser(t, "stranger@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi", "completed");
  await addLesson(t, topicId, "0001", 1);
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId: viewer }));
  // Each marks their OWN progress complete.
  await complete(t, owner, topicId, "0001");
  await complete(t, viewer, topicId, "0001");

  const oCert = await asUser(t, owner).mutation(api.certificates.claimCertificate, { topicSlug: "hindi", name: "Owner" });
  const vCert = await asUser(t, viewer).mutation(api.certificates.claimCertificate, { topicSlug: "hindi", name: "Viewer" });
  expect(oCert.learnerName).toBe("Owner");
  expect(vCert.learnerName).toBe("Viewer");
  expect(oCert.token).not.toBe(vCert.token); // distinct capability tokens

  // A stranger (no share) has no access at all → null.
  expect(await asUser(t, stranger).query(api.certificates.myCertificate, { topicSlug: "hindi" })).toBeNull();
});

test("a certificate survives reopen + extend + re-complete unchanged (not re-minted)", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", "completed");
  await addLesson(t, topicId, "0001", 1);
  await complete(t, alice, topicId, "0001");

  const cert = await asUser(t, alice).mutation(api.certificates.claimCertificate, { topicSlug: "hindi", name: "Alice" });
  expect(cert.lessonCount).toBe(1);

  // Reopen, add + complete a new lesson, then re-complete the course.
  await asUser(t, alice).mutation(api.content.reopenCourse, { topicSlug: "hindi" });
  await addLesson(t, topicId, "0002", 2);
  await complete(t, alice, topicId, "0002");
  await asUser(t, alice).mutation(api.content.endCourse, { topicSlug: "hindi" });

  // Unchanged: same token + original lessonCount, still a single row.
  const after = await asUser(t, alice).query(api.certificates.myCertificate, { topicSlug: "hindi" });
  expect(after?.certificate).toMatchObject({ token: cert.token, lessonCount: 1 });
  expect(await certRows(t, topicId, alice)).toHaveLength(1);

  // Re-claiming still returns the original.
  const reclaim = await asUser(t, alice).mutation(api.certificates.claimCertificate, { topicSlug: "hindi", name: "New" });
  expect(reclaim.token).toBe(cert.token);
  expect(reclaim.lessonCount).toBe(1);
});

test("publicCertificate returns only the allowlisted achievement fields; a bad/absent token → null", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", "completed");
  await addLesson(t, topicId, "0001", 1);
  await complete(t, alice, topicId, "0001");
  const cert = await asUser(t, alice).mutation(api.certificates.claimCertificate, {
    topicSlug: "hindi",
    name: "Alice Kumar",
  });

  // Anonymous read (no identity) by token returns exactly the achievement.
  const pub = await t.query(api.certificates.publicCertificate, { token: cert.token });
  expect(pub).toEqual({
    learnerName: "Alice Kumar",
    courseTitle: "Hindi",
    issuedAt: cert.issuedAt,
    lessonCount: 1,
    // Edition metadata (course-translation): a certificate earned in the source
    // course reads as English, LTR.
    lang: "en",
    dir: "ltr",
  });
  // The allowlist is exact — never the email, userId, topicId, or the token.
  expect(Object.keys(pub!).sort()).toEqual(["courseTitle", "dir", "issuedAt", "lang", "learnerName", "lessonCount"]);

  // A made-up / empty token reveals nothing — uniform null, no enumeration.
  expect(await t.query(api.certificates.publicCertificate, { token: "not-a-real-token" })).toBeNull();
  expect(await t.query(api.certificates.publicCertificate, { token: "" })).toBeNull();
});
