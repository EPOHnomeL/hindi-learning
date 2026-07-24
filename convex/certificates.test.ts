/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeAll, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

// Certificates (ADR 0015, slice 2): a per-(User, Topic) immutable snapshot earned
// when the Topic is `completed` and the caller has completed every non-superseded
// Lesson. Eligibility is derived; issuance is an idempotent claim. Tested at the
// Convex seam, mirroring public/routine/capture test style.
//
// The Emblem (ADR 0017) is exercised here too: the owner-set mutation + gate, the
// claim snapshot + permanence, the fixed fallback order, the widened read
// allowlist, and the AI default riding the secret-guarded completion path.

const modules = import.meta.glob("./**/*.ts");

beforeAll(() => {
  process.env.PUBLISH_SECRET = "test-secret";
});

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
  await t.run((ctx) => ctx.db.insert("lessons", { topicId, key, seq, title: key, supersededBy }));
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
// Store an Emblem image blob of a given content type + byte size (ASCII → 1 byte
// each), exercising `_storage` through `convexTest` exactly as resources.test.ts.
async function storeImage(t: ReturnType<typeof convexTest>, type: string, bytes = 128) {
  return await t.run((ctx) => ctx.storage.store(new Blob(["x".repeat(bytes)], { type })));
}
async function topicRow(t: ReturnType<typeof convexTest>, topicId: Id<"topics">) {
  return (await t.run((ctx) => ctx.db.get(topicId)))!;
}
// Seed a fully-eligible completed course for one learner: a completed Topic with
// one lesson the learner has finished. Returns the topicId.
async function seedEligible(t: ReturnType<typeof convexTest>, userId: Id<"users">, slug = "hindi") {
  const topicId = await seedTopic(t, userId, slug, slug, "completed");
  await addLesson(t, topicId, "0001", 1);
  await complete(t, userId, topicId, "0001");
  return topicId;
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
  await asUser(t, alice).mutation(api.content.authoring.reopenCourse, { topicSlug: "hindi" });
  await addLesson(t, topicId, "0002", 2);
  await complete(t, alice, topicId, "0002");
  await asUser(t, alice).mutation(api.content.authoring.endCourse, { topicSlug: "hindi" });

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

  // Anonymous read (no identity) by token returns exactly the achievement, plus
  // the resolved Emblem — here the generic default glyph, since no Emblem was set.
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
    emblem: { kind: "glyph", glyph: "🎓" },
    // Private course (no public link) → nothing to link the Share button back to.
    course: null,
  });
  // The allowlist is exact — the achievement + Edition metadata + Emblem + the
  // (here null) course link, never the email, userId, topicId, or the token.
  expect(Object.keys(pub!).sort()).toEqual([
    "course",
    "courseTitle",
    "dir",
    "emblem",
    "issuedAt",
    "lang",
    "learnerName",
    "lessonCount",
  ]);

  // A made-up / empty token reveals nothing — uniform null, no enumeration.
  expect(await t.query(api.certificates.publicCertificate, { token: "not-a-real-token" })).toBeNull();
  expect(await t.query(api.certificates.publicCertificate, { token: "" })).toBeNull();
});

test("a course rename shows on an already-issued certificate (live title, not the frozen snapshot)", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  // Created under a placeholder title (the slug's origin), then earned.
  const topicId = await seedTopic(t, alice, "prophetic-school", "Prophetic School", "completed");
  await addLesson(t, topicId, "0001", 1);
  await complete(t, alice, topicId, "0001");
  const cert = await asUser(t, alice).mutation(api.certificates.claimCertificate, {
    topicSlug: "prophetic-school",
    name: "Alice",
  });
  expect(cert.courseTitle).toBe("Prophetic School");

  // The owner renames the course after the certificate was issued (the slug is
  // immutable, so it stays `prophetic-school`).
  await asUser(t, alice).mutation(api.content.authoring.renameTopic, {
    topicSlug: "prophetic-school",
    title: "Growing in your relationship with the Holy Spirit",
  });

  // Both read seams now reflect the current title — no re-mint, one row.
  const mine = await asUser(t, alice).query(api.certificates.myCertificate, { topicSlug: "prophetic-school" });
  expect(mine?.certificate?.courseTitle).toBe("Growing in your relationship with the Holy Spirit");
  const pub = await t.query(api.certificates.publicCertificate, { token: cert.token });
  expect(pub?.courseTitle).toBe("Growing in your relationship with the Holy Spirit");
  expect(await certRows(t, topicId, alice)).toHaveLength(1);
});

test("publicCertificate exposes the course share link only when the course is publicly available", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", "completed");
  await addLesson(t, topicId, "0001", 1);
  await complete(t, alice, topicId, "0001");
  const cert = await asUser(t, alice).mutation(api.certificates.claimCertificate, { topicSlug: "hindi", name: "Alice" });

  // Private course → no course link.
  expect((await t.query(api.certificates.publicCertificate, { token: cert.token }))?.course).toBeNull();

  // Make the course public (a live token) on a tenant → the Share button gets the
  // course's own share token plus its canonical tenant.
  await t.run((ctx) => ctx.db.patch(topicId, { publicToken: "pub-tok-123", tenantSlug: "ywampotch" }));
  expect((await t.query(api.certificates.publicCertificate, { token: cert.token }))?.course).toEqual({
    shareToken: "pub-tok-123",
    tenantSlug: "ywampotch",
  });

  // A default-site course (no tenant) reports a null tenantSlug (apex host).
  await t.run((ctx) => ctx.db.patch(topicId, { tenantSlug: undefined }));
  expect((await t.query(api.certificates.publicCertificate, { token: cert.token }))?.course).toEqual({
    shareToken: "pub-tok-123",
    tenantSlug: null,
  });
});

// ---- Emblem (ADR 0017) -----------------------------------------------------

test("setTopicEmblem (glyph) is owner-only: the owner sets it, a Viewer/non-owner is refused, and it's length-capped", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const viewer = await seedUser(t, "viewer@example.com");
  const stranger = await seedUser(t, "stranger@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi", "completed");
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId: viewer }));

  // A Viewer (has read access) and a stranger are both refused server-side.
  await expect(
    asUser(t, viewer).mutation(api.emblem.setTopicEmblem, { topicSlug: "hindi", emblem: { kind: "glyph", glyph: "🦉" } }),
  ).rejects.toThrow();
  await expect(
    asUser(t, stranger).mutation(api.emblem.setTopicEmblem, { topicSlug: "hindi", emblem: { kind: "glyph", glyph: "🦉" } }),
  ).rejects.toThrow();
  expect((await topicRow(t, topicId)).emblem).toBeUndefined();

  // A pasted paragraph is refused (a glyph is a mark, not a caption).
  await expect(
    asUser(t, owner).mutation(api.emblem.setTopicEmblem, { topicSlug: "hindi", emblem: { kind: "glyph", glyph: "x".repeat(50) } }),
  ).rejects.toThrow();

  // The owner sets it — stored with the owner-set marker.
  await asUser(t, owner).mutation(api.emblem.setTopicEmblem, { topicSlug: "hindi", emblem: { kind: "glyph", glyph: " 🪷 " } });
  expect((await topicRow(t, topicId)).emblem).toMatchObject({ glyph: "🪷", ownerSet: true });
});

test("claiming freezes the Topic's glyph Emblem; changing it afterward leaves the earned Certificate unchanged (permanence)", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedEligible(t, alice);
  await asUser(t, alice).mutation(api.emblem.setTopicEmblem, { topicSlug: "hindi", emblem: { kind: "glyph", glyph: "🪷" } });

  const cert = await asUser(t, alice).mutation(api.certificates.claimCertificate, { topicSlug: "hindi", name: "Alice" });
  expect(cert.emblem).toEqual({ kind: "glyph", glyph: "🪷" });

  // Change the Topic's Emblem after the claim — the earned Certificate keeps its
  // frozen glyph on both read seams.
  await asUser(t, alice).mutation(api.emblem.setTopicEmblem, { topicSlug: "hindi", emblem: { kind: "glyph", glyph: "🎼" } });
  const mine = await asUser(t, alice).query(api.certificates.myCertificate, { topicSlug: "hindi" });
  expect(mine?.certificate?.emblem).toEqual({ kind: "glyph", glyph: "🪷" });
  const pub = await t.query(api.certificates.publicCertificate, { token: cert.token });
  expect(pub?.emblem).toEqual({ kind: "glyph", glyph: "🪷" });
  expect(await certRows(t, topicId, alice)).toHaveLength(1);
});

test("setTopicEmblem (image) is owner-gated, stores same-origin, and rejects SVG + oversize", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const viewer = await seedUser(t, "viewer@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi", "completed");
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId: viewer }));

  // A Viewer is refused an image the same as a glyph (a valid type, so the refusal
  // is the owner gate, not validation).
  const vsid = await storeImage(t, "image/png");
  await expect(
    asUser(t, viewer).mutation(api.emblem.setTopicEmblem, {
      topicSlug: "hindi",
      emblem: { kind: "image", storageId: vsid, contentType: "image/png" },
    }),
  ).rejects.toThrow();

  // SVG is rejected (XSS on the anonymous page); an over-cap raster is rejected too.
  const svg = await storeImage(t, "image/svg+xml");
  await expect(
    asUser(t, owner).mutation(api.emblem.setTopicEmblem, {
      topicSlug: "hindi",
      emblem: { kind: "image", storageId: svg, contentType: "image/svg+xml" },
    }),
  ).rejects.toThrow();
  const big = await storeImage(t, "image/png", 300 * 1024);
  await expect(
    asUser(t, owner).mutation(api.emblem.setTopicEmblem, {
      topicSlug: "hindi",
      emblem: { kind: "image", storageId: big, contentType: "image/png" },
    }),
  ).rejects.toThrow();
  expect((await topicRow(t, topicId)).emblem).toBeUndefined();

  // A valid raster is recorded with the owner-set marker.
  const sid = await storeImage(t, "image/png");
  await asUser(t, owner).mutation(api.emblem.setTopicEmblem, {
    topicSlug: "hindi",
    emblem: { kind: "image", storageId: sid, contentType: "image/png" },
  });
  expect((await topicRow(t, topicId)).emblem).toMatchObject({ imageId: sid, ownerSet: true });
});

test("an image Emblem resolves to a same-origin URL and its blob survives a later Emblem change (immutable)", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedEligible(t, alice);
  const sid = await storeImage(t, "image/png");
  await asUser(t, alice).mutation(api.emblem.setTopicEmblem, {
    topicSlug: "hindi",
    emblem: { kind: "image", storageId: sid, contentType: "image/png" },
  });

  const cert = await asUser(t, alice).mutation(api.certificates.claimCertificate, { topicSlug: "hindi", name: "Alice" });
  expect(cert.emblem.kind).toBe("image");
  if (cert.emblem.kind === "image") expect(cert.emblem.url).toBeTruthy();
  // The frozen reference is the blob we set.
  expect((await certRows(t, topicId, alice))[0]!.emblem).toEqual({ imageId: sid });

  // Replacing the Topic's Emblem mints a new blob and never deletes the old one,
  // so the frozen reference still resolves.
  const sid2 = await storeImage(t, "image/webp");
  await asUser(t, alice).mutation(api.emblem.setTopicEmblem, {
    topicSlug: "hindi",
    emblem: { kind: "image", storageId: sid2, contentType: "image/webp" },
  });
  expect((await topicRow(t, topicId)).emblem).toMatchObject({ imageId: sid2 });
  expect(await t.run((ctx) => ctx.db.system.get(sid))).not.toBeNull(); // old blob retained
  const pub = await t.query(api.certificates.publicCertificate, { token: cert.token });
  expect(pub?.emblem.kind).toBe("image"); // frozen blob still resolves to a URL
});

test("fallback order at read: image wins over glyph wins over the generic default", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const sid = await storeImage(t, "image/png");

  // (a) both image + glyph present → image wins.
  const both = await seedEligible(t, alice, "both");
  await t.run((ctx) => ctx.db.patch(both, { emblem: { imageId: sid, glyph: "🪷" } }));
  const c1 = await asUser(t, alice).mutation(api.certificates.claimCertificate, { topicSlug: "both", name: "A" });
  expect(c1.emblem.kind).toBe("image");

  // (b) only a glyph → glyph.
  const glyphOnly = await seedEligible(t, alice, "glyph-only");
  await t.run((ctx) => ctx.db.patch(glyphOnly, { emblem: { glyph: "🪷" } }));
  const c2 = await asUser(t, alice).mutation(api.certificates.claimCertificate, { topicSlug: "glyph-only", name: "A" });
  expect(c2.emblem).toEqual({ kind: "glyph", glyph: "🪷" });

  // (c) neither → generic default glyph.
  const none = await seedEligible(t, alice, "none");
  void none;
  const c3 = await asUser(t, alice).mutation(api.certificates.claimCertificate, { topicSlug: "none", name: "A" });
  expect(c3.emblem).toEqual({ kind: "glyph", glyph: "🎓" });
});

test("completeCourse records the AI default Emblem (image + glyph), stays secret-guarded", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", "active");
  const sid = await storeImage(t, "image/png");

  // Wrong secret is refused — and (transactional) leaves the Topic untouched.
  await expect(
    t.mutation(api.content.publish.completeCourse, {
      secret: "wrong",
      topicSlug: "hindi",
      emblem: { storageId: sid, contentType: "image/png", glyph: "🪷" },
    }),
  ).rejects.toThrow();
  expect((await topicRow(t, topicId)).status).toBe("active");

  await t.mutation(api.content.publish.completeCourse, {
    secret: "test-secret",
    topicSlug: "hindi",
    emblem: { storageId: sid, contentType: "image/png", glyph: "🪷" },
  });
  const row = await topicRow(t, topicId);
  expect(row.status).toBe("completed");
  // Recorded without the owner-set marker, so a later owner override still wins.
  expect(row.emblem).toEqual({ imageId: sid, glyph: "🪷" });
});

test("completeCourse never overwrites an owner override, regardless of write order", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", "active");

  // Owner sets their glyph first; the AI completion then supplies an image — the
  // owner's choice is preserved (owner → AI precedence, order-independent).
  await asUser(t, alice).mutation(api.emblem.setTopicEmblem, { topicSlug: "hindi", emblem: { kind: "glyph", glyph: "🦉" } });
  const sid = await storeImage(t, "image/png");
  await t.mutation(api.content.publish.completeCourse, {
    secret: "test-secret",
    topicSlug: "hindi",
    emblem: { storageId: sid, contentType: "image/png", glyph: "🤖" },
  });
  expect((await topicRow(t, topicId)).emblem).toEqual({ glyph: "🦉", ownerSet: true });
});

test("an owner-ended completion with no Emblem falls back to the generic default glyph", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const topicId = await seedTopic(t, alice, "hindi", "Hindi", "active");
  await addLesson(t, topicId, "0001", 1);
  await complete(t, alice, topicId, "0001");

  // The owner ends the course from the app (no model, no Emblem supplied).
  await asUser(t, alice).mutation(api.content.authoring.endCourse, { topicSlug: "hindi" });
  const cert = await asUser(t, alice).mutation(api.certificates.claimCertificate, { topicSlug: "hindi", name: "Alice" });
  expect(cert.emblem).toEqual({ kind: "glyph", glyph: "🎓" });
});
