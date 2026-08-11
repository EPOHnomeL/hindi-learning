import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { query, type QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { buildPaywall, getEditableTopic, paywallValidator, heldLangs, lessonsToc, loadEdition, readLesson, readReference, referencesToc, resolveEdition, SOURCE_LANG, topicBySlug } from "../lib";
import { topicLessonCounts } from "../progressCounts";
import { langInfo } from "../languages";

// Lessons & references. Reader queries are auth-gated and owner-scoped: a Topic
// is resolved by (owner = signed-in user, slug), so one learner never sees
// another's content.

// ---- Editions (course translation) ----------------------------------------

// The Editions the caller may switch between on a Topic (owner: source + every
// ready translation; Viewer: their granted languages), with display metadata.
async function switcherEditions(ctx: QueryCtx, topic: Doc<"topics">, userId: Id<"users">) {
  const held = await heldLangs(ctx, topic, userId);
  return [...held].sort().map((l) => {
    const i = langInfo(l);
    return {
      lang: l,
      name: l === SOURCE_LANG ? "English" : i.name,
      native: l === SOURCE_LANG ? "English" : i.native,
      rtl: l === SOURCE_LANG ? false : !!i.rtl,
    };
  });
}

// The canonical tenant of a course, by its route slug — the one datum the
// cross-host canonical redirect needs (issue 18 / ADR 0022 §3). Public and
// unauthenticated by design: it exposes only which host a course belongs on (its
// tenant label), never any content, and it runs before the reader's own auth-gated
// queries. An unknown slug → `null`, i.e. treated as the default site, so a stale
// or bogus link can never force a redirect toward a course that isn't there.
export const topicTenant = query({
  args: { slug: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { slug }): Promise<string | null> => {
    const topic = await topicBySlug(ctx, slug);
    return topic?.tenantSlug ?? null;
  },
});

// ---- Reader (learner) ------------------------------------------------------

// The signed-in user's Topics, ordered by `seq` (unsequenced last), then age.
export const listTopics = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const topics = await ctx.db
      .query("topics")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    return topics
      .sort((a, b) => (a.seq ?? Infinity) - (b.seq ?? Infinity) || a._creationTime - b._creationTime)
      .map((t) => ({ slug: t.slug, title: t.title, seq: t.seq, status: t.status ?? "active", mission: t.mission ?? null }));
  },
});

// The home dashboard: the signed-in user's Topics as cards, each with its live
// lesson count + how many they've completed (for a progress indicator).
export const dashboard = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const topics = await ctx.db
      .query("topics")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    const cards = await Promise.all(
      topics.map(async (t) => {
        const counts = await topicLessonCounts(ctx, t._id, userId);
        // The soft `~N lessons` estimate (PRD: Estimated lesson count). Owner-only
        // by construction — this query only returns the caller's OWN topics, so it
        // never reaches a Viewer's shared card (listSharedTopics). Shown only while
        // the course is being built (hidden while `seeded` / `completed`) and
        // clamped up to the published count so it never reads below the real total.
        const estimatedLessons =
          t.estimatedLessons !== undefined && t.status !== "seeded" && t.status !== "completed"
            ? Math.max(t.estimatedLessons, counts.lessonCount)
            : null;
        // Ready translation Editions, for the card's language chips (grouping the
        // course's languages together in one place, per the design).
        const jobs = await ctx.db
          .query("translationJobs")
          .withIndex("by_topic", (q) => q.eq("topicId", t._id))
          .collect();
        const editions = jobs
          .filter((j) => j.status === "ready")
          .map((j) => j.lang)
          .sort();
        return {
          slug: t.slug,
          title: t.title,
          status: t.status ?? "active",
          mission: t.mission ?? null,
          // The owner's own Public link token (null when private) — drives the
          // "Public" badge and the SharePanel's link controls. Owner-only query,
          // so this is never exposed to anyone but the owner.
          publicToken: t.publicToken ?? null,
          // The course's owning tenant, at the top level (it was previously only
          // reachable nested inside `courseHeader`'s `publicLink`). Drives the
          // card's tenant pill on the default host, where the catalogue spans
          // every tenant (whitelabel ticket 25). `null` = default-site-only.
          tenantSlug: t.tenantSlug ?? null,
          estimatedLessons,
          editions,
          seq: t.seq,
          creationTime: t._creationTime,
          ...counts,
        };
      }),
    );
    return cards.sort((a, b) => (a.seq ?? Infinity) - (b.seq ?? Infinity) || a.creationTime - b.creationTime);
  },
});

// The reader's per-course header: the Topic's title plus the caller's access
// level ("owner" vs read-only "viewer"). Resolves through the owner-or-Viewer
// gate, so a Viewer gets the title (their owner-only `listTopics` never carries
// the shared Topic) and the UI learns whether to show write controls. `null`
// when signed-out or with no access — the route then renders not-found.
export const courseHeader = query({
  args: { topicSlug: v.string(), lang: v.optional(v.string()) },
  returns: v.union(
    v.null(),
    v.object({
      title: v.string(),
      // The caller's access level to the served Edition (paid marketplace). An
      // `entitled` buyer and an `enrolled` self-joiner (ADR 0023) both read
      // exactly like a `viewer`; a `preview` caller sees only the free first
      // Lesson of a paid Edition (the rest is locked).
      role: v.union(
        v.literal("owner"),
        v.literal("viewer"),
        v.literal("entitled"),
        v.literal("enrolled"),
        v.literal("preview"),
      ),
      // Whether the caller may make the in-place prose edits on the SERVED
      // Edition (ADR 0020): the owner, or an Editor of this `lang`. The reader
      // gates its hover-pencil on this, NOT on `role` — a Viewer of one Edition
      // may be an Editor of another, so edit rights are per-Edition, not per-role.
      canEdit: v.boolean(),
      // The reader reads `status` to switch affordances: `completed` (ADR 0015)
      // hides "Generate next lesson" and shows the owner's Reopen control.
      status: v.union(v.literal("seeded"), v.literal("active"), v.literal("completed")),
      // The Edition actually being served (honours `lang` only if the caller
      // holds it), its text direction, and the Editions they can switch to.
      lang: v.string(),
      dir: v.union(v.literal("ltr"), v.literal("rtl")),
      editions: v.array(
        v.object({ lang: v.string(), name: v.string(), native: v.string(), rtl: v.boolean() }),
      ),
      // The served Edition's mission (translated, English fallback) — pre-fills
      // the edition title/mission edit dialog. Null when the course has none.
      mission: v.union(v.string(), v.null()),
      // Present only for a `preview` caller: the paid Edition's price(s) and
      // which Lesson is the free Preview, so the reader can render the paygate.
      paywall: v.optional(paywallValidator),
      // The course's public `/share/<token>` link when it's publicly shared, else
      // null (reference-cards/03). Drives the per-card share affordance in the reader
      // — only offered when there's a public page a stranger can open. The token is
      // the course identifier (not secret; it's what the Guest reader is keyed on),
      // and `tenantSlug` mints the link on the course's canonical host. Mirrors the
      // certificate's `course` field (certificates.ts).
      publicLink: v.union(v.null(), v.object({ shareToken: v.string(), tenantSlug: v.union(v.null(), v.string()) })),
    }),
  ),
  handler: async (ctx, { topicSlug, lang }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) return null;
    const { lang: effLang, level } = await resolveEdition(ctx, topic, userId, lang ?? null);
    // `level` is now narrowed to the five access roles (the returns validator's
    // union) — the "none" case is not-found above, so `role` is just `level`.
    if (level === "none") return null;
    const role = level;
    // Per-Edition edit capability (ADR 0020), same logic as the edit mutations'
    // guard: owner, or an Editor of the served lang.
    const canEdit = (await getEditableTopic(ctx, userId, topicSlug, effLang)) !== null;
    const ed = loadEdition(ctx, topic, effLang);
    const editions = await switcherEditions(ctx, topic, userId);
    const paywall = level === "preview" ? await buildPaywall(ctx, topic._id, effLang) : undefined;
    return {
      title: await ed.title(),
      mission: await ed.mission(),
      role,
      canEdit,
      status: topic.status ?? "active",
      lang: effLang,
      dir: langInfo(effLang).rtl ? ("rtl" as const) : ("ltr" as const),
      editions,
      paywall,
      // Public link when the course is publicly shared (the legacy per-Topic English
      // Public link, ADR 0013) — same source the certificate share uses.
      publicLink: topic.publicToken
        ? { shareToken: topic.publicToken, tenantSlug: topic.tenantSlug ?? null }
        : null,
    };
  },
});

export const listLessons = query({
  args: { topicSlug: v.string(), lang: v.optional(v.string()) },
  handler: async (ctx, { topicSlug, lang }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) return [];
    // The table of contents is served in full even to a `preview` caller (only
    // the Lesson *bodies* past the Preview are locked); `none` is not-found (a
    // free Edition the caller holds no grant to). Each entry carries the
    // server-computed `locked` verdict, so the nav renders the paygate without
    // re-deriving it from `paywall.previewKey` (architecture-deepening/03).
    const { lang: effLang, level } = await resolveEdition(ctx, topic, userId, lang ?? null);
    if (level === "none") return [];
    return await lessonsToc(ctx, topic, await loadEdition(ctx, topic, effLang).map(["lesson"]), level);
  },
});

export const getLesson = query({
  args: { topicSlug: v.string(), key: v.string(), lang: v.optional(v.string()) },
  handler: async (ctx, { topicSlug, key, lang }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) return null;
    const { lang: effLang, level } = await resolveEdition(ctx, topic, userId, lang ?? null);
    if (level === "none") return null;
    // The artifact fetch + paygate projection lives in the shared reader core
    // (edition-deepening/04); this adapter only resolves the authed principal.
    return await readLesson(ctx, topic, effLang, level, key);
  },
});

export const listReferences = query({
  args: { topicSlug: v.string(), lang: v.optional(v.string()) },
  handler: async (ctx, { topicSlug, lang }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) return [];
    // References are past the Preview, but their titles ride along in the table
    // of contents even for a `preview` caller — each carrying the server-computed
    // `locked` verdict (`referenceLocked`) rather than the nav re-checking the
    // role. `none` is not-found.
    const { lang: effLang, level } = await resolveEdition(ctx, topic, userId, lang ?? null);
    if (level === "none") return [];
    return await referencesToc(ctx, topic, await loadEdition(ctx, topic, effLang).map(["reference"]), level);
  },
});

export const getReference = query({
  args: { topicSlug: v.string(), key: v.string(), lang: v.optional(v.string()) },
  handler: async (ctx, { topicSlug, key, lang }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) return null;
    const { lang: effLang, level } = await resolveEdition(ctx, topic, userId, lang ?? null);
    if (level === "none") return null;
    return await readReference(ctx, topic, effLang, level, key);
  },
});
