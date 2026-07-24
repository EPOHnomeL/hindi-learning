import { convexTest } from "convex-test";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

// Shared fixtures for the content/{reader,authoring,publish}.test.ts split. Not
// itself a .test.ts file, so vitest never tries to run it standalone.
//
// `import.meta.glob` is vite-only syntax Convex's bundler can't analyze, so the
// `modules` glob stays defined locally in each *.test.ts file (which Convex
// excludes from the push bundle) rather than here.

// Sign in as a seeded user. `userId|session` is the subject shape Convex Auth's
// getAuthUserId parses back into the userId.
export function asUser(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|session` });
}

export async function seedUser(t: ReturnType<typeof convexTest>, email: string) {
  return await t.run((ctx) => ctx.db.insert("users", { email }));
}

// A user whose email is on the Allowlist — may create courses (ADR 0021).
export async function seedMember(t: ReturnType<typeof convexTest>, email: string) {
  const userId = await seedUser(t, email);
  await t.mutation(internal.whitelist.seedEmail, { email });
  return userId;
}

export async function seedTopic(t: ReturnType<typeof convexTest>, ownerId: Id<"users">, slug: string, title: string, seq?: number) {
  return await t.run((ctx) => ctx.db.insert("topics", { ownerId, slug, title, seq }));
}
