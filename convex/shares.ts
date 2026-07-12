import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getOwnedTopic, mintToken, normaliseEmail, shareLang, SOURCE_LANG, topicLessonCounts } from "./lib";
import { langInfo } from "./languages";

// Sharing: an owner grants another existing User read-only access to a Topic
// (a Share). The Viewer then sees it in "Shared with me" and reads it through
// the owner-or-Viewer resolver (getViewableTopic). Writes stay owner-only.

// Share a Topic with a person, named by email. Owner-only. If the recipient has
// an account, they get a read-only Share now ("shared"); if not, the invite is
// held as a pending Share ("pending") and claimed when they sign up (see
// `claimPendingShares` — sign-up is open, ADR 0021). Both paths are idempotent.
export const shareTopic = mutation({
  args: { topicSlug: v.string(), email: v.string(), lang: v.optional(v.string()) },
  returns: v.union(v.literal("shared"), v.literal("pending")),
  handler: async (ctx, { topicSlug, email, lang }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("topic not found");
    // Share ONE Edition (course-translation). English is always shareable; a
    // non-English Edition must actually exist (a ready translation job) first.
    const editionLang = lang ?? SOURCE_LANG;
    if (editionLang !== SOURCE_LANG) {
      const job = await ctx.db
        .query("translationJobs")
        .withIndex("by_topic_lang", (q) => q.eq("topicId", topic._id).eq("lang", editionLang))
        .unique();
      if (!job || job.status !== "ready") throw new Error("that language edition isn't ready yet");
    }
    const addr = normaliseEmail(email);
    const viewer = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", addr))
      .unique();
    if (viewer) {
      // Dedup per (Topic, Viewer, Edition) in-memory (a Viewer may hold several
      // Editions; legacy rows carry no `lang`, which an index eq can't match).
      const already = await ctx.db
        .query("shares")
        .withIndex("by_topic_viewer", (q) => q.eq("topicId", topic._id).eq("viewerId", viewer._id))
        .collect();
      if (!already.some((s) => shareLang(s) === editionLang)) {
        await ctx.db.insert("shares", { topicId: topic._id, viewerId: viewer._id, lang: editionLang });
      }
      return "shared";
    }
    // No account yet — hold the invite (for this Edition) until they sign up.
    const existing = await ctx.db
      .query("pendingShares")
      .withIndex("by_topic_email", (q) => q.eq("topicId", topic._id).eq("email", addr))
      .collect();
    if (!existing.some((p) => (p.lang ?? SOURCE_LANG) === editionLang)) {
      await ctx.db.insert("pendingShares", { topicId: topic._id, email: addr, lang: editionLang });
    }
    return "pending";
  },
});

// Turn a Topic's Public link on or off (owner-only). `isPublic: true` always
// mints a *fresh* token — so this serves both "make public" and "regenerate"
// (the old link dies at once); `false` clears it, truly revoking access. Returns
// the new token, or null when made private. (ADR 0013: one token per Topic.)
export const setTopicPublic = mutation({
  args: { topicSlug: v.string(), isPublic: v.boolean() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { topicSlug, isPublic }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("topic not found");
    const publicToken = isPublic ? mintToken() : undefined;
    await ctx.db.patch(topic._id, { publicToken });
    return publicToken ?? null;
  },
});

// Turn a single **Edition's** Public link on/off (owner-only) — the per-language
// form used by the Editions panel. English maps to the legacy per-Topic
// `topics.publicToken` (so existing English links are unchanged); every other
// language gets its own `publicLinks` row/token. `true` always mints fresh (also
// serving "regenerate"); `false` revokes. Returns the new token, or null.
export const setEditionPublic = mutation({
  args: { topicSlug: v.string(), lang: v.string(), isPublic: v.boolean() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { topicSlug, lang, isPublic }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("topic not found");
    if (lang === SOURCE_LANG) {
      const publicToken = isPublic ? mintToken() : undefined;
      await ctx.db.patch(topic._id, { publicToken });
      return publicToken ?? null;
    }
    const existing = await ctx.db
      .query("publicLinks")
      .withIndex("by_topic_lang", (q) => q.eq("topicId", topic._id).eq("lang", lang))
      .unique();
    if (!isPublic) {
      if (existing) await ctx.db.delete(existing._id);
      return null;
    }
    // Publishing a non-English link requires a ready Edition (mirrors shareTopic)
    // — no public link for a language that was never translated, which would just
    // serve English under a foreign-language label.
    const job = await ctx.db
      .query("translationJobs")
      .withIndex("by_topic_lang", (q) => q.eq("topicId", topic._id).eq("lang", lang))
      .unique();
    if (!job || job.status !== "ready") throw new Error("that language edition isn't ready yet");
    const token = mintToken();
    if (existing) await ctx.db.patch(existing._id, { token });
    else await ctx.db.insert("publicLinks", { topicId: topic._id, lang, token });
    return token;
  },
});

// The Topics shared *with* the caller — the "Shared with me" feed. Each card
// carries the owner's email (attribution) and the same live counts as the
// owner's dashboard, so it renders like a CourseCard. Read-only; no writes.
export const listSharedTopics = query({
  args: {},
  returns: v.array(
    v.object({
      slug: v.string(),
      title: v.string(),
      ownerEmail: v.union(v.string(), v.null()),
      mission: v.union(v.string(), v.null()),
      lessonCount: v.number(),
      completedCount: v.number(),
      // The Edition languages this Viewer holds on the Topic (course-translation).
      // A Viewer may hold several; the card shows chips + opens the reader in one.
      langs: v.array(
        v.object({ lang: v.string(), name: v.string(), native: v.string(), rtl: v.boolean() }),
      ),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const shares = await ctx.db
      .query("shares")
      .withIndex("by_viewer", (q) => q.eq("viewerId", userId))
      .collect();
    // A Viewer can now hold several Editions of one Topic — group to one card.
    const byTopic = new Map<Id<"topics">, Set<string>>();
    for (const s of shares) {
      const set = byTopic.get(s.topicId) ?? new Set<string>();
      set.add(shareLang(s));
      byTopic.set(s.topicId, set);
    }
    const cards = await Promise.all(
      [...byTopic.entries()].map(async ([topicId, langSet]) => {
        const topic = await ctx.db.get(topicId);
        if (!topic) return null;
        const owner = topic.ownerId ? await ctx.db.get(topic.ownerId) : null;
        // Counts are the Viewer's own progress on the shared Topic (fresh until
        // they mark lessons), not the owner's.
        const counts = await topicLessonCounts(ctx, topic._id, userId);
        const langList = [...langSet].sort();
        // Show the card title in a language the Viewer actually holds (English if
        // they hold it, else their first Edition) — an English-only Viewer of a
        // Spanish-only share shouldn't see an English title they can't read.
        const preferred = langList.includes(SOURCE_LANG) ? SOURCE_LANG : langList[0]!;
        let title = topic.title;
        if (preferred !== SOURCE_LANG) {
          const t = await ctx.db
            .query("translations")
            .withIndex("by_topic_lang_kind_key", (q) =>
              q.eq("topicId", topic._id).eq("lang", preferred).eq("kind", "title").eq("key", ""),
            )
            .unique();
          if (t?.text) title = t.text;
        }
        return {
          slug: topic.slug,
          title,
          ownerEmail: owner?.email ?? null,
          mission: topic.mission ?? null,
          ...counts,
          langs: langList.map((l) => {
            const i = langInfo(l);
            return {
              lang: l,
              name: l === SOURCE_LANG ? "English" : i.name,
              native: l === SOURCE_LANG ? "English" : i.native,
              rtl: l === SOURCE_LANG ? false : !!i.rtl,
            };
          }),
        };
      }),
    );
    return cards.filter((c): c is NonNullable<typeof c> => c !== null);
  },
});
