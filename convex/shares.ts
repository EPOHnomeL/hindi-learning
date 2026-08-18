import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { getOwnedTopic, loadEdition, mintToken, normaliseEmail, shareLang, shareRole, SOURCE_LANG } from "./lib";
import { assertTenantFlag } from "./tenantFlags";
import { topicLessonCounts } from "./progressCounts";
import { langInfo } from "./languages";
import { appUrl } from "./payfast";
import type { InviteKind } from "./inviteEmail";

// Schedule a best-effort invite email (see .scratch/invite-emails) after the
// mutation commits, so a slow/failing send never blocks the invite. `granted` /
// `role-changed` deep-link into the Edition; `invited` links to sign-up (the
// recipient has no account yet). The link rides the course's canonical host via
// `appUrl` — the tenant subdomain when the course is tenanted (issue 12), else
// SITE_URL (which appUrl requires — provision it in tests that hit this path).
async function scheduleInvite(
  ctx: MutationCtx,
  opts: { to: string; kind: InviteKind; topic: Doc<"topics">; editionLang: string; inviterEmail: string; role: "viewer" | "editor" },
): Promise<void> {
  const { to, kind, topic, editionLang, inviterEmail, role } = opts;
  const path =
    kind === "invited"
      ? "/"
      : editionLang === SOURCE_LANG
        ? `/courses/${topic.slug}`
        : `/courses/${topic.slug}?lang=${encodeURIComponent(editionLang)}`;
  const link = appUrl(path, topic.tenantSlug);
  await ctx.scheduler.runAfter(0, internal.email.sendInvite, {
    to,
    kind,
    courseTitle: topic.title,
    langName: editionLang === SOURCE_LANG ? "English" : langInfo(editionLang).name,
    inviterEmail,
    role,
    link,
    // The invite carries the shared course's tenant brand (whitelabel issue 14).
    // The owner owns the topic, so its `tenantSlug` is the inviter's tenant (ADR
    // 0021); absent = default site → the action renders the house-branded email.
    brand: await tenantBrand(ctx, topic.tenantSlug),
  });
}

// Resolve a tenant's invite-email brand from its slug (whitelabel issue 14): the
// `displayName`, the raw **light** theme tokens (the email action derives its
// palette from them), and the logo's absolute URL (null when unset → wordmark).
// The same one-row `by_slug` read `tenants.getTheme` uses; returns `undefined`
// for the default site (no slug / unknown slug), so the invite stays house-branded.
async function tenantBrand(
  ctx: MutationCtx,
  slug: string | undefined,
): Promise<{ name: string; light: Record<string, string>; logoUrl: string | null } | undefined> {
  if (!slug) return undefined;
  const tenant = await ctx.db
    .query("tenants")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
  if (!tenant) return undefined;
  return {
    name: tenant.displayName,
    light: tenant.theme.light,
    logoUrl: tenant.theme.logo ? await ctx.storage.getUrl(tenant.theme.logo) : null,
  };
}

// Sharing: an owner grants another existing User read-only access to a Topic
// (a Share). The Viewer then sees it in "Shared with me" and reads it through
// the owner-or-Viewer resolver (getViewableTopic). Writes stay owner-only.

// Share a Topic with a person, named by email. Owner-only. If the recipient has
// an account, they get a read-only Share now ("shared"); if not, the invite is
// held as a pending Share ("pending") and claimed when they sign up (see
// `claimPendingShares` — sign-up is open, ADR 0021, so no Allowlist admission
// is needed for the invitee to join). Both paths are idempotent, and each
// schedules a best-effort invite email (see .scratch/invite-emails).
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
    const inviter = await ctx.db.get(userId);
    const inviterEmail = inviter?.email ?? "";
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
      // Email on every invite (incl. re-invites → re-sends). The account exists,
      // so deep-link into the Edition. Invites grant view access.
      await scheduleInvite(ctx, { to: addr, kind: "granted", topic, editionLang, inviterEmail, role: "viewer" });
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
    // Email on every invite. No account → link to sign-up (open under ADR 0021;
    // claimPendingShares grants access the moment they sign up).
    await scheduleInvite(ctx, { to: addr, kind: "invited", topic, editionLang, inviterEmail, role: "viewer" });
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
    // Whitelabel: minting a public link is a create-side act — gated by the
    // tenant's `publicLinks` flag. Revoking (`isPublic: false`) stays allowed so
    // an existing link can always be turned off (frozen, not revoked — issue 17).
    if (isPublic) await assertTenantFlag(ctx, topic.tenantSlug, "publicLinks");
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
    // Same create-side gate as setTopicPublic: publishing a link needs the
    // tenant's `publicLinks` flag; revoking is always allowed (issue 17).
    if (isPublic) await assertTenantFlag(ctx, topic.tenantSlug, "publicLinks");
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

// ---- Owner access management (edition-editor-rights issue 03) --------------

// The access roster for one Edition (ADR 0020): everyone the owner has granted
// access to on `(topic, lang)` — accepted Shares (joined to the person's email)
// and pending invites (an email with no account yet) — each with its role. The
// first owner-facing "who has access" surface. Owner-only via getOwnedTopic, so
// a non-owner is rejected before any row is read. Lang is matched in-memory over
// `by_topic` (legacy rows carry no `lang`), matching shareTopic.
export const listEditionAccess = query({
  args: { topicSlug: v.string(), lang: v.string() },
  returns: v.array(
    v.object({
      email: v.string(),
      role: v.union(v.literal("viewer"), v.literal("editor")),
      status: v.union(v.literal("accepted"), v.literal("pending")),
    }),
  ),
  handler: async (ctx, { topicSlug, lang }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("topic not found");

    const shares = (
      await ctx.db.query("shares").withIndex("by_topic", (q) => q.eq("topicId", topic._id)).collect()
    ).filter((s) => shareLang(s) === lang);
    const accepted = await Promise.all(
      shares.map(async (s) => {
        const user = await ctx.db.get(s.viewerId);
        return { email: user?.email ?? "", role: shareRole(s), status: "accepted" as const };
      }),
    );

    const pending = (
      await ctx.db.query("pendingShares").withIndex("by_topic", (q) => q.eq("topicId", topic._id)).collect()
    )
      .filter((p) => (p.lang ?? SOURCE_LANG) === lang)
      .map((p) => ({ email: p.email, role: shareRole(p), status: "pending" as const }));

    return [...accepted, ...pending];
  },
});

// Set a person's role on one Edition (ADR 0020) — the owner promoting a Viewer to
// Editor or demoting back. Owner-only. Patches the matching accepted Share for
// `(topic, person, lang)` if one exists, else the matching pending invite;
// throws if neither does (nothing to set). Idempotent. Lang matched in-memory.
export const setShareRole = mutation({
  args: {
    topicSlug: v.string(),
    email: v.string(),
    lang: v.string(),
    role: v.union(v.literal("viewer"), v.literal("editor")),
  },
  returns: v.null(),
  handler: async (ctx, { topicSlug, email, lang, role }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("topic not found");
    const addr = normaliseEmail(email);

    const person = await ctx.db.query("users").withIndex("email", (q) => q.eq("email", addr)).unique();
    if (person) {
      const share = (
        await ctx.db.query("shares").withIndex("by_topic_viewer", (q) => q.eq("topicId", topic._id).eq("viewerId", person._id)).collect()
      ).find((s) => shareLang(s) === lang);
      if (share) {
        await ctx.db.patch(share._id, { role });
        // Email the new role. The account exists, so "role-changed" deep-links
        // into the Edition. (A pending invite is emailed too, below, but as an
        // "invited" — it must link to sign-up, not a course it can't open.)
        const owner = await ctx.db.get(userId);
        await scheduleInvite(ctx, { to: addr, kind: "role-changed", topic, editionLang: lang, inviterEmail: owner?.email ?? "", role });
        return null;
      }
    }
    const invite = (
      await ctx.db.query("pendingShares").withIndex("by_topic_email", (q) => q.eq("topicId", topic._id).eq("email", addr)).collect()
    ).find((p) => (p.lang ?? SOURCE_LANG) === lang);
    if (invite) {
      await ctx.db.patch(invite._id, { role });
      // A role change on a pending invite is emailed too (2026-08-18): being made
      // an Editor is news whether or not you've signed up yet. Kind is "invited",
      // not "role-changed" — with no account the only useful link is sign-up, and
      // the copy states the access the new role gives them once they join.
      const owner = await ctx.db.get(userId);
      await scheduleInvite(ctx, { to: addr, kind: "invited", topic, editionLang: lang, inviterEmail: owner?.email ?? "", role });
      return null;
    }
    throw new Error("no such access to update");
  },
});

// Revoke a person's access to one Edition (ADR 0020) — deletes the matching
// accepted Share or pending invite for `(topic, person, lang)`. Owner-only.
// Idempotent: a no-op if the access is already gone. Lang matched in-memory.
export const revokeShare = mutation({
  args: { topicSlug: v.string(), email: v.string(), lang: v.string() },
  returns: v.null(),
  handler: async (ctx, { topicSlug, email, lang }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("topic not found");
    const addr = normaliseEmail(email);

    const person = await ctx.db.query("users").withIndex("email", (q) => q.eq("email", addr)).unique();
    if (person) {
      const share = (
        await ctx.db.query("shares").withIndex("by_topic_viewer", (q) => q.eq("topicId", topic._id).eq("viewerId", person._id)).collect()
      ).find((s) => shareLang(s) === lang);
      if (share) await ctx.db.delete(share._id);
    }
    const invite = (
      await ctx.db.query("pendingShares").withIndex("by_topic_email", (q) => q.eq("topicId", topic._id).eq("email", addr)).collect()
    ).find((p) => (p.lang ?? SOURCE_LANG) === lang);
    if (invite) await ctx.db.delete(invite._id);
    return null;
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
        // The card title in the Viewer's preferred Edition (translated else source),
        // via the shared Edition reader — decoded, unlike the old inline lookup.
        const title = await loadEdition(ctx, topic, preferred).title();
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
