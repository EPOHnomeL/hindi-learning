import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { getOwnedTopic, livePublishedLangs, SOURCE_LANG } from "./lib";
import { langInfo } from "./languages";

// Course publishing & the tenant catalogue (.scratch/course-publishing/PRD.md, as
// amended — publishing is a per-Edition ROW, not a course status).
//
// "Publish" here means **list this Edition in its tenant's catalogue**, and is
// distinct from the two neighbours it is easy to confuse it with: a **Public
// link** (`shares.setEditionPublic` — an anonymous bearer token) and the
// teach→Hub **publish** push (`content/publish.ts`).

// Mark one Edition of a course published (listed) or not. **Owner-only** — a
// Share, an Editor role or a tenant admin never publishes someone's course; it is
// the owner's decision alone.
//
// Publishing an Edition needs it to actually exist (the English source, or a
// language with a READY translation job — the same gate `setEditionPublic` uses,
// so the catalogue never advertises a language that would serve English).
// Unpublishing is un-gated so an owner can always pull a stranded Edition out of
// the catalogue (mirrors `clearEditionPrice`).
//
// Deliberately NOT gated on the course's `status`: publishing is orthogonal to
// the authoring lifecycle (that was the superseded course-level grain), so an
// owner may list a course that is still `active`.
export const setEditionPublished = mutation({
  args: { topicSlug: v.string(), lang: v.string(), published: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { topicSlug, lang, published }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("topic not found");
    if (published && lang !== SOURCE_LANG) {
      const job = await ctx.db
        .query("translationJobs")
        .withIndex("by_topic_lang", (q) => q.eq("topicId", topic._id).eq("lang", lang))
        .unique();
      if (!job || job.status !== "ready") throw new Error("that language edition isn't ready yet");
    }
    const existing = await ctx.db
      .query("publishedEditions")
      .withIndex("by_topic_lang", (q) => q.eq("topicId", topic._id).eq("lang", lang))
      .unique();
    if (existing) await ctx.db.patch(existing._id, { published });
    // No row is the unlisted state, so unpublishing an Edition that was never
    // published writes nothing.
    else if (published) await ctx.db.insert("publishedEditions", { topicId: topic._id, lang, published });
    return null;
  },
});

// The signed-in home's **available courses**: every published course in the
// member's own tenant, minus the ones they already own (those are their library).
// Nothing else is filtered out — a free published Edition already reads as a
// Viewer (lib.ts), so there is no join step to gate the card on.
//
// Tenant scope is **symmetric**, taken from the signed-in member's own
// `tenantSlug`: a subdomain member sees that subdomain's courses; a default-site
// member sees only the courses with no tenant at all. Never cross-tenant — one
// indexed `by_tenant` read, and a member belongs to exactly one site.
//
// `price` is the whole acquisition story in one field: **null** means some
// published Edition is free to read, otherwise it is the cheapest published
// Edition's price. Either way the card's action just opens the course — a priced
// Edition lands the reader on its Preview + the existing paygate, so no checkout
// logic is duplicated here. Title and mission are the source language (localising
// them per Edition is the deferred follow-up, PRD non-goals).
export const list = query({
  args: {},
  returns: v.array(
    v.object({
      slug: v.string(),
      title: v.string(),
      mission: v.union(v.string(), v.null()),
      langs: v.array(v.object({ lang: v.string(), native: v.string(), rtl: v.boolean() })),
      price: v.union(v.object({ amount: v.number(), currency: v.string() }), v.null()),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const me = await ctx.db.get(userId);
    const topics = await ctx.db
      .query("topics")
      .withIndex("by_tenant", (q) => q.eq("tenantSlug", me?.tenantSlug))
      .collect();
    const cards = [];
    for (const topic of topics) {
      if (topic.ownerId === userId) continue;
      const listed = await livePublishedLangs(ctx, topic._id);
      if (listed.size === 0) continue;
      const prices = await ctx.db
        .query("listings")
        .withIndex("by_topic", (q) => q.eq("topicId", topic._id))
        .collect();
      const priced = prices.filter((p) => listed.has(p.lang));
      const cheapest =
        priced.length === listed.size
          ? priced.reduce((a, b) => (b.amount < a.amount ? b : a))
          : null; // some listed Edition is free
      cards.push({
        slug: topic.slug,
        title: topic.title,
        mission: topic.mission ?? null,
        // English (the source) first, then the translations alphabetically —
        // the order the Editions panel and the reader's switcher already use.
        langs: [...listed]
          .sort((a, b) => (a === SOURCE_LANG ? -1 : b === SOURCE_LANG ? 1 : a.localeCompare(b)))
          .map((lang) => {
            const info = langInfo(lang);
            return { lang, native: info.native, rtl: !!info.rtl };
          }),
        price: cheapest ? { amount: cheapest.amount, currency: cheapest.currency } : null,
      });
    }
    return cards;
  },
});
