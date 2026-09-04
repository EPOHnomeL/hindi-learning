import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { SOURCE_LANG } from "./sourceLang";
import { shareLang, shareRole } from "./shareGrants";
import { grantsFor } from "./edition";

// The four Topic resolvers: by slug, and the three that hand back a Topic only if
// the caller may own, read or edit it. (Plain module, no Convex functions
// registered here.) Split out of `lib.ts` by technical-foundation/16. Their
// subject is the Topic row, not the Edition: each returns `Doc<"topics"> | null`,
// and the two that consult the grant walk are consumers of the Edition core
// rather than part of it, so the dependency points one way, into `lib.ts`.

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
  // Holding ANY Edition grants topic-level visibility — a Share, an Entitlement,
  // an enrollment, or a free published Edition all read ≡ a Viewer, and each
  // carries the same knock-on rights (own Progress, Resources, Certificate
  // eligibility). WHICH Edition is resolved separately by `readableLang`, so this
  // is exactly "is the caller's grant walk non-empty?". A caller holding nothing
  // (e.g. a Preview-only visitor to a paid course) gets null here and reaches
  // content only through the reader's resolver, never the owner/Viewer write &
  // capture seams.
  const grants = await grantsFor(ctx, topic._id, userId);
  return grants.size > 0 ? topic : null;
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
