import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { SOURCE_LANG } from "./sourceLang";

// Shared backend helpers. (Plain module — no Convex functions registered here.)

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

// ---- Editions (course-translation) -----------------------------------------

// A caller's provenance on one Edition — which grant kind admits them. All three
// read ≡ a Viewer (full access); the kind only labels the badge ("Shared with me"
// / "Purchases" / "Joined"). `owner` is NOT a Grant: an owner holds the source +
// every ready translation from `translationJobs`, not a table-row grant, so it is
// resolved by the callers (`heldLangs`/`editionAccessLevel`), never here.
export type Grant = "viewer" | "entitled" | "enrolled";

// THE grant walk (edition-deepening/02): the one place shares/entitlements/
// enrollments are read for a caller, each held lang mapped to its provenance.
// Precedence is viewer > entitled > enrolled — encoded in walk order (Shares set
// unconditionally; the paid/self-serve twins fill only langs still unclaimed) so
// a lang held by more than one grant keeps the same badge `editionAccessLevel`
// showed before the collapse. Adding a grant type is one more block here plus one
// member on `Grant` — nothing else across the file moves.
export async function grantsFor(
  ctx: QueryCtx,
  topicId: Id<"topics">,
  userId: Id<"users">,
): Promise<Map<string, Grant>> {
  const grants = new Map<string, Grant>();
  // Viewer (Shares) — highest precedence. Legacy rows carry no `lang`; `shareLang`
  // reads them as the English edition, consistent with `getEditableTopic`.
  const shares = await ctx.db
    .query("shares")
    .withIndex("by_topic_viewer", (q) => q.eq("topicId", topicId).eq("viewerId", userId))
    .collect();
  for (const s of shares) grants.set(shareLang(s), "viewer");
  // Entitled (paid, ADR 0016) — an entitled buyer reads ≡ a Viewer. Fills only
  // langs a Share has not already claimed.
  const entitlements = await ctx.db
    .query("entitlements")
    .withIndex("by_topic_user", (q) => q.eq("topicId", topicId).eq("userId", userId))
    .collect();
  for (const e of entitlements) if (!grants.has(e.lang)) grants.set(e.lang, "entitled");
  // Enrolled (self-serve, ADR 0023) — lowest precedence twin of the two above.
  const enrollments = await ctx.db
    .query("enrollments")
    .withIndex("by_topic_user", (q) => q.eq("topicId", topicId).eq("userId", userId))
    .collect();
  for (const e of enrollments) if (!grants.has(e.lang)) grants.set(e.lang, "enrolled");
  // Published & free (course-publishing) — the only grant that is not a row about
  // THIS caller: an Edition the owner listed in the catalogue and left free reads
  // ≡ a Viewer for every signed-in account, with no join click and nothing stored.
  // Lowest precedence, so a real grant above keeps its own badge. Being live
  // rather than stored, it also ends when the owner unpublishes or prices the
  // Edition — grandfathering an already-joined learner is what an `enrollments`
  // row is for (still honoured above; unused by the catalogue path).
  for (const lang of await freePublishedLangs(ctx, topicId)) if (!grants.has(lang)) grants.set(lang, "viewer");
  return grants;
}

// Does this account already hold a paid grant on ONE Edition? The narrow question
// `grantsFor` above does not answer: it walks every grant kind and returns a
// badge per lang, and four callers only ever needed "is there an `entitlements`
// row for this lang". They each wrote the same index read plus the same
// `.some(e => e.lang === lang)`, and one of them is the PayFast fulfilment path,
// so the shape had to stay identical rather than drift a fifth way.
//
// **It reads `entitlements` and nothing else, deliberately.** A Share, a free
// published Edition or a grandfathered Enrollment are all access without an
// Entitlement, and every caller here is about to WRITE an Entitlement (or refuse
// to spend a seat that would write one) - so widening this to "has any access"
// would suppress grants that the buyer has paid for. `vouchers.redeem` asks the
// wider question by checking enrollments and ownership beside this call, where
// the wider question stays visible.
export async function hasEntitlement(
  ctx: QueryCtx,
  topicId: Id<"topics">,
  userId: Id<"users">,
  lang: string,
): Promise<boolean> {
  const held = await ctx.db
    .query("entitlements")
    .withIndex("by_topic_user", (q) => q.eq("topicId", topicId).eq("userId", userId))
    .collect();
  return held.some((e) => e.lang === lang);
}

// The Editions a course has listed in its tenant's catalogue
// (`publishedEditions`, course-publishing): `published: true` rows only — an
// absent row and `published: false` both read as unlisted.
export async function publishedLangs(ctx: QueryCtx, topicId: Id<"topics">): Promise<Set<string>> {
  const rows = await ctx.db
    .query("publishedEditions")
    .withIndex("by_topic", (q) => q.eq("topicId", topicId))
    .collect();
  return new Set(rows.filter((r) => r.published).map((r) => r.lang));
}

// The listed Editions that actually exist — what the catalogue may advertise. A
// listed language whose translation has since been removed (or never finished) is
// not an Edition at all, so serving it would mean English text under a
// foreign-language label; publishing enforces that create-side, and this
// re-checks it because an Edition can go away after being listed.
export async function livePublishedLangs(ctx: QueryCtx, topicId: Id<"topics">): Promise<Set<string>> {
  const langs = await publishedLangs(ctx, topicId);
  if (![...langs].some((l) => l !== SOURCE_LANG)) return langs;
  const jobs = await ctx.db
    .query("translationJobs")
    .withIndex("by_topic", (q) => q.eq("topicId", topicId))
    .collect();
  const ready = new Set(jobs.filter((j) => j.status === "ready").map((j) => j.lang));
  for (const l of langs) if (l !== SOURCE_LANG && !ready.has(l)) langs.delete(l);
  return langs;
}

// The listed Editions that are free to read — the ones publishing actually opens
// up, i.e. `livePublishedLangs` minus the PRICED ones (a paid Edition is bought,
// never read for free; only its Preview shows).
export async function freePublishedLangs(ctx: QueryCtx, topicId: Id<"topics">): Promise<Set<string>> {
  const langs = await livePublishedLangs(ctx, topicId);
  if (langs.size === 0) return langs;
  const priced = await ctx.db
    .query("listings")
    .withIndex("by_topic", (q) => q.eq("topicId", topicId))
    .collect();
  for (const l of priced) langs.delete(l.lang);
  return langs;
}

// The set of Editions the caller may read on a Topic. The owner holds the source
// English edition plus every language with a READY translation job (a generated
// Edition); a non-owner holds the languages their Shares grant PLUS the languages
// they have an Entitlement for (an entitled buyer reads their Edition exactly like
// a Viewer, ADR 0016); anyone else nothing.
// Does this account hold a **Seat** on an Organisation Voucher? (ADR 0031.)
//
// The `seats` table belongs to `convex/accessCodes.ts`; this predicate lives here
// because it is a cross-cutting question that modules with no other business in that
// rail have to ask, and a one-line read is a smaller thing to share than a new import
// edge into a module full of mutations.
//
// A row stripped of its `userId` by a withdrawal cannot match, which is correct: that
// member no longer holds a Seat.
export async function holdsSeat(ctx: QueryCtx, userId: Id<"users">): Promise<boolean> {
  const seat = await ctx.db
    .query("seats")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  return seat !== null;
}

export async function heldLangs(
  ctx: QueryCtx,
  topic: Doc<"topics">,
  userId: Id<"users">,
  grants?: Map<string, Grant>,
): Promise<Set<string>> {
  if (topic.ownerId === userId) {
    const jobs = await ctx.db
      .query("translationJobs")
      .withIndex("by_topic", (q) => q.eq("topicId", topic._id))
      .collect();
    const langs = new Set<string>([SOURCE_LANG]);
    for (const j of jobs) if (j.status === "ready") langs.add(j.lang);
    return langs;
  }
  // A non-owner's held set is exactly the keys of their grant walk. Reuse the
  // caller's precomputed walk when threaded (must be `grantsFor` for THIS
  // topic+userId), else do it once.
  return new Set((grants ?? (await grantsFor(ctx, topic._id, userId))).keys());
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
  grants?: Map<string, Grant>,
): Promise<string | null> {
  const held = await heldLangs(ctx, topic, userId, grants);
  if (held.size === 0) return null;
  if (requested && held.has(requested)) return requested;
  if (held.has(SOURCE_LANG)) return SOURCE_LANG;
  return [...held].sort()[0]!;
}

// Titles are authored upstream from generated HTML and can arrive entity-encoded
// (e.g. "Maps &amp; List"). Decode the handful of named/numeric entities that
// show up in plain-text titles so the UI never renders a raw "&amp;".
// ponytail: covers the common entities; extend the map if a new one appears.
// (Lives here, not content.ts, so lib.loadEdition can decode without a cycle;
// re-exported from content.ts for its existing importers.)
export function decodeEntities(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|#39|apos);/g, (_, e) =>
    ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'" })[e as string] ?? _,
  );
}

// ---- The Edition reader (edition-deepening/01) ------------------------------

// The "translated row else English source" projection — the ONE place it lives.
// Every reader (authed content.ts, Guest public.ts, capture/shares/certificates)
// binds an Edition to (topic, lang) here and reads through the accessors below,
// so the fallback ladder and the title-decode rule are defined exactly once.
//
// Read profile (deliberate): single-item accessors (`title`/`mission`/`lesson`/
// `reference`) point-read one translation row — the hot getLesson path never
// collects the whole Edition. `map()` collects the Edition once (memoised) to
// back list queries. Both paths delegate to the same fallback helpers, so the
// rule stays single-sourced even though the two read profiles differ.

// The translated-item title (lesson/reference use the `title` field), decoded,
// else the source row's title. Distinct from the course title, which uses `text`.
function itemTitle(row: { title?: string } | null | undefined, sourceTitle: string): string {
  return decodeEntities(row?.title ?? sourceTitle);
}

// The five kinds a translation row can be. `lesson` and `reference` rows carry
// the fat inline `html` body; `title`/`mission`/`question` rows are text-only.
// That asymmetry is why `map()` takes the kinds it needs — see below.
export type EditionKind = "lesson" | "reference" | "mission" | "title" | "question";

// A loaded snapshot of one Edition's translated rows (keyed by `key` within each
// requested kind), with sync accessors for the list queries. Titles decode;
// question text/reply stay raw (learner-typed, never generated-HTML-derived).
export type EditionSnapshot = {
  title(topic: { title: string }): string;
  lessonTitle(lesson: Doc<"lessons">): string;
  referenceTitle(reference: Doc<"references">): string;
  question(q: Doc<"questions">): { text: string; reply: string | null };
};

export type EditionReader = {
  title(): Promise<string>;
  mission(): Promise<string | null>;
  lesson(lesson: Doc<"lessons">): Promise<{ title: string; body: ContentBody }>;
  reference(reference: Doc<"references">): Promise<{ title: string; body: ContentBody }>;
  // The caller declares which kinds it will read, and pays for those rows ONLY.
  // Not a micro-optimisation: a `lesson`/`reference` row carries a whole inline
  // HTML body, so a snapshot that loaded all five kinds made `myQuestions` read
  // every lesson body in the Edition to return a line of learner-typed text.
  // That one mistake was 1.15 GB of the 3.62 GB on the Jul 8 – Aug 7 2026 bill
  // (`myQuestions`, `listLessons` and `listReferences` were 95% of it together).
  // Accessing a kind you did not request throws rather than silently falling
  // back to the source-language text, which would look like a missing
  // translation instead of a bug.
  map(kinds: readonly EditionKind[]): Promise<EditionSnapshot>;
};

export function loadEdition(ctx: QueryCtx, topic: Doc<"topics">, lang: string): EditionReader {
  const source = lang === SOURCE_LANG;

  // One point-read of a single translated row (skipped for the source language).
  const one = async (kind: EditionKind, key: string): Promise<Doc<"translations"> | null> => {
    if (source) return null;
    return await ctx.db
      .query("translations")
      .withIndex("by_topic_lang_kind_key", (q) =>
        q.eq("topicId", topic._id).eq("lang", lang).eq("kind", kind).eq("key", key),
      )
      .unique();
  };

  // One indexed collect per kind, memoised so a caller that reads two kinds
  // (the Guest bundle reads all four) still pays each at most once. The `kind`
  // prefix of `by_topic_lang_kind_key` makes each of these a range scan over
  // just that kind's rows, never the whole Edition.
  const perKind = new Map<EditionKind, Promise<Map<string, Doc<"translations">>>>();
  const rowsOf = (kind: EditionKind): Promise<Map<string, Doc<"translations">>> => {
    let pending = perKind.get(kind);
    if (!pending) {
      pending = (async () => {
        if (source) return new Map<string, Doc<"translations">>();
        const rows = await ctx.db
          .query("translations")
          .withIndex("by_topic_lang_kind_key", (q) =>
            q.eq("topicId", topic._id).eq("lang", lang).eq("kind", kind),
          )
          .collect();
        return new Map(rows.map((r) => [r.key, r]));
      })();
      perKind.set(kind, pending);
    }
    return pending;
  };

  return {
    // Course title uses the shared `translatedTitle` primitive (the `text` field),
    // then decodes — folding in the lookup shares.ts/certificates.ts hand-inlined.
    title: async () => decodeEntities(await translatedTitle(ctx, topic._id, lang, topic.title)),
    mission: async () => {
      if (!topic.mission) return null;
      const row = await one("mission", "");
      return decodeEntities(row?.text ?? topic.mission);
    },
    lesson: async (lesson) => {
      const row = await one("lesson", lesson.key);
      return { title: itemTitle(row, lesson.title), body: pickContentBody(row, lesson) };
    },
    reference: async (reference) => {
      const row = await one("reference", reference.key);
      return { title: itemTitle(row, reference.title), body: pickContentBody(row, reference) };
    },
    map: async (kinds) => {
      const loaded = new Map<EditionKind, Map<string, Doc<"translations">>>(
        await Promise.all(kinds.map(async (k) => [k, await rowsOf(k)] as const)),
      );
      // A kind the caller didn't declare is a programming error, not a missing
      // translation — throw instead of returning the source text, which would
      // read as "untranslated" in the UI and hide the mistake.
      const need = (kind: EditionKind): Map<string, Doc<"translations">> => {
        const rows = loaded.get(kind);
        if (!rows) throw new Error(`Edition snapshot: kind "${kind}" read but not requested`);
        return rows;
      };
      return {
        title: (tp) => decodeEntities(need("title").get("")?.text ?? tp.title),
        lessonTitle: (lesson) => itemTitle(need("lesson").get(lesson.key), lesson.title),
        referenceTitle: (reference) => itemTitle(need("reference").get(reference.key), reference.title),
        question: (q) => {
          const row = need("question").get(q._id);
          return { text: row?.text ?? q.text, reply: (q.reply ? (row?.reply ?? q.reply) : null) ?? null };
        },
      };
    },
  };
}

// ---- The per-artifact reader core (edition-deepening/04) --------------------
//
// The artifact-fetch + paygate projection shared by BOTH readers. Each reader
// resolves its principal its own way — the authed reader via `resolveEdition`
// (signed-in userId + the `none`→not-found gate), the Guest reader via its
// Public-link token — then hands the already-resolved (topic, lang, level) here.
// Selection/classification stays upstream (one seam per reader); the artifact
// projection lives here, once, so content.ts and public.ts are thin adapters over
// this core rather than parallel re-implementations of the same body.

type ArtifactBody = { locked: boolean; contentUrl?: string; html?: string };
export type LessonPayload = { key: string; seq: number; title: string } & ArtifactBody;
export type ReferencePayload = { key: string; title: string } & ArtifactBody;

// One Lesson's payload for an already-resolved Edition: null when the Lesson is
// missing or superseded; a locked marker on a paid Edition past the Preview
// (`lessonLocked`); else the translated-else-source title + body. Shared by
// content.getLesson and public.publicLesson.
export async function readLesson(
  ctx: QueryCtx,
  topic: Doc<"topics">,
  lang: string,
  level: EditionAccess,
  key: string,
): Promise<LessonPayload | null> {
  const lesson = await ctx.db
    .query("lessons")
    .withIndex("by_topic_key", (q) => q.eq("topicId", topic._id).eq("key", key))
    .unique();
  if (!lesson || lesson.supersededBy) return null;
  const { title, body } = await loadEdition(ctx, topic, lang).lesson(lesson);
  if (await lessonLocked(ctx, topic._id, level, key)) {
    return { key: lesson.key, seq: lesson.seq, title, html: "", locked: true };
  }
  return { key: lesson.key, seq: lesson.seq, title, locked: false, ...body };
}

// One Reference's payload for an already-resolved Edition: null when the
// Reference is unknown; a locked marker on a paid Edition (References sit
// entirely past the Preview, so `preview` locks them wholesale); else the
// translated-else-source title + body. Shared by content.getReference and
// public.publicReference.
export async function readReference(
  ctx: QueryCtx,
  topic: Doc<"topics">,
  lang: string,
  level: EditionAccess,
  key: string,
): Promise<ReferencePayload | null> {
  const ref = await ctx.db
    .query("references")
    .withIndex("by_topic_key", (q) => q.eq("topicId", topic._id).eq("key", key))
    .unique();
  if (!ref) return null;
  const { title, body } = await loadEdition(ctx, topic, lang).reference(ref);
  if (referenceLocked(level)) return { key: ref.key, title, html: "", locked: true };
  return { key: ref.key, title, locked: false, ...body };
}

// The table-of-contents projections shared by the list queries and the Guest's
// full-mirror bundle. The caller passes the Edition snapshot it already holds
// (`loadEdition(...).map()`) so the collect is reused, not repeated. Lessons in
// `by_topic_seq` order, non-superseded; References alphabetised by key — the TOC
// still renders in full even to a `preview` caller (only the bodies are locked).
//
// Each entry carries the same `locked` verdict the per-item read applies
// (`lessonLocked`/`referenceLocked`), so the paygate rule is evaluated once,
// server-side: no caller re-derives it from `paywall.previewKey`
// (architecture-deepening/03).
export async function lessonsToc(
  ctx: QueryCtx,
  topic: Doc<"topics">,
  snap: EditionSnapshot,
  level: EditionAccess,
): Promise<Array<{ key: string; seq: number; title: string; locked: boolean }>> {
  const lessons = await ctx.db
    .query("lessons")
    .withIndex("by_topic_seq", (q) => q.eq("topicId", topic._id))
    .collect();
  return await Promise.all(
    lessons
      .filter((l) => !l.supersededBy)
      .map(async (l) => ({
        key: l.key,
        seq: l.seq,
        title: snap.lessonTitle(l),
        locked: await lessonLocked(ctx, topic._id, level, l.key),
      })),
  );
}

export async function referencesToc(
  ctx: QueryCtx,
  topic: Doc<"topics">,
  snap: EditionSnapshot,
  level: EditionAccess,
): Promise<Array<{ key: string; title: string; locked: boolean }>> {
  const refs = await ctx.db
    .query("references")
    .withIndex("by_topic", (q) => q.eq("topicId", topic._id))
    .collect();
  return refs
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((r) => ({ key: r.key, title: snap.referenceTitle(r), locked: referenceLocked(level) }));
}

// ---- Paid marketplace: the Edition access resolver (ADR 0016) ---------------

// The caller's relationship to a requested Edition. `owner`/`viewer`/`entitled`/
// `enrolled` read the whole Edition; `preview` gets only the free first Lesson of
// a PAID Edition; `none` is not-found (a free Edition the caller holds no grant
// to). `enrolled` (self-enroll, ADR 0023) reads ≡ a Viewer, kept distinct only
// for the "Joined" badge and the "my enrolled courses" query.
export type EditionAccess = "owner" | "viewer" | "entitled" | "enrolled" | "preview" | "none";

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
  grants?: Map<string, Grant>,
): Promise<EditionAccess> {
  if (userId && topic.ownerId === userId) return "owner";
  if (userId) {
    // One grant walk (reused when threaded by resolveEdition — the map must
    // be `grantsFor` for THIS topic+userId — else run once) yields the provenance
    // directly, precedence viewer > entitled > enrolled. A
    // self-enroll grant (ADR 0023) reads ≡ a Viewer; because the walk is consulted
    // before the price fallback and never re-checks the price, a grandfathered
    // enrollee keeps full access even after their formerly-free Edition is priced.
    const held = (grants ?? (await grantsFor(ctx, topic._id, userId))).get(lang);
    if (held) return held;
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
//
// It carries all THREE price points — the base ZAR amount and the seller's
// optional `usdAmount` / `eurAmount` (ticket 11 §4) — rather than the one this
// buyer will pay, because the buyer's country cannot reach a Convex query: it
// arrives as an argument on the mutations, and a reactive subscription has no
// such argument (ticket 10). So the surface picks, from `priceView()`, using the
// country its server component read; the charge itself is still derived
// server-side at intent time and never accepted from a client.
export type Paywall = {
  amount: number;
  currency: string;
  previewKey: string | null;
  usdAmount?: number;
  eurAmount?: number;
};
// One validator for both readers' `paywall` field — they render the same card
// from the same builder, so a field added here (the regional prices were) must
// never reach one surface and not the other.
export const paywallValidator = v.object({
  amount: v.number(),
  currency: v.string(),
  previewKey: v.union(v.string(), v.null()),
  usdAmount: v.optional(v.number()),
  eurAmount: v.optional(v.number()),
});
export async function buildPaywall(ctx: QueryCtx, topicId: Id<"topics">, lang: string): Promise<Paywall | undefined> {
  const price = await editionPrice(ctx, topicId, lang);
  if (!price) return undefined;
  return {
    amount: price.amount,
    currency: price.currency,
    previewKey: await previewLessonKey(ctx, topicId),
    usdAmount: price.usdAmount,
    eurAmount: price.eurAmount,
  };
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

// Whether a Reference body is withheld: References sit entirely past the free
// Preview, so a `preview` caller loses them wholesale — no per-key exception.
// The Reference twin of `lessonLocked`, so both readers' per-Reference queries and
// the table of contents state the rule in one place rather than each testing
// `level === "preview"` inline.
export function referenceLocked(level: EditionAccess): boolean {
  return level === "preview";
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

// THE authed Edition-selection seam: which Edition to serve AND the caller's
// access level to it, resolved once per request. Every authed reader query
// (content.courseHeader / getMap / getLesson / getReference) calls this and
// nothing else for selection+classification; the Guest reader is a separate thin
// token adapter over the shared `editionAccessLevel` classifier (it has no
// selection ladder — its token fixes the Edition), and `capture.myQuestions`
// calls the lower-level `readableLang` primitive directly because it needs the
// null-when-nothing-held signal this seam intentionally never returns.
// Composes Edition selection (held-Edition switching, unchanged) with the paygate:
//   - A non-owner's SPECIFIC request is classified as-is, so navigating to a paid
//     Edition they don't hold shows THAT Edition's Preview (an `es` hold never
//     silently redirects a `ur` request). It only falls back to a held Edition
//     when the requested one is genuinely not-found (free + unheld).
//   - The owner, and any request-less call, use the held-Edition selection
//     (`readableLang`) unchanged, reaching the paygate only when nothing is held.
export async function resolveEdition(
  ctx: QueryCtx,
  topic: Doc<"topics">,
  userId: Id<"users">,
  requested?: string | null,
): Promise<{ lang: string; level: EditionAccess }> {
  // The caller's grant walk, computed ONCE and threaded through every selection +
  // classification call below (each would otherwise re-walk the three tables). The
  // owner never consults it — their selection reads translationJobs and their level
  // short-circuits to "owner" — so skip the read entirely for them.
  const grants = topic.ownerId === userId ? undefined : await grantsFor(ctx, topic._id, userId);
  if (requested && topic.ownerId !== userId) {
    const level = await editionAccessLevel(ctx, topic, requested, userId, false, grants);
    if (level !== "none") return { lang: requested, level };
    const held = await readableLang(ctx, topic, userId, null, grants);
    if (held) return { lang: held, level: await editionAccessLevel(ctx, topic, held, userId, false, grants) };
    return { lang: requested, level: "none" };
  }
  const effLang = await readableLang(ctx, topic, userId, requested ?? null, grants);
  if (effLang !== null) return { lang: effLang, level: await editionAccessLevel(ctx, topic, effLang, userId, false, grants) };
  const lang = requested ?? SOURCE_LANG;
  return { lang, level: await editionAccessLevel(ctx, topic, lang, userId, false, grants) };
}

// Where an OAuth sign-in is allowed to land, given the client-supplied
// `redirectTo` and the deployment's SITE_URL. Wired in as Convex Auth's
// `callbacks.redirect` (convex/auth.ts) because the library's default only ever
// admits SITE_URL itself, and falls back to it when `redirectTo` is absent
// (@convex-dev/auth implementation/redirects.js). Both are wrong for us now:
// `https://ywampotch.my-course.app` does not start with `https://my-course.app`,
// so a tenant sign-in would either throw or land the user on the apex — and under
// ADR 0025 the session cookie is host-only, so the host the callback redirects to
// IS the host they end up signed in on. Landing on the apex means the buyer who
// started on the tenant subdomain is still signed out there.
//
// The rule: same origin as SITE_URL, or any single- or multi-label subdomain of
// its apex. No tenant allow-list, deliberately — every `*.my-course.app` name is
// the operator's own DNS to hand out, so DNS control is the trust boundary and
// adding a tenant needs no change here. `www.` is stripped from the base because
// tenant hosts hang off the apex, matching `appUrl` in payfast.ts.
//
// `redirectTo` is untrusted client input, so this is a real open-redirect guard:
// the URL it returns carries a one-time session code as a query param
// (implementation/index.js), and handing that to a foreign host hands over the
// sign-in. Anything not provably ours throws rather than falling back to a
// plausible-looking default.
export function oauthRedirectUrl(redirectTo: string, siteUrl: string): string {
  const invalid = () => new Error(`Invalid \`redirectTo\` ${redirectTo} for SITE_URL ${siteUrl}`);
  let site: URL;
  try {
    site = new URL(siteUrl);
  } catch {
    throw new Error(`SITE_URL is not a valid URL: ${siteUrl}`);
  }
  // A leading `//` is protocol-relative, NOT a path: `new URL("//evil.com", site)`
  // resolves to `https://evil.com/`. Reject before resolving so it can never be
  // mistaken for the relative case below.
  if (redirectTo.startsWith("//")) throw invalid();
  let resolved: URL;
  try {
    resolved = new URL(redirectTo, site);
  } catch {
    throw invalid();
  }
  if (resolved.protocol !== site.protocol || resolved.port !== site.port) throw invalid();
  const apex = site.hostname.replace(/^www\./, "");
  const host = resolved.hostname;
  // The dot boundary is what stops `my-course.app.evil.com` passing a suffix test.
  if (host !== apex && host !== site.hostname && !host.endsWith(`.${apex}`)) throw invalid();
  return resolved.toString();
}
