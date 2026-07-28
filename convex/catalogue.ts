import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation } from "./_generated/server";
import { getOwnedTopic, SOURCE_LANG } from "./lib";

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
