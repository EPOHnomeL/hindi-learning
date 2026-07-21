import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";
import { action, internalAction, internalMutation, internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { assertAdmin, assertTenantFlag, getEditableTopic, getOwnedTopic, hashString, SOURCE_LANG, shareLang, topicBySlug } from "./lib";
import { isKnownLang, langInfo } from "./languages";
import { chatComplete, translateModel, type ChatMessage } from "./openrouterClient";
import { geminiComplete, geminiTranslateModel } from "./geminiClient";

// Course translation (Editions), driven by the cloud **translate Routine** — the
// sibling of the next-lesson Routine (routine.ts), reusing its lock → claim →
// materialise → publish → report shape. No LLM and no Anthropic API key run in
// the app (ADR 0001 still holds): an owner fires the routine for one *completed*
// course + language; a fired cloud run claims the (Topic, language) job,
// materialises the source from Convex, translates it with its own Claude access,
// and publishes each item back through the PUBLISH_SECRET-guarded seams below.
// Only a `completed` course is translatable — its content is frozen, so an
// Edition never drifts stale under the reader.

const kindV = v.union(
  v.literal("lesson"),
  v.literal("reference"),
  v.literal("mission"),
  v.literal("title"),
  v.literal("question"),
);
type Kind = "lesson" | "reference" | "mission" | "title" | "question";

// ---- Source enumeration + staleness hashing -------------------------------

// The hash of a source item's content — stamped onto the translation so a later
// re-translate can skip unchanged items. Must be computed identically wherever a
// source item is read, so both `collectItems` and `readSource` route through here.
// Also stamped by the owner's manual translated-Lesson edit (content.ts) so a
// later re-translate of an unchanged source skips the item and keeps that edit.
export function itemHash(kind: Kind, f: { title?: string; html?: string; htmlStorageId?: Id<"_storage">; text?: string; reply?: string }): string {
  // Bodies now live in content blobs; a blob-backed row has no inline `html`, so
  // hash its stable `htmlStorageId` instead (immutable content → stable id → a
  // valid staleness key). Falls back to inline `html` for not-yet-migrated rows.
  if (kind === "lesson" || kind === "reference") return hashString((f.title ?? "") + "|" + (f.html ?? f.htmlStorageId ?? ""));
  if (kind === "question") return hashString((f.text ?? "") + "|" + (f.reply ?? ""));
  return hashString(f.text ?? ""); // title, mission
}

type Item = { kind: Kind; key: string; hash: string };

// How long a `translating` job may sit without a heartbeat tick before it is
// presumed dead and its lock retakeable. The heartbeat (`claimedAt`) is stamped
// at acquire and re-stamped by every `publishTranslation` tick (~one a minute
// while a run is alive), so 10 silent minutes means the action was killed
// infra-side — nothing will ever report, and the lock would stick forever.
const STALE_MS = 10 * 60 * 1000;

// True when a fresh translation of this item already exists (its `sourceHash`
// matches the current source), so a run can skip it — this is what makes a
// re-fire a *resume* instead of a from-scratch restart.
async function isFresh(ctx: QueryCtx, topicId: Id<"topics">, lang: string, it: Item): Promise<boolean> {
  const existing = await ctx.db
    .query("translations")
    .withIndex("by_topic_lang_kind_key", (q) =>
      q.eq("topicId", topicId).eq("lang", lang).eq("kind", it.kind).eq("key", it.key),
    )
    .unique();
  return existing !== null && existing.sourceHash === it.hash;
}

// Every translatable item of a Topic — its title, mission (if any), and each
// non-superseded Lesson + Reference. Used only to seed the job's `total`; the run
// re-reads the content itself via `materialiseTopic`.
async function collectItems(ctx: QueryCtx, topic: Doc<"topics">): Promise<Item[]> {
  const items: Item[] = [];
  items.push({ kind: "title", key: "", hash: itemHash("title", { text: topic.title }) });
  if (topic.mission) items.push({ kind: "mission", key: "", hash: itemHash("mission", { text: topic.mission }) });

  const lessons = (
    await ctx.db.query("lessons").withIndex("by_topic_seq", (q) => q.eq("topicId", topic._id)).collect()
  ).filter((l) => !l.supersededBy);
  for (const l of lessons) items.push({ kind: "lesson", key: l.key, hash: itemHash("lesson", l) });

  const refs = await ctx.db.query("references").withIndex("by_topic", (q) => q.eq("topicId", topic._id)).collect();
  for (const r of refs) items.push({ kind: "reference", key: r.key, hash: itemHash("reference", r) });

  // ponytail: Q&A translation dropped in the routine cut-over — materialiseTopic
  // exposes only open questions (no replies), so a run can't faithfully render
  // them. Re-add as its own item stream if learners want translated Q&A.
  return items;
}

// The source content for one item, read fresh so `publishTranslation` can stamp
// its source hash and structurally validate the returned HTML. Null if the item
// vanished (e.g. a Lesson superseded) — the run then simply doesn't publish it.
async function readSource(
  ctx: QueryCtx,
  topicId: Id<"topics">,
  kind: Kind,
  key: string,
): Promise<{ title?: string; html?: string; htmlStorageId?: Id<"_storage">; text?: string; reply?: string; hash: string } | null> {
  const topic = await ctx.db.get(topicId);
  if (!topic) return null;
  if (kind === "title") return { text: topic.title, hash: itemHash("title", { text: topic.title }) };
  if (kind === "mission") {
    if (!topic.mission) return null;
    return { text: topic.mission, hash: itemHash("mission", { text: topic.mission }) };
  }
  if (kind === "lesson") {
    const l = await ctx.db
      .query("lessons")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", key))
      .unique();
    if (!l || l.supersededBy) return null;
    // The source body now lives in a content blob (no inline `html`), so the
    // quiz-structure guard downstream is skipped for it (see publishTranslation);
    // the blob id lets an action read the bytes to translate the body.
    return { title: l.title, htmlStorageId: l.htmlStorageId, hash: itemHash("lesson", l) };
  }
  if (kind === "reference") {
    const r = await ctx.db
      .query("references")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", key))
      .unique();
    if (!r) return null;
    return { title: r.title, htmlStorageId: r.htmlStorageId, hash: itemHash("reference", r) };
  }
  // question
  const q = await ctx.db.get(key as Id<"questions">);
  if (!q || q.topicId !== topicId) return null;
  return { text: q.text, reply: q.reply ?? "", hash: itemHash("question", q) };
}

// ---- Owner: fire a translate run -------------------------------------------

type AcquireResult =
  | { acquired: true; topicSlug: string; lang: string; total: number }
  | { acquired: false; reason: string };

// Check the gate + grab the lock in one transaction (mirrors
// `routine.tryAcquireGeneration`). Owner-only, completed-gated, known-language,
// and single-flight: refuses a language that's already `translating` — otherwise
// a re-run would double-fire the routine. Seeds/refreshes the job `translating`
// with the item `total`. The ONLY place that decides to translate.
export const tryAcquireTranslation = internalMutation({
  args: { topicSlug: v.string(), lang: v.string() },
  returns: v.union(
    v.object({ acquired: v.literal(true), topicSlug: v.string(), lang: v.string(), total: v.number() }),
    v.object({ acquired: v.literal(false), reason: v.string() }),
  ),
  handler: async (ctx, { topicSlug, lang }): Promise<AcquireResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { acquired: false, reason: "unauthenticated" };
    if (lang === SOURCE_LANG) return { acquired: false, reason: "source-language" };
    // Only an offered language may be translated: bounds the Editions a Topic can
    // spawn (each fires a billable run) and keeps `lang` safe to reflect into markup.
    if (!isKnownLang(lang)) return { acquired: false, reason: "unsupported-language" };
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) return { acquired: false, reason: "no-topic" };
    // Whitelabel: starting a translation (a billable Edition) is create-side —
    // gated by the tenant's `translations` flag (no-op on the default site).
    // Throws rather than returning a reason, so a disabled feature surfaces as an
    // error to the caller exactly like the other four gated mutations (issue 17).
    await assertTenantFlag(ctx, topic.tenantSlug, "translations");
    // Frozen content only — an Edition can't go stale under the reader (ADR 0015).
    if ((topic.status ?? "active") !== "completed") return { acquired: false, reason: "not-completed" };

    const job = await ctx.db
      .query("translationJobs")
      .withIndex("by_topic_lang", (q) => q.eq("topicId", topic._id).eq("lang", lang))
      .unique();
    // Single-flight: a language already mid-translation must finish (or be removed)
    // before another fire — else the run is triggered twice for one Edition. But a
    // run killed infra-side never reports, so a job whose heartbeat went silent
    // (or that never had one) is dead: retaking its lock is the only way out.
    if (
      job &&
      job.status === "translating" &&
      job.claimedAt !== undefined &&
      Date.now() - job.claimedAt < STALE_MS
    )
      return { acquired: false, reason: "already-translating" };

    const items = await collectItems(ctx, topic);
    let done = 0;
    for (const it of items) if (await isFresh(ctx, topic._id, lang, it)) done++;
    const patch = {
      status: "translating" as const,
      total: items.length,
      // Fresh rows from a prior (dead) run are kept, so the count resumes, not
      // restarts — the run itself skips them via `collectForTranslation`.
      done,
      failed: 0,
      error: undefined,
      claimedAt: Date.now(), // the heartbeat — publishTranslation re-stamps it per item
      runId: undefined,
    };
    if (job) await ctx.db.patch(job._id, patch);
    else await ctx.db.insert("translationJobs", { topicId: topic._id, lang, ...patch });
    return { acquired: true, topicSlug, lang, total: items.length };
  },
});

// Release the lock when the fire itself fails to land (network / config). The run
// never started, so this is an internal failure, not a run report.
export const failTranslation = internalMutation({
  args: { topicSlug: v.string(), lang: v.string(), error: v.string() },
  returns: v.null(),
  handler: async (ctx, { topicSlug, lang, error }): Promise<null> => {
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) return null;
    const job = await ctx.db
      .query("translationJobs")
      .withIndex("by_topic_lang", (q) => q.eq("topicId", topic._id).eq("lang", lang))
      .unique();
    if (job) await ctx.db.patch(job._id, { status: "failed", error, claimedAt: undefined, runId: undefined });
    return null;
  },
});

type FireResult = { fired: boolean; reason?: string; error?: string };

// Owner: translate a completed course into `lang`. ALL translation runs on Gemini
// via the in-Convex translate action, regardless of the course's authoring Provider
// — the claude.ai translate Routine is never fired (this branch supersedes the
// PRD's "translation follows provider": a Claude-authored course still translates
// through Gemini). Acquire the lock, then schedule the action; on a failed
// schedule, release the lock. Idempotent re-translate is a re-fire once the prior
// run is no longer `translating`. The action reads the key for the configured
// TRANSLATE_PROVIDER: GOOGLE_AI_API_KEY (default, native Gemini) or
// OPENROUTER_API_KEY (the rollback path).
export const startTranslation = action({
  args: { topicSlug: v.string(), lang: v.string() },
  returns: v.object({ fired: v.boolean(), reason: v.optional(v.string()), error: v.optional(v.string()) }),
  handler: async (ctx, { topicSlug, lang }): Promise<FireResult> => {
    const acq: AcquireResult = await ctx.runMutation(internal.translate.tryAcquireTranslation, { topicSlug, lang });
    if (!acq.acquired) {
      // The client surfaces these as errors (same messages as before the routine cut-over).
      if (acq.reason === "no-topic" || acq.reason === "unauthenticated") throw new Error("topic not found");
      if (acq.reason === "not-completed") throw new Error("only a completed course can be translated");
      if (acq.reason === "unsupported-language") throw new Error("unsupported language");
      if (acq.reason === "source-language") throw new Error("cannot translate to the source language");
      if (acq.reason === "already-translating") throw new Error("a translation is already in progress for this language");
      return { fired: false, reason: acq.reason };
    }

    // Always schedule the Gemini translate action — no `claimTranslation`, no POST
    // to the claude.ai translate Routine. The gate/lock + reportTranslation are
    // reused unchanged; a failed schedule releases the lock.
    try {
      await ctx.scheduler.runAfter(0, internal.translate.translateTopic, { topicSlug, lang });
      return { fired: true };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(internal.translate.failTranslation, { topicSlug, lang, error });
      return { fired: false, reason: "fire-error", error };
    }
  },
});

// Remove an Edition entirely: its translated rows, its job, its language-scoped
// Shares/pending invites, and its Public link. English (the source) can't be
// removed. Owner-only.
export const removeEdition = mutation({
  args: { topicSlug: v.string(), lang: v.string() },
  returns: v.null(),
  handler: async (ctx, { topicSlug, lang }): Promise<null> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    if (lang === SOURCE_LANG) throw new Error("cannot remove the source edition");
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("topic not found");

    const rows = await ctx.db
      .query("translations")
      .withIndex("by_topic_lang", (q) => q.eq("topicId", topic._id).eq("lang", lang))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
    const job = await ctx.db
      .query("translationJobs")
      .withIndex("by_topic_lang", (q) => q.eq("topicId", topic._id).eq("lang", lang))
      .unique();
    if (job) await ctx.db.delete(job._id);
    const links = await ctx.db
      .query("publicLinks")
      .withIndex("by_topic_lang", (q) => q.eq("topicId", topic._id).eq("lang", lang))
      .collect();
    for (const l of links) await ctx.db.delete(l._id);
    const shares = await ctx.db.query("shares").withIndex("by_topic", (q) => q.eq("topicId", topic._id)).collect();
    for (const s of shares) if (shareLang(s) === lang) await ctx.db.delete(s._id);
    const pend = await ctx.db.query("pendingShares").withIndex("by_topic", (q) => q.eq("topicId", topic._id)).collect();
    for (const p of pend) if ((p.lang ?? SOURCE_LANG) === lang) await ctx.db.delete(p._id);
    return null;
  },
});

// ---- Owner/Editor: edition title & mission edit (edition-title-edit 01) -----

// Fix an Edition's translated title or mission in place — the topic-level
// counterpart of the translated-Lesson edit, same trust boundary (owner or that
// Edition's Editor, ADR 0020). Stamps the CURRENT source hash so a re-translate
// sees the item fresh and keeps the edit; it goes stale (re-translated) only if
// the English source text itself changes later. Blank text reverts to auto:
// the row is dropped, the reader falls back to the English source, and the next
// re-translate regenerates it.
export const editEditionText = mutation({
  args: {
    topicSlug: v.string(),
    lang: v.string(),
    kind: v.union(v.literal("title"), v.literal("mission")),
    text: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { topicSlug, lang, kind, text }): Promise<null> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    // The source keeps its owner-only paths (renameTopic / editMission).
    if (lang === SOURCE_LANG) throw new Error("not a translated edition");
    const topic = await getEditableTopic(ctx, userId, topicSlug, lang);
    if (!topic) throw new Error("topic not found");
    const source = kind === "title" ? topic.title : topic.mission;
    if (source === undefined) throw new Error("this course has no mission");

    const existing = await ctx.db
      .query("translations")
      .withIndex("by_topic_lang_kind_key", (q) =>
        q.eq("topicId", topic._id).eq("lang", lang).eq("kind", kind).eq("key", ""),
      )
      .unique();
    const trimmed = text.trim();
    if (trimmed === "") {
      if (existing) await ctx.db.delete(existing._id);
      return null;
    }
    const row = { topicId: topic._id, lang, kind, key: "", text: trimmed, sourceHash: itemHash(kind, { text: source }) };
    if (existing) await ctx.db.replace(existing._id, row);
    else await ctx.db.insert("translations", row);
    return null;
  },
});

// ---- The run's seams (PUBLISH_SECRET-guarded) ------------------------------

// Legacy/manual seam (the fired-Routine flow — `startTranslation` no longer
// fires it): atomically grab one translation job whose run is DEAD — heartbeat
// absent or silent past STALE_MS — and stamp a fresh heartbeat + runId. A live
// job (the Gemini action ticking `claimedAt` via publishes) is never stealable.
// Returns the claimed Topic slug, target language, and owner email (for the
// owner-scoped materialise/publish), or null if none waiting.
export const claimTranslation = mutation({
  args: { secret: v.string(), runId: v.string() },
  returns: v.union(
    v.null(),
    v.object({ topicSlug: v.string(), lang: v.string(), ownerEmail: v.union(v.string(), v.null()) }),
  ),
  handler: async (
    ctx,
    { secret, runId },
  ): Promise<{ topicSlug: string; lang: string; ownerEmail: string | null } | null> => {
    assertAdmin(secret);
    // ponytail: full scan of the lock table (mirrors routine.claimWork) — one row
    // per (Topic, language), so tiny in practice. Add a `by_status` index if the
    // edition count ever grows large enough to matter.
    const jobs = await ctx.db.query("translationJobs").collect();
    const candidate = jobs
      .filter(
        (j) =>
          j.status === "translating" &&
          (j.claimedAt === undefined || Date.now() - j.claimedAt >= STALE_MS),
      )
      .sort((a, b) => a._creationTime - b._creationTime)[0];
    if (!candidate) return null;
    await ctx.db.patch(candidate._id, { claimedAt: Date.now(), runId });
    const topic = await ctx.db.get(candidate.topicId);
    if (!topic) return null;
    const owner = topic.ownerId ? await ctx.db.get(topic.ownerId) : null;
    return { topicSlug: topic.slug, lang: candidate.lang, ownerEmail: owner?.email ?? null };
  },
});

// Publish one translated item back to the Hub and tick the job (mirrors the
// teach-CLI publish path). Owner-scoped by email (the run has no auth identity).
// Re-reads the source to stamp its hash and, for a Lesson, to reject a
// translation whose quiz-marker counts changed (positional scoring must survive)
// — a rejected/vanished item is skipped, leaving the English fallback. A missing
// job means the Edition was removed mid-run: skip, so no orphan row is inserted.
export const publishTranslation = mutation({
  args: {
    secret: v.string(),
    ownerEmail: v.string(),
    topicSlug: v.string(),
    lang: v.string(),
    kind: kindV,
    key: v.string(),
    title: v.optional(v.string()),
    html: v.optional(v.string()),
    text: v.optional(v.string()),
    reply: v.optional(v.string()),
  },
  returns: v.object({ status: v.union(v.literal("saved"), v.literal("skipped")) }),
  handler: async (ctx, a): Promise<{ status: "saved" | "skipped" }> => {
    assertAdmin(a.secret);
    const owner = await ctx.db.query("users").withIndex("email", (q) => q.eq("email", a.ownerEmail)).unique();
    if (!owner) throw new Error("owner not found");
    const topic = await getOwnedTopic(ctx, owner._id, a.topicSlug);
    if (!topic) throw new Error("topic not found");

    const job = await ctx.db
      .query("translationJobs")
      .withIndex("by_topic_lang", (q) => q.eq("topicId", topic._id).eq("lang", a.lang))
      .unique();
    if (!job) return { status: "skipped" }; // Edition removed mid-run — no orphan rows.

    const src = await readSource(ctx, topic._id, a.kind, a.key);
    if (!src) return { status: "skipped" }; // source vanished — leave the English fallback.

    const html = a.html !== undefined ? stripFence(a.html) : undefined;
    // A structural drift in a Lesson's quiz markers would break positional scoring
    // — skip it (English fallback) rather than ship a broken quiz. The guard needs
    // the source markup; once the source body is a content blob it isn't readable
    // in a mutation, so the check is skipped (the run is trusted, secret-guarded).
    if (a.kind === "lesson" && html !== undefined && src.html !== undefined && !quizStructureMatches(src.html, html)) {
      return { status: "skipped" };
    }

    const row = {
      topicId: topic._id,
      lang: a.lang,
      kind: a.kind,
      key: a.key,
      title: a.title,
      html,
      text: a.text,
      reply: a.reply,
      sourceHash: src.hash,
    };
    const existing = await ctx.db
      .query("translations")
      .withIndex("by_topic_lang_kind_key", (q) =>
        q.eq("topicId", topic._id).eq("lang", a.lang).eq("kind", a.kind).eq("key", a.key),
      )
      .unique();
    if (existing) await ctx.db.replace(existing._id, row);
    else await ctx.db.insert("translations", row);
    // The tick doubles as the run's heartbeat: while items keep landing, the
    // lock stays held; silence past STALE_MS marks the run dead (re-fireable).
    await ctx.db.patch(job._id, { done: job.done + 1, claimedAt: Date.now() });
    return { status: "saved" };
  },
});

// The run's final report, releasing the lock (mirrors `routine.reportGeneration`).
// "ready" makes the Edition usable — any item the run didn't publish counts as
// `failed` and falls back to English in the reader; "failed" surfaces a retry.
export const reportTranslation = mutation({
  args: {
    secret: v.string(),
    topicSlug: v.string(),
    lang: v.string(),
    outcome: v.union(v.literal("ready"), v.literal("failed")),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { secret, topicSlug, lang, outcome, error }): Promise<null> => {
    assertAdmin(secret);
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) throw new Error("topic not found");
    const job = await ctx.db
      .query("translationJobs")
      .withIndex("by_topic_lang", (q) => q.eq("topicId", topic._id).eq("lang", lang))
      .unique();
    if (!job) return null;
    const clear = { claimedAt: undefined, runId: undefined };
    if (outcome === "ready") {
      await ctx.db.patch(job._id, { status: "ready", failed: Math.max(0, job.total - job.done), error: undefined, ...clear });
    } else {
      await ctx.db.patch(job._id, { status: "failed", error: error ?? "translation run failed", ...clear });
    }
    return null;
  },
});

// ---- Gemini translate path -------------------------------------------------

// The source content for every translatable item + the owner email the publish
// seam keys by, in one round-trip. The translate action's context seam (internal,
// keyed by slug + lang), mirroring routine.materialiseForProvider on the authoring
// side. Null if the Topic or owner is missing.
export const collectForTranslation = internalQuery({
  args: { topicSlug: v.string(), lang: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      ownerEmail: v.union(v.string(), v.null()),
      items: v.array(
        v.object({
          kind: kindV,
          key: v.string(),
          title: v.optional(v.string()),
          htmlStorageId: v.optional(v.id("_storage")),
          text: v.optional(v.string()),
          reply: v.optional(v.string()),
        }),
      ),
    }),
  ),
  handler: async (ctx, { topicSlug, lang }) => {
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic || !topic.ownerId) return null;
    const owner = await ctx.db.get(topic.ownerId);
    if (!owner) return null;
    const items = [];
    for (const it of await collectItems(ctx, topic)) {
      // Already translated from this exact source → skip, so a re-fire after a
      // killed run resumes where it stopped instead of re-paying the whole course.
      if (await isFresh(ctx, topic._id, lang, it)) continue;
      const src = await readSource(ctx, topic._id, it.kind, it.key);
      // Lesson/reference bodies live in content blobs; hand the action the blob
      // id so it can read the bytes (a query can't) and translate the body.
      items.push({ kind: it.kind, key: it.key, title: src?.title, htmlStorageId: src?.htmlStorageId, text: src?.text, reply: src?.reply });
    }
    return { ownerEmail: owner.email ?? null, items };
  },
});

// The translation prompt for one item. `html` mode preserves every tag/attribute
// (quiz markers must survive — publishTranslation rejects structural drift); `text`
// mode is for the plain title/mission. Returns only the translation.
export function buildTranslateMessages(content: string, langName: string, mode: "html" | "text"): ChatMessage[] {
  const system =
    mode === "html"
      ? `You are a professional translator. Translate ALL human-readable text of the following HTML into ${langName}. This INCLUDES quoted passages, block quotes, and the "Sources"/citation footer (e.g. a <footer> that quotes source works) — a quoted teaching passage is learner-read prose; never leave it in the source language just because it is a quotation. Preserve EVERY HTML tag, attribute, and value EXACTLY — especially quiz markers (class names, data-correct, data-answer, data-k, data-alt). Do not add, remove, or reorder elements. Keep unchanged: author names, the titles of cited works, proper nouns, and page/verse references (translate the quoted words themselves, not the attribution); and any fill-in-the-blank quiz sentence whose answer is a word the learner must type in the source language. For Bible quotations, use the wording of a widely-used published ${langName} Bible rather than translating the English yourself. Return ONLY the translated HTML, with no code fence and no commentary.`
      : `You are a professional translator. Translate the following text into ${langName}. Return ONLY the translation, with no quotes or commentary.`;
  return [
    { role: "system", content: system },
    { role: "user", content },
  ];
}

// Which provider runs translation, per-deployment. Default `gemini` — the native
// Google AI Studio API, where thinking is genuinely disabled (translation-cost 05);
// `openrouter` keeps the legacy Gemini-via-OpenRouter path as a rollback. Case/space
// tolerant; any other value falls back to `gemini`.
function translateProvider(): "gemini" | "openrouter" {
  return (process.env.TRANSLATE_PROVIDER ?? "").trim().toLowerCase() === "openrouter" ? "openrouter" : "gemini";
}

// Translate one item's field, single-pass. Empty content is returned as-is
// (nothing to translate) to avoid a wasted call. Either provider runs with
// thinking/reasoning OFF — thinking tokens are billed as output and buy nothing
// for constrained translation (translation-cost 02/05) — but only the native
// Gemini path actually honours the opt-out (the reason it's the default).
async function translateField(content: string, langName: string, mode: "html" | "text"): Promise<string> {
  if (content.trim() === "") return content;
  const messages = buildTranslateMessages(content, langName, mode);
  if (translateProvider() === "openrouter") {
    return await chatComplete({ model: translateModel(), messages, reasoning: "none" });
  }
  return await geminiComplete({ model: geminiTranslateModel(), messages });
}

// Items translated per action invocation. A big course can't finish inside one
// action's execution ceiling (the 56-lesson prod course was killed at 28/59
// after ~20 minutes), so each invocation does a bounded chunk and reschedules
// itself for the rest. ~45s/item observed → a chunk stays a few minutes.
const CHUNK = 5;

// Translate a completed course into `lang` via the configured translate provider
// (default native Gemini), in chunks of CHUNK items per invocation. Reads each
// source item, translates it single-pass,
// and publishes through the existing publishTranslation (which stamps the source
// hash + rejects quiz drift), ticking the job. `remaining` (absent on the first
// invocation) pins the continuation's work-list, so an item that publish refuses
// (skipped) can never be retried forever. Reports ready/failed via the existing
// reportTranslation, so the lock never sticks and unpublished items fall back to
// English in the reader.
export const translateTopic = internalAction({
  args: { topicSlug: v.string(), lang: v.string(), remaining: v.optional(v.array(v.string())) },
  returns: v.null(),
  handler: async (ctx, { topicSlug, lang, remaining }): Promise<null> => {
    const secret = process.env.PUBLISH_SECRET;
    if (!secret) throw new Error("PUBLISH_SECRET not set");
    try {
      const info = await ctx.runQuery(internal.translate.collectForTranslation, { topicSlug, lang });
      if (!info || !info.ownerEmail) throw new Error("no translation context (missing topic or owner)");
      const ownerEmail = info.ownerEmail;
      const langName = langInfo(lang).name;

      // Fresh items are already gone (collectForTranslation skips them); a
      // continuation additionally narrows to its handed-down work-list.
      let items = info.items;
      if (remaining) {
        const keep = new Set(remaining);
        items = items.filter((it) => keep.has(it.kind + ":" + it.key));
      }
      const rest = items.slice(CHUNK);
      for (const item of items.slice(0, CHUNK)) {
        if (item.kind === "lesson" || item.kind === "reference") {
          // The body is a content blob; an action can read its bytes directly
          // (no HTTP round-trip) and translate the markup. Styles/scripts are
          // swapped out first — the model translates only the real content.
          const blob = item.htmlStorageId ? await ctx.storage.get(item.htmlStorageId) : null;
          const body = blob ? await blob.text() : "";
          const { stripped, blocks } = swapOutStatic(body);
          const translated = stripFence(await translateField(stripped, langName, "html"));
          const html = swapBackStatic(translated, blocks);
          // A mangled placeholder or a dropped quiz marker means a corrupt body:
          // skip the item (English fallback; counted `failed` at report). The
          // mutation-side quiz guard can't read blobs, so this is THE check.
          if (html === null || !quizStructureMatches(body, html)) continue;
          await ctx.runMutation(api.translate.publishTranslation, {
            secret,
            ownerEmail,
            topicSlug,
            lang,
            kind: item.kind,
            key: item.key,
            title: await translateField(item.title ?? "", langName, "text"),
            html,
          });
        } else {
          // title / mission — a single text field.
          await ctx.runMutation(api.translate.publishTranslation, {
            secret,
            ownerEmail,
            topicSlug,
            lang,
            kind: item.kind,
            key: item.key,
            text: await translateField(item.text ?? "", langName, "text"),
          });
        }
      }
      if (rest.length > 0) {
        // Continue in a fresh invocation so the run never outlives the ceiling.
        await ctx.scheduler.runAfter(0, internal.translate.translateTopic, {
          topicSlug,
          lang,
          remaining: rest.map((it) => it.kind + ":" + it.key),
        });
        return null;
      }
      await ctx.runMutation(api.translate.reportTranslation, { secret, topicSlug, lang, outcome: "ready" });
      return null;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(api.translate.reportTranslation, { secret, topicSlug, lang, outcome: "failed", error });
      return null;
    }
  },
});

// ---- Static-block placeholder swap (translation-cost 01) --------------------

// ~70% of a Lesson document is fixed <style>/<script> boilerplate. It carries no
// translatable text, but sent to the model it's paid for on input AND echoed back
// on output. So the run swaps each such element for a tiny numbered placeholder
// comment before translating and restores the originals after — the model never
// sees (or can corrupt) the CSS/JS at all.
const STATIC_BLOCK = /<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi;
const PLACEHOLDER = /<!--⟦(\d+)⟧-->/g;

export function swapOutStatic(html: string): { stripped: string; blocks: string[] } {
  const blocks: string[] = [];
  const stripped = html.replace(STATIC_BLOCK, (block) => {
    blocks.push(block);
    return `<!--⟦${blocks.length - 1}⟧-->`;
  });
  return { stripped, blocks };
}

// Restore the swapped-out blocks. Null unless every placeholder came back exactly
// once and none were invented — a null means the model mangled the structure, and
// the caller must skip the item (English fallback) rather than publish it.
export function swapBackStatic(translated: string, blocks: string[]): string | null {
  const seen = [...translated.matchAll(PLACEHOLDER)].map((m) => Number(m[1]));
  if (seen.length !== blocks.length) return null;
  if (new Set(seen).size !== seen.length) return null;
  if (seen.some((n) => n >= blocks.length)) return null;
  // Function replacement — a `$` inside CSS/JS must never be treated as a pattern.
  return translated.replace(PLACEHOLDER, (_, n) => blocks[Number(n)]!);
}

// ---- Translation-fidelity guard --------------------------------------------

// Defensive: strip a ```html … ``` fence if the run wraps the document.
function stripFence(s: string): string {
  const m = s.trim().match(/^```(?:html)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1]!.trim() : s.trim();
}

// True when the quiz-scoring markers survived translation unchanged. The reader
// derives quiz identity positionally and reads data-correct/data-answer/data-k
// (lessonSrcDoc), so a changed count means a broken quiz. Reused by the owner
// prose-edit path (content.editLesson) to reject a structural change to a Lesson.
export function quizStructureMatches(source: string, out: string): boolean {
  for (const re of [/data-correct=/g, /data-answer=/g, /data-k=/g]) {
    if ((source.match(re) ?? []).length !== (out.match(re) ?? []).length) return false;
  }
  return true;
}

// ---- Owner: the Editions panel data ----------------------------------------

// The owner's Editions of a Topic: English (the source, always ready) plus one
// per translation job, each with live status + how many Shares and a Public link
// it has. Owner-only; null when signed-out or not the owner.
export const editions = query({
  args: { topicSlug: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      completed: v.boolean(),
      editions: v.array(
        v.object({
          lang: v.string(),
          name: v.string(),
          native: v.string(),
          rtl: v.boolean(),
          source: v.boolean(),
          status: v.union(v.literal("translating"), v.literal("ready"), v.literal("failed")),
          total: v.number(),
          done: v.number(),
          failed: v.number(),
          shareCount: v.number(),
          publicToken: v.union(v.string(), v.null()),
        }),
      ),
    }),
  ),
  handler: async (ctx, { topicSlug }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) return null;

    const shares = await ctx.db.query("shares").withIndex("by_topic", (q) => q.eq("topicId", topic._id)).collect();
    const links = await ctx.db.query("publicLinks").withIndex("by_topic", (q) => q.eq("topicId", topic._id)).collect();
    const jobs = await ctx.db.query("translationJobs").withIndex("by_topic", (q) => q.eq("topicId", topic._id)).collect();

    const shareCount = (lang: string) => shares.filter((s) => shareLang(s) === lang).length;
    const tokenFor = (lang: string) => {
      const link = links.find((l) => l.lang === lang);
      if (link) return link.token;
      // Legacy: the pre-translation single per-Topic token is the English link.
      if (lang === SOURCE_LANG && topic.publicToken) return topic.publicToken;
      return null;
    };

    const editions = [
      {
        lang: SOURCE_LANG,
        name: "English",
        native: "English",
        rtl: false,
        source: true,
        status: "ready" as const,
        total: 0,
        done: 0,
        failed: 0,
        shareCount: shareCount(SOURCE_LANG),
        publicToken: tokenFor(SOURCE_LANG),
      },
      ...jobs
        .sort((a, b) => a.lang.localeCompare(b.lang))
        .map((j) => {
          const li = langInfo(j.lang);
          return {
            lang: j.lang,
            name: li.name,
            native: li.native,
            rtl: !!li.rtl,
            source: false,
            status: j.status,
            total: j.total,
            done: j.done,
            failed: j.failed,
            shareCount: shareCount(j.lang),
            publicToken: tokenFor(j.lang),
          };
        }),
    ];
    return { completed: (topic.status ?? "active") === "completed", editions };
  },
});

// Read one Edition's translated bodies for an out-of-band correction pass — the
// read sibling of `publishTranslation`, same secret-guarded trust model as
// `materialiseTopic` (the run has no auth identity). Topic+lang scoped, read-only,
// carries no tokens/PII. Returns inline `html` directly and a signed `url` for a
// blob-backed body, so the correction CLI can pull an Edition to disk, fix the
// text, and republish through `publishTranslation`. Null if the Topic is missing.
export const readEditionBodies = query({
  args: { secret: v.string(), topicSlug: v.string(), lang: v.string() },
  returns: v.union(
    v.null(),
    v.array(
      v.object({
        kind: kindV,
        key: v.string(),
        title: v.optional(v.string()),
        html: v.optional(v.string()),
        url: v.union(v.string(), v.null()),
        text: v.optional(v.string()),
        reply: v.optional(v.string()),
      }),
    ),
  ),
  handler: async (ctx, { secret, topicSlug, lang }) => {
    assertAdmin(secret);
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) return null;
    const rows = await ctx.db
      .query("translations")
      .withIndex("by_topic_lang", (q) => q.eq("topicId", topic._id).eq("lang", lang))
      .collect();
    const out = [];
    for (const r of rows) {
      out.push({
        kind: r.kind,
        key: r.key,
        title: r.title,
        html: r.html,
        url: r.htmlStorageId ? await ctx.storage.getUrl(r.htmlStorageId) : null,
        text: r.text,
        reply: r.reply,
      });
    }
    return out;
  },
});
