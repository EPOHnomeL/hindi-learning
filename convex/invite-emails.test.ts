/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";
import { paletteFromTokens, renderInviteEmail, type Brand } from "./inviteEmail";

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
// Note: the invites feature originally auto-admitted invited emails to the
// Allowlist (ADR 0011's "gate sign-up" model). ADR 0021 opened sign-up and made
// the Allowlist gate course *creation*, so auto-admitting an invitee would grant
// them creation rights. That mechanism (and its tests) were dropped on merge —
// open sign-up + claimPendingShares already gives the invitee access.

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

// ---- issue 14: tenant-aware invite email -----------------------------------

// A tenant light palette with distinctive hexes so the derived slots are easy to
// assert in the rendered markup.
const TENANT_LIGHT = {
  paper: "#101010", card: "#202020", ink: "#303030", soft: "#404040", line: "#505050",
  accent: "#606060", accent2: "#707070", gold: "#808080", hi: "#909090",
  danger: "#a0a0a0", good: "#b0b0b0", "good-b": "#c0c0c0", bad: "#d0d0d0", "bad-b": "#e0e0e0",
};

test("paletteFromTokens maps the light tokens per the ticket (body/muted/faint←soft)", () => {
  expect(paletteFromTokens(TENANT_LIGHT)).toEqual({
    page: "#101010",
    card: "#202020",
    border: "#505050",
    heading: "#303030",
    body: "#404040",
    muted: "#404040",
    faint: "#404040",
    accent: "#606060",
  });
});

test("paletteFromTokens falls back to the default palette for a missing token", () => {
  const p = paletteFromTokens({ accent: "#606060" });
  expect(p.accent).toBe("#606060");
  expect(p.page).toBe("#f5efe6"); // default `page` — paper was absent
});

test("renderInviteEmail with no brand renders the default (house) email", () => {
  const { html } = renderInviteEmail("granted", {
    courseTitle: "Hindi",
    langName: "English",
    inviterEmail: "owner@example.com",
    role: "viewer",
    link: "https://app.example.com/courses/hindi",
  });
  expect(html).toContain("My Course");
  expect(html).toContain("#8a3324"); // default accent
  expect(html).not.toContain("<img"); // text wordmark, not a logo
});

test("renderInviteEmail with a tenant brand carries its name, palette, and logo", () => {
  const brand: Brand = {
    name: "Almighty Warriors",
    colors: paletteFromTokens(TENANT_LIGHT),
    logoUrl: "https://cdn.example.com/logo.png",
  };
  const { html } = renderInviteEmail(
    "granted",
    { courseTitle: "Hindi", langName: "English", inviterEmail: "owner@example.com", role: "viewer", link: "https://x/" },
    brand,
  );
  expect(html).toContain("Almighty Warriors");
  expect(html).toContain("#606060"); // tenant accent
  expect(html).toContain('<img src="https://cdn.example.com/logo.png"');
  expect(html).not.toContain("My Course");
});

test("renderInviteEmail with a tenant brand but no logo falls back to the wordmark", () => {
  const brand: Brand = { name: "Almighty Warriors", colors: paletteFromTokens(TENANT_LIGHT), logoUrl: null };
  const { html } = renderInviteEmail(
    "granted",
    { courseTitle: "Hindi", langName: "English", inviterEmail: "owner@example.com", role: "viewer", link: "https://x/" },
    brand,
  );
  expect(html).toContain("Almighty Warriors");
  expect(html).not.toContain("<img");
});

test("sendInvite renders the tenant brand when a brand is supplied", async () => {
  process.env.RESEND_API_KEY = "re-test";
  process.env.INVITE_FROM_EMAIL = "from@example.com";
  const t = convexTest(schema, modules);
  const fetchMock = stubFetch();

  await t.action(internal.email.sendInvite, {
    ...sendArgs,
    brand: { name: "Almighty Warriors", light: TENANT_LIGHT, logoUrl: "https://cdn.example.com/logo.png" },
  });

  const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
  expect(body.html).toContain("Almighty Warriors");
  expect(body.html).toContain("#606060"); // tenant accent (derived from light tokens)
  expect(body.html).toContain('<img src="https://cdn.example.com/logo.png"');
  expect(body.html).not.toContain("My Course");
  delete process.env.RESEND_API_KEY;
  delete process.env.INVITE_FROM_EMAIL;
});

test("sendInvite renders house branding when no brand is supplied", async () => {
  process.env.RESEND_API_KEY = "re-test";
  process.env.INVITE_FROM_EMAIL = "from@example.com";
  const t = convexTest(schema, modules);
  const fetchMock = stubFetch();

  await t.action(internal.email.sendInvite, sendArgs);

  const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
  expect(body.html).toContain("My Course");
  expect(body.html).not.toContain("<img");
  delete process.env.RESEND_API_KEY;
  delete process.env.INVITE_FROM_EMAIL;
});

test("shareTopic on a tenant-scoped course schedules an invite carrying the tenant brand", async () => {
  process.env.APP_BASE_URL = "https://app.example.com";
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  await seedUser(t, "viewer@example.com");
  const topicId = await seedTopic(t, owner, "hindi", "Hindi");
  const logo = await t.run((ctx) => ctx.storage.store(new Blob(["x"], { type: "image/png" })));
  await t.run((ctx) =>
    ctx.db.insert("tenants", {
      slug: "aw",
      displayName: "Almighty Warriors",
      theme: { light: TENANT_LIGHT, logo },
      flags: { certificates: true, translations: true, publicLinks: true, qa: true, seeding: true },
    }),
  );
  await t.run((ctx) => ctx.db.patch(topicId, { tenantSlug: "aw" }));

  await asUser(t, owner).mutation(api.shares.shareTopic, { topicSlug: "hindi", email: "viewer@example.com" });

  const invites = await scheduledInvites(t);
  const brand = invites[0]!.brand as { name: string; light: Record<string, string>; logoUrl: string | null };
  expect(brand.name).toBe("Almighty Warriors");
  expect(brand.light).toMatchObject({ accent: "#606060" });
  expect(brand.logoUrl).toEqual(expect.stringContaining("http"));
});

test("shareTopic on a default-site course schedules an invite with no brand", async () => {
  process.env.APP_BASE_URL = "https://app.example.com";
  const t = convexTest(schema, modules);
  const owner = await seedUser(t, "owner@example.com");
  await seedUser(t, "viewer@example.com");
  await seedTopic(t, owner, "hindi", "Hindi");

  await asUser(t, owner).mutation(api.shares.shareTopic, { topicSlug: "hindi", email: "viewer@example.com" });

  const invites = await scheduledInvites(t);
  expect(invites[0]!.brand).toBeUndefined();
});
