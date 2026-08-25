import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { SOURCE_LANG, getOwnedTopic, livePublishedLangs } from "./lib";
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
// Tenant scope is **symmetric** and follows the **host being browsed**, passed in
// by the caller (`useTenantSlug()`, resolved server-side from the host — the client
// never parses it): on a subdomain, that tenant's courses; on the default site, only
// the courses with no tenant at all. Never cross-tenant — one indexed `by_tenant`
// read.
//
// It scopes on the host and NOT on `users.tenantSlug` because nothing ever writes
// that field — sign-up (`auth.ts`) inserts `{ email }` alone, and tenant membership
// is recorded on the Allowlist row, not the account. Reading it here made every real
// member's catalogue permanently empty. The host is the only thing that knows which
// site someone is on, and a member may legitimately visit more than one.
//
// A client-supplied slug is safe here: tenancy is a visibility filter and a skin,
// not a hard partition (schema, `tenants`), and a free published Edition already
// reads as a Viewer for any signed-in caller (`grantsFor`), so widening this
// argument reveals nothing that the course URL itself wouldn't.
//
// `price` is the whole acquisition story in one field: **null** means some
// published Edition is free to read, otherwise it is the cheapest published
// Edition's price. Either way the card's action just opens the course — a priced
// Edition lands the reader on its Preview + the existing paygate, so no checkout
// logic is duplicated here. Title and mission are the source language (localising
// them per Edition is the deferred follow-up, PRD non-goals).
export const list = query({
  // `null` is the default site (an absent slug on the topic), not "any tenant".
  args: { tenantSlug: v.union(v.string(), v.null()) },
  returns: v.array(
    v.object({
      slug: v.string(),
      title: v.string(),
      mission: v.union(v.string(), v.null()),
      langs: v.array(v.object({ lang: v.string(), native: v.string(), rtl: v.boolean() })),
      price: v.union(v.object({ amount: v.number(), currency: v.string() }), v.null()),
    }),
  ),
  handler: async (ctx, { tenantSlug }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const topics = await ctx.db
      .query("topics")
      .withIndex("by_tenant", (q) => q.eq("tenantSlug", tenantSlug ?? undefined))
      .collect();
    const cards = [];
    for (const topic of topics) {
      if (topic.ownerId === userId) continue;
      const listed = await livePublishedLangs(ctx, topic._id);
      if (listed.size === 0) continue;
      // **A course the caller already holds is not a course to discover.** Owning it
      // was skipped above; this covers the other three ways in, because a card
      // offering to sell somebody a course already sitting in their own list reads as
      // "your purchase did not count", the same reason the Dashboard filters out a
      // course awaiting an EFT.
      //
      // **Not `heldLangs`, and that distinction is the whole of this check.** A held
      // set includes a FREE PUBLISHED Edition, which everybody signed in "holds", so
      // filtering on it empties the catalogue of exactly the free courses it exists to
      // show. What has to be filtered is the caller's PERSONAL holdings: an
      // Entitlement they bought or were granted, a Share somebody sent them, and a
      // grandfathered Enrollment. Those are the three that survive whatever the owner
      // does next, which is the same set the voucher rail refuses to redeem on top of.
      if (await heldPersonally(ctx, topic._id, userId)) continue;
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

// Does this caller already hold this Topic personally, by any route that is not
// "it happens to be free right now"?
//
// Three reads on three `by_topic_user`-shaped indexes rather than one call into the
// grant walk, because the walk deliberately answers a different question (what may
// this caller READ) and the answer includes a free published Edition. Language is
// ignored on purpose: the catalogue card is one course with its Editions as chips, so
// a caller holding any one of them would otherwise be shown a card whose primary
// action opens the Edition they already have.
async function heldPersonally(ctx: QueryCtx, topicId: Id<"topics">, userId: Id<"users">): Promise<boolean> {
  const entitlement = await ctx.db
    .query("entitlements")
    .withIndex("by_topic_user", (q) => q.eq("topicId", topicId).eq("userId", userId))
    .first();
  if (entitlement) return true;
  const share = await ctx.db
    .query("shares")
    .withIndex("by_topic_viewer", (q) => q.eq("topicId", topicId).eq("viewerId", userId))
    .first();
  if (share) return true;
  const enrollment = await ctx.db
    .query("enrollments")
    .withIndex("by_topic_user", (q) => q.eq("topicId", topicId).eq("userId", userId))
    .first();
  return enrollment !== null;
}
