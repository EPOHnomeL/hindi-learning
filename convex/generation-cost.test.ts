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
