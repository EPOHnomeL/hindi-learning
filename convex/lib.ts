import { v, type Infer } from "convex/values";
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
      await ctx.db.insert("shares", { topicId: invite.topicId, viewerId: userId, lang });
    }
    await ctx.db.delete(invite._id);
  }
}

// Turn any pending Entitlements (paid purchases) for a freshly-created account
// into real Entitlements — the paid twin of `claimPendingShares` (ADR 0016).
// Called from the sign-up callback right after the `users` row is inserted, so an
// email that PAID before it had an account gains its purchased read access the
// moment it signs up. Idempotent per (Topic, buyer, language): skips a language
// already entitled, and clears the pending row either way.
export async function claimPendingEntitlements(ctx: MutationCtx, userId: Id<"users">, email: string): Promise<void> {
  const pending = await ctx.db
    .query("pendingEntitlements")
    .withIndex("by_email", (q) => q.eq("email", normaliseEmail(email)))
    .collect();
  for (const purchase of pending) {
    const existing = await ctx.db
      .query("entitlements")
      .withIndex("by_topic_user", (q) => q.eq("topicId", purchase.topicId).eq("userId", userId))
      .collect();
    if (!existing.some((e) => e.lang === purchase.lang)) {
      await ctx.db.insert("entitlements", {
        topicId: purchase.topicId,
        userId,
        lang: purchase.lang,
        // Carry the PaymentIntent forward so a later refund still revokes cleanly.
        stripePaymentIntentId: purchase.stripePaymentIntentId,
      });
    }
    await ctx.db.delete(purchase._id);
  }
}

// Whether this email holds a paid purchase awaiting an account — the Allowlist
// admission widening (ADR 0016): a buyer may sign up though sign-up is otherwise
// closed, because payment admitted them. Reads pending Entitlements only: a *real*
// Entitlement already implies an account, so it never matters at sign-up.
export async function hasPendingEntitlement(ctx: QueryCtx, email: string): Promise<boolean> {
  const row = await ctx.db
    .query("pendingEntitlements")
    .withIndex("by_email", (q) => q.eq("email", normaliseEmail(email)))
    .first();
  return row !== null;
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
  if (share) return topic;
  // An **Entitlement** (paid marketplace, ADR 0016) grants the same topic-level
  // visibility as a Share — an entitled buyer is a Viewer of the Edition they
  // bought (their own Progress, Resources, Certificate eligibility all follow for
  // free). A caller with neither a Share nor an Entitlement (e.g. a Preview-only
  // visitor) still gets null here and reaches paid content only via the reader's
  // resolver, never the owner/Viewer write & capture seams.
  const entitlement = await ctx.db
    .query("entitlements")
    .withIndex("by_topic_user", (q) => q.eq("topicId", topic._id).eq("userId", userId))
    .first();
  return entitlement ? topic : null;
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

// The Edition languages a buyer holds on a Topic (from their Entitlements). The
// paid twin of `viewerLangs` (ADR 0016). Entitlements always carry a `lang`.
export async function entitledLangs(ctx: QueryCtx, topicId: Id<"topics">, userId: Id<"users">): Promise<Set<string>> {
  const rows = await ctx.db
    .query("entitlements")
    .withIndex("by_topic_user", (q) => q.eq("topicId", topicId).eq("userId", userId))
    .collect();
  return new Set(rows.map((e) => e.lang));
}

// The set of Editions the caller may read on a Topic. The owner holds the source
// English edition plus every language with a READY translation job (a generated
// Edition); a non-owner holds the languages their Shares grant PLUS the languages
// they have an Entitlement for (an entitled buyer reads their Edition exactly like
// a Viewer, ADR 0016); anyone else nothing.
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
  const shared = await viewerLangs(ctx, topic._id, userId);
  for (const l of await entitledLangs(ctx, topic._id, userId)) shared.add(l);
  return shared;
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

// ---- Paid marketplace: Sellers (ADR 0016) -----------------------------------

// A Seller's onboarding stage, derived from their `sellers` row (see schema):
//   not-granted          — no row: the Admin has not granted can-sell
//   granted-not-onboarded — granted, but Stripe onboarding not started (no account)
//   onboarding-incomplete — Stripe account exists but payouts not yet enabled
//   ready                 — payouts enabled: the Seller may price and be paid
// A Seller (CONTEXT) is only `ready` when both gates are satisfied.
// Single source of truth for the status: the validator (used by every Convex
// function that returns a status) and the `SellerStatus` type both derive from
// this one declaration, so the four stages are never restated out of sync.
export const sellerStatusValidator = v.union(
  v.literal("not-granted"),
  v.literal("granted-not-onboarded"),
  v.literal("onboarding-incomplete"),
  v.literal("ready"),
);
export type SellerStatus = Infer<typeof sellerStatusValidator>;

// The caller's Seller row, or null when can-sell was never granted.
export async function getSeller(ctx: QueryCtx, userId: Id<"users">): Promise<Doc<"sellers"> | null> {
  return await ctx.db
    .query("sellers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

// Map a Seller row (or its absence) to the onboarding stage the self-status query
// and the pricing guard both read. `payoutsEnabled` is the single gate on `ready`.
export function sellerStatusOf(seller: Doc<"sellers"> | null): SellerStatus {
  if (!seller) return "not-granted";
  if (!seller.stripeAccountId) return "granted-not-onboarded";
  return seller.payoutsEnabled ? "ready" : "onboarding-incomplete";
}

// Whether the caller may price/sell right now — granted AND payouts-enabled. The
// guard the real (Slice 2) pricing action enforces, replacing Slice 1's Admin gate.
export async function isReadySeller(ctx: QueryCtx, userId: Id<"users">): Promise<boolean> {
  return sellerStatusOf(await getSeller(ctx, userId)) === "ready";
}

// ---- Paid marketplace: the Edition access resolver (ADR 0016) ---------------

// The caller's relationship to a requested Edition. `owner`/`viewer`/`entitled`
// read the whole Edition; `preview` gets only the free first Lesson of a PAID
// Edition; `none` is not-found (a free Edition the caller holds no grant to).
export type EditionAccess = "owner" | "viewer" | "entitled" | "preview" | "none";

// The price of an Edition (Topic, language), or null when the Edition is free.
// The PRESENCE of a listing row is the single source of truth for "paid".
export async function editionPrice(
  ctx: QueryCtx,
  topicId: Id<"topics">,
  lang: string,
): Promise<Doc<"listings"> | null> {
  return await ctx.db
    .query("listings")
    .withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", lang))
    .unique();
}

// THE access decision for a specific Edition (Topic, lang) and caller — the one
// place read access is resolved (PRD: "access resolves at one seam, at the
// Edition grain"). Both readers consult it: the authed reader passes the signed-in
// `userId`; the Guest reader passes `userId: null` with `publicGrant: true` once
// its per-Edition Public link has authorised this exact Edition.
//
//   owner    — the Topic's owner (full; never paywalled on their own course)
//   viewer   — holds a language-scoped Share for this Edition (full)
//   entitled — holds an Entitlement for this Edition (full; treated ≡ Viewer)
//   preview  — no hold, but the Edition is PAID: only the free Preview is served
//   none     — no hold and the Edition is free: not-found (unchanged free gate)
//
// A valid Public link is itself a grant: on a FREE Edition it yields `viewer`
// (today's anonymous full read); on a PAID Edition it yields `preview`.
export async function editionAccessLevel(
  ctx: QueryCtx,
  topic: Doc<"topics">,
  lang: string,
  userId: Id<"users"> | null,
  publicGrant = false,
): Promise<EditionAccess> {
  if (userId && topic.ownerId === userId) return "owner";
  if (userId) {
    if ((await viewerLangs(ctx, topic._id, userId)).has(lang)) return "viewer";
    if ((await entitledLangs(ctx, topic._id, userId)).has(lang)) return "entitled";
  }
  const paid = (await editionPrice(ctx, topic._id, lang)) !== null;
  if (publicGrant) return paid ? "preview" : "viewer";
  return paid ? "preview" : "none";
}

// The Preview of an Edition: the key of the lowest-ordered non-superseded Lesson
// (the same non-superseded filter the Frontier uses). The Lesson's language
// rendering is handled by the reader's normal translation fallback. Null when the
// course has no readable Lesson yet.
export async function previewLessonKey(ctx: QueryCtx, topicId: Id<"topics">): Promise<string | null> {
  // Walk the `by_topic_seq` index in ascending order and return the first
  // non-superseded Lesson — the lowest-ordered live one — short-circuiting rather
  // than collecting + sorting the whole course on every reader request.
  for await (const l of ctx.db.query("lessons").withIndex("by_topic_seq", (q) => q.eq("topicId", topicId))) {
    if (!l.supersededBy) return l.key;
  }
  return null;
}

// The paygate payload for an Edition: its price and which Lesson is the free
// Preview, or undefined when the Edition is free. Built in one place so both
// readers' course-header queries (content.courseHeader / public.publicCourse)
// render the paywall identically.
export type Paywall = { amount: number; currency: string; previewKey: string | null };
export async function buildPaywall(ctx: QueryCtx, topicId: Id<"topics">, lang: string): Promise<Paywall | undefined> {
  const price = await editionPrice(ctx, topicId, lang);
  if (!price) return undefined;
  return { amount: price.amount, currency: price.currency, previewKey: await previewLessonKey(ctx, topicId) };
}

// Whether a Lesson body is withheld from this caller: only on a PAID Edition they
// don't hold (`preview`), and only for a Lesson past the free Preview. Shared by
// both readers' per-Lesson queries (content.getLesson / public.publicLesson) so
// the lock decision lives in one place.
export async function lessonLocked(
  ctx: QueryCtx,
  topicId: Id<"topics">,
  level: EditionAccess,
  key: string,
): Promise<boolean> {
  return level === "preview" && key !== (await previewLessonKey(ctx, topicId));
}

// The translated title text for an Edition, or the source title when the Edition
// is English or untranslated. Centralises the `kind: "title"` translation lookup
// the marketplace read paths (market.myPurchases / market.checkoutInfo) need.
export async function translatedTitle(
  ctx: QueryCtx,
  topicId: Id<"topics">,
  lang: string,
  sourceTitle: string,
): Promise<string> {
  if (lang === SOURCE_LANG) return sourceTitle;
  const t = await ctx.db
    .query("translations")
    .withIndex("by_topic_lang_kind_key", (q) =>
      q.eq("topicId", topicId).eq("lang", lang).eq("kind", "title").eq("key", ""),
    )
    .unique();
  return t?.text ?? sourceTitle;
}

// The authed reader's per-request resolution: which Edition to serve AND the
// caller's access level to it — the single seam every authed reader query calls.
// Composes Edition selection (held-Edition switching, unchanged) with the paygate:
//   - A non-owner's SPECIFIC request is classified as-is, so navigating to a paid
//     Edition they don't hold shows THAT Edition's Preview (an `es` hold never
//     silently redirects a `ur` request). It only falls back to a held Edition
//     when the requested one is genuinely not-found (free + unheld).
//   - The owner, and any request-less call, use the held-Edition selection
//     (`readableLang`) unchanged, reaching the paygate only when nothing is held.
export async function resolveReaderEdition(
  ctx: QueryCtx,
  topic: Doc<"topics">,
  userId: Id<"users">,
  requested?: string | null,
): Promise<{ lang: string; level: EditionAccess }> {
  if (requested && topic.ownerId !== userId) {
    const level = await editionAccessLevel(ctx, topic, requested, userId);
    if (level !== "none") return { lang: requested, level };
    const held = await readableLang(ctx, topic, userId, null);
    if (held) return { lang: held, level: await editionAccessLevel(ctx, topic, held, userId) };
    return { lang: requested, level: "none" };
  }
  const effLang = await readableLang(ctx, topic, userId, requested ?? null);
  if (effLang !== null) return { lang: effLang, level: await editionAccessLevel(ctx, topic, effLang, userId) };
  const lang = requested ?? SOURCE_LANG;
  return { lang, level: await editionAccessLevel(ctx, topic, lang, userId) };
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
