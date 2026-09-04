/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeAll, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

// Cost instrumentation (technical-foundation/12): token usage per Routine run,
// recorded on the existing report path, plus the operator-only per-Topic
// aggregate. Measurement only: no billing, no metering.
//
// The honest gap: a run reports usage only if its runtime can. Absent usage
// means UNKNOWN, never zero, so the aggregate says how many runs it could not
// account for rather than pretending they were free.

const modules = import.meta.glob("./**/*.ts");

beforeAll(() => {
  process.env.PUBLISH_SECRET = "test-secret";
});

const secret = "test-secret";

async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}
async function seedTopic(t: ReturnType<typeof convexTest>, ownerId: Id<"users">, slug: string) {
  const topicId = await t.run((ctx) => ctx.db.insert("topics", { ownerId, slug, title: slug }));
  await t.run((ctx) => ctx.db.insert("generation", { topicId, status: "generating", startedAt: 1 }));
  return topicId;
}
function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}
async function seedAdmin(t: ReturnType<typeof convexTest>, email: string) {
  const userId = await seedUser(t, email);
  await t.mutation(internal.whitelist.seedEmail, { email, isAdmin: true });
  return userId;
}
async function runsOf(t: ReturnType<typeof convexTest>, topicId: Id<"topics">) {
  return await t.run((ctx) =>
    ctx.db
      .query("generationRuns")
      .withIndex("by_topic", (q) => q.eq("topicId", topicId))
      .collect(),
  );
}

test("a completed run persists its reported usage against the right Topic", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const hindi = await seedTopic(t, alice, "hindi");
  const spanish = await seedTopic(t, alice, "spanish");

  await t.mutation(api.routine.reportGeneration, {
    secret,
    topicSlug: "hindi",
    outcome: "published",
    usage: { inputTokens: 1200, outputTokens: 340, model: "z-ai/glm-5.3-flash" },
  });

  const [run] = await runsOf(t, hindi);
  expect(run).toMatchObject({
    outcome: "published",
    inputTokens: 1200,
    outputTokens: 340,
    model: "z-ai/glm-5.3-flash",
  });
  expect(await runsOf(t, spanish)).toEqual([]);
});

test("a run that cannot report usage leaves the fields ABSENT, not zero", async () => {
  const t = convexTest(schema, modules);
  const alice = await seedUser(t, "alice@example.com");
  const hindi = await seedTopic(t, alice, "hindi");

  // The claude.ai Routine seam: it reports an outcome and no counts.
  await t.mutation(api.routine.reportGeneration, { secret, topicSlug: "hindi", outcome: "published" });

  const [run] = await runsOf(t, hindi);
  expect(run.inputTokens).toBeUndefined();
  expect(run.outputTokens).toBeUndefined();
  expect(run.model).toBeUndefined();
});

test("tokenUsageByTopic sums a Topic's runs and counts the ones it cannot account for", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");
  const hindi = await seedTopic(t, admin, "hindi");
  await seedTopic(t, admin, "spanish");

  await t.mutation(api.routine.reportGeneration, {
    secret,
    topicSlug: "hindi",
    outcome: "published",
    usage: { inputTokens: 1000, outputTokens: 200, model: "z-ai/glm-5.3-flash" },
  });
  await t.mutation(api.routine.reportGeneration, {
    secret,
    topicSlug: "hindi",
    outcome: "published",
    usage: { inputTokens: 500, outputTokens: 100, model: "z-ai/glm-5.3-flash" },
  });
  // A third run on the same Topic with no counts at all.
  await t.mutation(api.routine.reportGeneration, { secret, topicSlug: "hindi", outcome: "nothing" });
  // Another Topic's run must not leak into Hindi's total.
  await t.mutation(api.routine.reportGeneration, {
    secret,
    topicSlug: "spanish",
    outcome: "published",
    usage: { inputTokens: 7, outputTokens: 7, model: "other/model" },
  });

  const rows = await asUser(t, admin).query(api.routine.tokenUsageByTopic, {});
  const hindiRow = rows.find((r) => r.topicSlug === "hindi");
  expect(hindiRow).toEqual({
    topicSlug: "hindi",
    topicTitle: "hindi",
    inputTokens: 1500,
    outputTokens: 300,
    runs: 3,
    runsWithoutUsage: 1,
    models: ["z-ai/glm-5.3-flash"],
  });
  expect(rows.find((r) => r.topicSlug === "spanish")).toMatchObject({ inputTokens: 7, runsWithoutUsage: 0 });
});

test("tokenUsageByTopic is Admin-only", async () => {
  const t = convexTest(schema, modules);
  const user = await seedUser(t, "u@example.com");
  await expect(asUser(t, user).query(api.routine.tokenUsageByTopic, {})).rejects.toThrow();
  await expect(t.query(api.routine.tokenUsageByTopic, {})).rejects.toThrow();
});
