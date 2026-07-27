/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

// The Generation-tab usage graph (.scratch/admin-sales follow-up): daily counts
// of generation runs that did work (published/failed, not idle "nothing") and
// translation jobs started, over a zero-filled day window. Admin-only.

const modules = import.meta.glob("./**/*.ts");
const DAY = 86_400_000;

function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}
async function seedAdmin(t: ReturnType<typeof convexTest>, email: string) {
  const id = await t.run((ctx) => ctx.db.insert("users", { email }));
  await t.run((ctx) => ctx.db.insert("whitelist", { email, isAdmin: true }));
  return id;
}

test("usageByDay is Admin-only", async () => {
  const t = convexTest(schema, modules);
  const user = await t.run((ctx) => ctx.db.insert("users", { email: "u@example.com" }));
  await expect(asUser(t, user).query(api.routine.usageByDay, { from: 0, to: DAY })).rejects.toThrow();
  await expect(t.query(api.routine.usageByDay, { from: 0, to: DAY })).rejects.toThrow();
});

test("buckets by day, counts published+failed (not 'nothing') and translation jobs, zero-filled", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");
  const topicId = await t.run((ctx) =>
    ctx.db.insert("topics", { ownerId: admin, slug: "hindi", title: "Hindi", status: "completed" as const }),
  );

  const run = (outcome: "published" | "nothing" | "failed") =>
    t.run((ctx) => ctx.db.insert("generationRuns", { topicId, outcome, startedAt: 0, endedAt: 0 }));
  await run("published");
  await run("published");
  await run("failed");
  await run("nothing"); // idle poll — must be excluded
  const job = (lang: string) =>
    t.run((ctx) =>
      ctx.db.insert("translationJobs", { topicId, lang, status: "ready" as const, total: 3, done: 3, failed: 0 }),
    );
  await job("es");
  await job("ur");

  // Everything shares one frozen creation time; derive its UTC day.
  const anyRun = await t.run((ctx) => ctx.db.query("generationRuns").first());
  const dayMs = Math.floor(anyRun!._creationTime / DAY) * DAY;

  // A 3-day window ending on the active day: two empty days, then the counts.
  const rows = await asUser(t, admin).query(api.routine.usageByDay, { from: dayMs - 2 * DAY, to: dayMs + DAY });
  expect(rows).toEqual([
    { dayMs: dayMs - 2 * DAY, generation: 0, translation: 0 },
    { dayMs: dayMs - DAY, generation: 0, translation: 0 },
    { dayMs, generation: 3, translation: 2 }, // 2 published + 1 failed; 'nothing' excluded
  ]);
});

test("empty or inverted windows return []", async () => {
  const t = convexTest(schema, modules);
  const admin = await seedAdmin(t, "admin@example.com");
  expect(await asUser(t, admin).query(api.routine.usageByDay, { from: 5 * DAY, to: 5 * DAY })).toEqual([]);
  expect(await asUser(t, admin).query(api.routine.usageByDay, { from: 9 * DAY, to: 2 * DAY })).toEqual([]);
});
