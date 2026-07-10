import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

// Shared backend helpers. (Plain module — no Convex functions registered here.)

// The source language every course is authored in (the medium the teach skill
// writes). It is the default Edition: `translations` rows exist only for OTHER
// languages, and a Share/pendingShare/Certificate with no `lang` reads as this.
export const SOURCE_LANG = "en";

// A Share's granted Edition language. Legacy Shares (pre course-translation)
// carry no `lang` and grant the English edition.
export function shareLang(s: Doc<"shares">): string {
  return s.lang ?? SOURCE_LANG;
}

// A Share/pendingShare's access level (ADR 0020). Absent reads as "viewer", so
// every pre-Editor row stays read-only — mirrors `shareLang`.
export function shareRole(s: { role?: "viewer" | "editor" }): "viewer" | "editor" {
  return s.role ?? "viewer";
}

// Trim + lower-case — the one email normalisation used everywhere a person is
// named by address (shares, invites), matching how Convex Auth stores
// `users.email` and how the Allowlist stores its rows. Without it a lookup would
// miss on casing/whitespace alone.
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Turn any pending Shares (invites) for a freshly-created account into real
// Shares. Called from the sign-up callback right after the `users` row is
// inserted, so an email invited before it had an account gains read access the
// moment it signs up. Idempotent per (Topic, Viewer): skips a Topic already
// shared, and clears the invite either way.
export async function claimPendingShares(ctx: MutationCtx, userId: Id<"users">, email: string): Promise<void> {
  const pending = await ctx.db
    .query("pendingShares")
    .withIndex("by_email", (q) => q.eq("email", normaliseEmail(email)))
    .collect();
  for (const invite of pending) {
    const lang = invite.lang ?? SOURCE_LANG;
    // Dedup per (Topic, Viewer, Edition): a Viewer may hold several Shares on one
    // Topic (one per language), so match on lang, not just the pair. In-memory —
    // legacy rows carry no `lang`, which an index `.eq` can't match cleanly.
    const existing = await ctx.db
      .query("shares")
      .withIndex("by_topic_viewer", (q) => q.eq("topicId", invite.topicId).eq("viewerId", userId))
      .collect();
    if (!existing.some((s) => shareLang(s) === lang)) {
      // Carry the invite's role (ADR 0020) onto the real Share, so an email
      // pre-set as Editor becomes an Editor the moment it signs up.
      await ctx.db.insert("shares", { topicId: invite.topicId, viewerId: userId, lang, role: shareRole(invite) });
    }
    await ctx.db.delete(invite._id);
  }
}

// A 256-bit URL-safe token (hex) from Web Crypto — the credential a capability
// link carries: a Public link (ADR 0013) or a Certificate link (ADR 0015). Long
// enough that guessing is infeasible, so no rate-limiting is needed.
export function mintToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// A cheap, stable 32-bit string hash (FNV-1a) as hex. Used only to detect
// whether a source item changed since it was last translated (staleness), so a
// re-translate can skip unchanged items — not for security. Synchronous, unlike
// crypto.subtle, so it's usable inside a query/mutation without awaiting.
export function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

// ---- Content blobs (see .scratch/html-blob-storage) -------------------------

// The read shape for a rendered body (Lesson / Reference / translated item): a
// `contentUrl` the client fetches when the body lives in a content blob (all
// source Lessons/References after the narrow step), or an inline `html` string
// for a translated row still stored inline (the translation write-path migration
// is a follow-up). Exactly one is present.
export type ContentBody = { contentUrl: string; html?: undefined } | { contentUrl?: undefined; html: string };

// The absolute URL of the `/content` HTTP route for a stored blob. Built from
// CONVEX_SITE_URL (the deployment's `.convex.site` origin), which Convex injects
// into every function's env. The storageId is an unguessable bearer capability;
// callers only reach this after the query has authorized them.
export function contentUrl(storageId: Id<"_storage">): string {
  const base = process.env.CONVEX_SITE_URL ?? "";
  return `${base}/content?id=${storageId}`;
}

// Resolve a row's body: the `/content` URL for its blob, else an inline `html`
// string (translations still stored inline). Empty inline body when neither.
export function contentBody(row: { htmlStorageId?: Id<"_storage">; html?: string }): ContentBody {
  if (row.htmlStorageId) return { contentUrl: contentUrl(row.htmlStorageId) };
  return { html: row.html ?? "" };
}

// Choose which body to serve for a translatable item: the translated row's when
// it has one (blob or inline html), else the source row's blob (course-translation).
export function pickContentBody(
  translated: { htmlStorageId?: Id<"_storage">; html?: string } | null | undefined,
  source: { htmlStorageId?: Id<"_storage"> },
): ContentBody {
  if (translated && (translated.htmlStorageId || translated.html)) return contentBody(translated);
  return contentBody(source);
}

// Guards the PUBLISH_SECRET-protected mutations the teach CLI / cloud agent call.
export function assertAdmin(secret: string) {
  const expected = process.env.PUBLISH_SECRET;
  if (!expected || secret !== expected) throw new Error("unauthorized");
}

export async function topicBySlug(ctx: QueryCtx, slug: string): Promise<Doc<"topics"> | null> {
  return await ctx.db
    .query("topics")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
}

// A Topic owned by `userId` with this slug, or null. The owner-scoped resolver
// shared by the reader's content and capture queries.
export async function getOwnedTopic(ctx: QueryCtx, userId: Id<"users">, slug: string): Promise<Doc<"topics"> | null> {
  return await ctx.db
    .query("topics")
    .withIndex("by_owner_slug", (q) => q.eq("ownerId", userId).eq("slug", slug))
    .unique();
}

// A Topic this user may *read*: one they own, or one shared with them as a
// Viewer. The read-side sibling of getOwnedTopic — write paths stay owner-only.
// Slug is globally unique today, so we resolve by slug then check access.
export async function getViewableTopic(ctx: QueryCtx, userId: Id<"users">, slug: string): Promise<Doc<"topics"> | null> {
  const topic = await topicBySlug(ctx, slug);
  if (!topic) return null;
  if (topic.ownerId === userId) return topic;
  // Any Share (in any language) grants topic-level visibility; WHICH Edition the
  // Viewer may read is resolved separately by `readableLang`. `.first()` (not
  // `.unique()`): a Viewer can now hold several Shares on one Topic.
  const share = await ctx.db
    .query("shares")
    .withIndex("by_topic_viewer", (q) => q.eq("topicId", topic._id).eq("viewerId", userId))
    .first();
  return share ? topic : null;
}

// A Topic this user may *edit* on one Edition (ADR 0020): one they own, or one
// they hold an editor-Share for on `lang` (default English). The write-side
// sibling of getViewableTopic — the guard for the owner's in-place prose edits.
// Lang is matched in-memory over `by_topic_viewer` (legacy rows carry no `lang`,
// consistent with `viewerLangs`), so an editor-Share for lang X never authorises
// an edit to lang Y.
export async function getEditableTopic(
  ctx: QueryCtx,
  userId: Id<"users">,
  slug: string,
  lang?: string,
): Promise<Doc<"topics"> | null> {
  const topic = await topicBySlug(ctx, slug);
  if (!topic) return null;
  if (topic.ownerId === userId) return topic;
  const editionLang = lang ?? SOURCE_LANG;
  const shares = await ctx.db
    .query("shares")
    .withIndex("by_topic_viewer", (q) => q.eq("topicId", topic._id).eq("viewerId", userId))
    .collect();
  const canEdit = shares.some((s) => shareLang(s) === editionLang && shareRole(s) === "editor");
  return canEdit ? topic : null;
}

// ---- Editions (course-translation) -----------------------------------------

// The Edition languages a Viewer holds on a Topic (from their Shares).
export async function viewerLangs(ctx: QueryCtx, topicId: Id<"topics">, userId: Id<"users">): Promise<Set<string>> {
  const shares = await ctx.db
    .query("shares")
    .withIndex("by_topic_viewer", (q) => q.eq("topicId", topicId).eq("viewerId", userId))
    .collect();
  return new Set(shares.map(shareLang));
}

// The set of Editions the caller may read on a Topic. The owner holds the source
// English edition plus every language with a READY translation job (a generated
// Edition); a Viewer holds the languages their Shares grant; anyone else nothing.
export async function heldLangs(ctx: QueryCtx, topic: Doc<"topics">, userId: Id<"users">): Promise<Set<string>> {
  if (topic.ownerId === userId) {
    const jobs = await ctx.db
      .query("translationJobs")
      .withIndex("by_topic", (q) => q.eq("topicId", topic._id))
      .collect();
    const langs = new Set<string>([SOURCE_LANG]);
    for (const j of jobs) if (j.status === "ready") langs.add(j.lang);
    return langs;
  }
  return await viewerLangs(ctx, topic._id, userId);
}

// Which Edition to actually serve, given the caller's request. Honours
// `requested` only if the caller holds it (you can't self-serve a language by
// editing the URL — it must be shared with you / owned); otherwise falls back to
// the English edition if held, else a deterministic held language; null if the
// caller holds no Edition at all.
export async function readableLang(
  ctx: QueryCtx,
  topic: Doc<"topics">,
  userId: Id<"users">,
  requested?: string | null,
): Promise<string | null> {
  const held = await heldLangs(ctx, topic, userId);
  if (held.size === 0) return null;
  if (requested && held.has(requested)) return requested;
  if (held.has(SOURCE_LANG)) return SOURCE_LANG;
  return [...held].sort()[0]!;
}

// A Topic's live progress counts for a dashboard/Shared-with-me card: how many
// non-superseded Lessons it has, and how many `userId` has completed. Progress is
// per-reader, so the counts are the caller's own — an owner sees their own
// progress; a Viewer sees theirs (fresh on a shared Topic), not the owner's.
export async function topicLessonCounts(
  ctx: QueryCtx,
  topicId: Id<"topics">,
  userId: Id<"users">,
): Promise<{ lessonCount: number; completedCount: number }> {
  const lessons = (
    await ctx.db.query("lessons").withIndex("by_topic_seq", (q) => q.eq("topicId", topicId)).collect()
  ).filter((l) => !l.supersededBy);
  const progress = await ctx.db
    .query("progress")
    .withIndex("by_topic_user_lesson", (q) => q.eq("topicId", topicId).eq("userId", userId))
    .collect();
  const done = new Set(progress.filter((p) => p.status === "completed").map((p) => p.lessonKey));
  return { lessonCount: lessons.length, completedCount: lessons.filter((l) => done.has(l.key)).length };
}
