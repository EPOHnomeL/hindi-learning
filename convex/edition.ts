import { v } from "convex/values";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { SOURCE_LANG } from "./sourceLang";
import { shareLang } from "./shareGrants";
import { decodeEntities, pickContentBody, type ContentBody } from "./contentBlobs";
import { type Grant, grantsFor } from "./grants";
import { freePublishedLangs, livePublishedLangs, publishedLangs } from "./publishedEditions";

// `convex/edition.ts`: the Edition reader, the grant resolver and the paywall.
// Who holds which Edition of a Topic, which one to serve them, how its rows read,
// and what the paygate withholds. (Plain module, no Convex functions registered
// here.) Everything else that used to live here moved to its own module in
// technical-foundation/16; technical-foundation/17 then renamed the file from
// `lib.ts`, because with only this subject left the old name described a junk
// drawer that no longer exists.

// ---- Editions (course-translation) -----------------------------------------

// The grant tables (`shares`/`entitlements`/`enrollments`/`seats`) moved to
// `convex/grants.ts` on 2026-09-08 (ticket 28), along with `Grant`, `grantsFor`,
// `hasEntitlement` and `holdsSeat`. This file keeps the Edition reader, the
// paygate and Edition selection, and no longer reads another rail's tables.

// The Catalogue listing trio (`publishedLangs`, `livePublishedLangs`,
// `freePublishedLangs`) moved to `convex/publishedEditions.ts` on 2026-09-08
// (ticket 28): they answer nothing about a caller, and `grants.ts` needs the
// free-published set, so they had to sit below the grant walk.

// The set of Editions the caller may read on a Topic. The owner holds the source
// English edition plus every language with a READY translation job (a generated
// Edition); a non-owner holds the languages their Shares grant PLUS the languages
// they have an Entitlement for (an entitled buyer reads their Edition exactly like
// a Viewer, ADR 0016); anyone else nothing.
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
