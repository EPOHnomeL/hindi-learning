/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { isEmailAdmitted } from "./whitelist";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

afterEach(() => vi.unstubAllGlobals());

function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}
async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}
async function seedTopic(t: ReturnType<typeof convexTest>, ownerId: Id<"users">, slug: string, title: string) {
  return await t.run((ctx) => ctx.db.insert("topics", { ownerId, slug, title, status: "active" }));
}
const admitted = (t: ReturnType<typeof convexTest>, email: string) =>
  t.run((ctx) => isEmailAdmitted(ctx, email));

// ---- issue 01: auto-admit invited emails to the Allowlist -------------------

test("inviting a no-account email admits it to the Allowlist (so they can sign up)", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  await seedTopic(t, owner, "hindi", "Hindi");

  expect(await admitted(t, "future@example.com")).toBe(false);
  await asUser(t, owner).mutation(api.shares.shareTopic, { topicSlug: "hindi", email: "Future@Example.com" });
  expect(await admitted(t, "future@example.com")).toBe(true);
});

test("inviting an existing user also admits their email (harmless, idempotent)", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  await seedUser(t, "viewer@example.com");
  await seedTopic(t, owner, "hindi", "Hindi");

  await asUser(t, owner).mutation(api.shares.shareTopic, { topicSlug: "hindi", email: "viewer@example.com" });
  expect(await admitted(t, "viewer@example.com")).toBe(true);
});

test("auto-admit is idempotent — re-inviting adds no second Allowlist row", async () => {
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  await seedTopic(t, owner, "hindi", "Hindi");

  await asUser(t, owner).mutation(api.shares.shareTopic, { topicSlug: "hindi", email: "future@example.com" });
  await asUser(t, owner).mutation(api.shares.shareTopic, { topicSlug: "hindi", email: "Future@example.com" });

  const rows = await t.run((ctx) =>
    ctx.db.query("whitelist").withIndex("by_email", (q) => q.eq("email", "future@example.com")).collect(),
  );
  expect(rows.length).toBe(1);
});

// ---- issue 02: Resend sender action ----------------------------------------

const sendArgs = {
  to: "recipient@example.com",
  kind: "granted" as const,
  courseTitle: "Hindi 101",
  langName: "English",
  inviterEmail: "owner@example.com",
  role: "viewer" as const,
  link: "https://app.example.com/courses/hindi",
};

function stubFetch(status = 200) {
  const mock = vi.fn(async () => new Response(JSON.stringify({ id: "re_123" }), { status }));
  vi.stubGlobal("fetch", mock);
  return mock;
}

test("sendInvite POSTs the rendered email to Resend when env is set", async () => {
  process.env.RESEND_API_KEY = "re-test";
  process.env.INVITE_FROM_EMAIL = "Y-Knot <from@example.com>";
  const t = convexTest(schema, modules);
  const fetchMock = stubFetch();

  await t.action(internal.email.sendInvite, sendArgs);

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0]!;
  expect(url).toBe("https://api.resend.com/emails");
  expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re-test");
  const body = JSON.parse(init.body as string);
  expect(body.to).toEqual(["recipient@example.com"]);
  expect(body.from).toBe("Y-Knot <from@example.com>");
  expect(body.subject).toContain("Hindi 101");
  delete process.env.RESEND_API_KEY;
  delete process.env.INVITE_FROM_EMAIL;
});

test("sendInvite no-ops (no fetch, no throw) when RESEND_API_KEY is unset", async () => {
  delete process.env.RESEND_API_KEY;
  process.env.INVITE_FROM_EMAIL = "from@example.com";
  const t = convexTest(schema, modules);
  const fetchMock = stubFetch();

  await expect(t.action(internal.email.sendInvite, sendArgs)).resolves.toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
  delete process.env.INVITE_FROM_EMAIL;
});

test("sendInvite swallows a non-2xx Resend response (best-effort)", async () => {
  process.env.RESEND_API_KEY = "re-test";
  process.env.INVITE_FROM_EMAIL = "from@example.com";
  const t = convexTest(schema, modules);
  stubFetch(500);

  await expect(t.action(internal.email.sendInvite, sendArgs)).resolves.toBeNull();
  delete process.env.RESEND_API_KEY;
  delete process.env.INVITE_FROM_EMAIL;
});

// ---- issue 03: wire triggers ----------------------------------------------

// The sendInvite payloads scheduled so far (best-effort, via runAfter(0)).
async function scheduledInvites(t: ReturnType<typeof convexTest>) {
  const rows = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return rows
    .filter((r) => String(r.name).includes("sendInvite"))
    .map((r) => r.args[0] as Record<string, unknown>);
}

test("shareTopic to an existing user schedules a 'granted' email with the deep link", async () => {
  process.env.APP_BASE_URL = "https://app.example.com";
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  await seedUser(t, "viewer@example.com");
  await seedTopic(t, owner, "hindi", "Hindi");

  await asUser(t, owner).mutation(api.shares.shareTopic, { topicSlug: "hindi", email: "viewer@example.com" });

  const invites = await scheduledInvites(t);
  expect(invites.length).toBe(1);
  expect(invites[0]).toMatchObject({
    to: "viewer@example.com",
    kind: "granted",
    courseTitle: "Hindi",
    langName: "English",
    inviterEmail: "owner@example.com",
    role: "viewer",
    link: "https://app.example.com/courses/hindi",
  });
});

test("shareTopic to a no-account email schedules an 'invited' email with the sign-up link", async () => {
  process.env.APP_BASE_URL = "https://app.example.com";
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  await seedTopic(t, owner, "hindi", "Hindi");

  await asUser(t, owner).mutation(api.shares.shareTopic, { topicSlug: "hindi", email: "future@example.com" });

  const invites = await scheduledInvites(t);
  expect(invites.length).toBe(1);
  expect(invites[0]).toMatchObject({
    to: "future@example.com",
    kind: "invited",
    link: "https://app.example.com/",
  });
});

test("a non-English Edition invite carries ?lang= and the language name", async () => {
  process.env.APP_BASE_URL = "https://app.example.com";
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  await seedUser(t, "viewer@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi");
  await t.run((ctx) =>
    ctx.db.insert("translationJobs", { topicId, lang: "af", status: "ready", total: 1, done: 1, failed: 0 }),
  );

  await asUser(t, owner).mutation(api.shares.shareTopic, { topicSlug: "hindi", email: "viewer@example.com", lang: "af" });

  const invites = await scheduledInvites(t);
  expect(invites[0]).toMatchObject({
    langName: "Afrikaans",
    link: "https://app.example.com/courses/hindi?lang=af",
  });
});

test("promoting an accepted Share schedules a 'role-changed' email with the new role", async () => {
  process.env.APP_BASE_URL = "https://app.example.com";
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const viewer = await seedUser(t, "viewer@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi");
  // Seed the accepted Share directly so only setShareRole schedules an email.
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId: viewer, lang: "en" }));

  await asUser(t, owner).mutation(api.shares.setShareRole, {
    topicSlug: "hindi",
    email: "viewer@example.com",
    lang: "en",
    role: "editor",
  });

  const invites = await scheduledInvites(t);
  expect(invites.length).toBe(1);
  expect(invites[0]).toMatchObject({
    to: "viewer@example.com",
    kind: "role-changed",
    role: "editor",
    link: "https://app.example.com/courses/hindi",
  });
});

test("a role change on a PENDING invite schedules no email", async () => {
  process.env.APP_BASE_URL = "https://app.example.com";
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi");
  await t.run((ctx) => ctx.db.insert("pendingShares", { topicId, email: "future@example.com", lang: "en" }));

  await asUser(t, owner).mutation(api.shares.setShareRole, {
    topicSlug: "hindi",
    email: "future@example.com",
    lang: "en",
    role: "editor",
  });

  expect(await scheduledInvites(t)).toEqual([]);
});

test("revokeShare schedules no email", async () => {
  process.env.APP_BASE_URL = "https://app.example.com";
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  const viewer = await seedUser(t, "viewer@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi");
  await t.run((ctx) => ctx.db.insert("shares", { topicId, viewerId: viewer, lang: "en" }));

  await asUser(t, owner).mutation(api.shares.revokeShare, { topicSlug: "hindi", email: "viewer@example.com", lang: "en" });

  expect(await scheduledInvites(t)).toEqual([]);
});
