import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getOwnedTopic, hashString, SOURCE_LANG, shareLang } from "./lib";
import { langInfo } from "./languages";

// Course translation (Editions). An owner-triggered Convex action fans out one
// Claude Messages-API call per item over the scheduler, writing a `translations`
// row per successful item and a live `translationJobs` row for progress. No LLM
// runs in the web app (ADR 0001): this is backend/action work, kicked off by the
// owner and observed reactively. Only a `completed` course can be translated —
// which freezes its content, so an Edition never drifts stale under the reader.

const kindV = v.union(
  v.literal("lesson"),
  v.literal("reference"),
  v.literal("mission"),
  v.literal("title"),
  v.literal("question"),
);
type Kind = "lesson" | "reference" | "mission" | "title" | "question";

// ---- Source enumeration + staleness hashing -------------------------------

// The hash of a source item's content, used to skip re-translating unchanged
// items on a re-translate. Must be computed identically in `collectItems`
// (enumerate) and `getSourceItem` (per-item read), so both route through here.
function itemHash(kind: Kind, f: { title?: string; html?: string; text?: string; reply?: string }): string {
  if (kind === "lesson" || kind === "reference") return hashString((f.title ?? "") + "|" + (f.html ?? ""));
  if (kind === "question") return hashString((f.text ?? "") + "|" + (f.reply ?? ""));
  return hashString(f.text ?? ""); // title, mission
}

type Item = { kind: Kind; key: string; hash: string };

// Every translatable item of a Topic: its title, mission (if any), each
// non-superseded Lesson + Reference, and the owner's Q&A. Lesson/reference HTML
// isn't returned here (enumeration only) — the per-item action re-reads it.
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

  if (topic.ownerId) {
    const ownerId = topic.ownerId;
    const questions = await ctx.db
      .query("questions")
      .withIndex("by_topic_user", (q) => q.eq("topicId", topic._id).eq("userId", ownerId))
      .collect();
    for (const q of questions) items.push({ kind: "question", key: q._id, hash: itemHash("question", q) });
  }
  return items;
}

// ---- Owner: start / re-translate an Edition -------------------------------

// Bulk-translate a completed course into `lang`. Owner-only, completed-gated (no
// cap in the alpha). Idempotent re-translate: only items whose source content
// changed since last time (by hash) are scheduled, so re-running is cheap and
// never re-bills unchanged Lessons. Seeds/updates the job, then fans out.
export const startTranslation = mutation({
  args: { topicSlug: v.string(), lang: v.string() },
  returns: v.object({ total: v.number(), scheduled: v.number() }),
  handler: async (ctx, { topicSlug, lang }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    if (lang === SOURCE_LANG) throw new Error("cannot translate to the source language");
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("topic not found");
    // Only a completed course is translatable — its content is frozen, so the
    // Edition can't go stale as the Routine authors more Lessons.
    if ((topic.status ?? "active") !== "completed") throw new Error("only a completed course can be translated");

    const items = await collectItems(ctx, topic);
    const existing = await ctx.db
      .query("translations")
      .withIndex("by_topic_lang", (q) => q.eq("topicId", topic._id).eq("lang", lang))
      .collect();
    const have = new Map(existing.map((t) => [`${t.kind}:${t.key}`, t.sourceHash]));
    const stale = items.filter((it) => have.get(`${it.kind}:${it.key}`) !== it.hash);

    const total = items.length;
    const done = total - stale.length; // items already fresh count as done
    const patch = {
      status: (stale.length > 0 ? "translating" : "ready") as "translating" | "ready",
      total,
      done,
      failed: 0,
      error: undefined,
    };
    const job = await ctx.db
      .query("translationJobs")
      .withIndex("by_topic_lang", (q) => q.eq("topicId", topic._id).eq("lang", lang))
      .unique();
    if (job) await ctx.db.patch(job._id, patch);
    else await ctx.db.insert("translationJobs", { topicId: topic._id, lang, ...patch });

    for (const it of stale) {
      await ctx.scheduler.runAfter(0, internal.translate.translateItem, {
        topicId: topic._id,
        lang,
        kind: it.kind,
        key: it.key,
      });
    }
    return { total, scheduled: stale.length };
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

// ---- Per-item translation (scheduler → Claude → save) ---------------------

type SourceItem = {
  courseTitle: string;
  courseMission: string | null;
  title?: string;
  html?: string;
  text?: string;
  reply?: string;
  hash: string;
};

// The source content for one item, read fresh (the action has no db access).
// Returns null if the item vanished (e.g. a Lesson superseded) — the action then
// records a skip so the job still completes.
export const getSourceItem = internalQuery({
  args: { topicId: v.id("topics"), kind: kindV, key: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      courseTitle: v.string(),
      courseMission: v.union(v.string(), v.null()),
      title: v.optional(v.string()),
      html: v.optional(v.string()),
      text: v.optional(v.string()),
      reply: v.optional(v.string()),
      hash: v.string(),
    }),
  ),
  handler: async (ctx, { topicId, kind, key }): Promise<SourceItem | null> => {
    const topic = await ctx.db.get(topicId);
    if (!topic) return null;
    const base = { courseTitle: topic.title, courseMission: topic.mission ?? null };
    if (kind === "title") return { ...base, text: topic.title, hash: itemHash("title", { text: topic.title }) };
    if (kind === "mission") {
      if (!topic.mission) return null;
      return { ...base, text: topic.mission, hash: itemHash("mission", { text: topic.mission }) };
    }
    if (kind === "lesson") {
      const l = await ctx.db
        .query("lessons")
        .withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", key))
        .unique();
      if (!l || l.supersededBy) return null;
      return { ...base, title: l.title, html: l.html, hash: itemHash("lesson", l) };
    }
    if (kind === "reference") {
      const r = await ctx.db
        .query("references")
        .withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", key))
        .unique();
      if (!r) return null;
      return { ...base, title: r.title, html: r.html, hash: itemHash("reference", r) };
    }
    // question
    const q = await ctx.db.get(key as Id<"questions">);
    if (!q || q.topicId !== topicId) return null;
    return { ...base, text: q.text, reply: q.reply ?? "", hash: itemHash("question", q) };
  },
});

export const translateItem = internalAction({
  args: { topicId: v.id("topics"), lang: v.string(), kind: kindV, key: v.string() },
  returns: v.null(),
  handler: async (ctx, { topicId, lang, kind, key }): Promise<null> => {
    const src: SourceItem | null = await ctx.runQuery(internal.translate.getSourceItem, { topicId, kind, key });
    if (!src) {
      await ctx.runMutation(internal.translate.saveTranslation, { topicId, lang, kind, key, outcome: "skip", sourceHash: "" });
      return null;
    }
    try {
      const out = await translateViaClaude(kind, lang, src);
      await ctx.runMutation(internal.translate.saveTranslation, {
        topicId,
        lang,
        kind,
        key,
        outcome: "ok",
        sourceHash: src.hash,
        ...out,
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(internal.translate.saveTranslation, {
        topicId,
        lang,
        kind,
        key,
        outcome: "failed",
        sourceHash: src.hash,
        error,
      });
    }
    return null;
  },
});

export const saveTranslation = internalMutation({
  args: {
    topicId: v.id("topics"),
    lang: v.string(),
    kind: kindV,
    key: v.string(),
    outcome: v.union(v.literal("ok"), v.literal("failed"), v.literal("skip")),
    sourceHash: v.string(),
    title: v.optional(v.string()),
    html: v.optional(v.string()),
    text: v.optional(v.string()),
    reply: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx: MutationCtx, a): Promise<null> => {
    if (a.outcome === "ok") {
      const existing = await ctx.db
        .query("translations")
        .withIndex("by_topic_lang_kind_key", (q) =>
          q.eq("topicId", a.topicId).eq("lang", a.lang).eq("kind", a.kind).eq("key", a.key),
        )
        .unique();
      const row = {
        topicId: a.topicId,
        lang: a.lang,
        kind: a.kind,
        key: a.key,
        title: a.title,
        html: a.html,
        text: a.text,
        reply: a.reply,
        sourceHash: a.sourceHash,
      };
      if (existing) await ctx.db.replace(existing._id, row);
      else await ctx.db.insert("translations", row);
    }
    const job = await ctx.db
      .query("translationJobs")
      .withIndex("by_topic_lang", (q) => q.eq("topicId", a.topicId).eq("lang", a.lang))
      .unique();
    if (!job) return null;
    const done = job.done + (a.outcome === "failed" ? 0 : 1);
    const failed = job.failed + (a.outcome === "failed" ? 1 : 0);
    const complete = done + failed >= job.total;
    // Any successful item makes the Edition usable ("ready", failures shown as a
    // count); only an all-failed run is "failed".
    const status = complete ? (done > 0 ? "ready" : "failed") : "translating";
    await ctx.db.patch(job._id, { done, failed, status, error: a.error ?? job.error });
    return null;
  },
});

// ---- The Claude Messages API call -----------------------------------------

// Faithful HTML translation: preserve ALL structure/scripts/ids/data-* and the
// object of study; translate only human-readable prose. The hard rules matter —
// quiz scoring reads data-correct/data-k/data-answer positionally (lessonSrcDoc).
function htmlSystem(lang: string, src: SourceItem): string {
  const name = langInfo(lang).name;
  const mission = src.courseMission ? `\nMission: ${src.courseMission.slice(0, 500)}` : "";
  return [
    `You are a professional translator localizing an interactive HTML lesson from a self-paced course into ${name} (${lang}).`,
    ``,
    `Course: ${src.courseTitle}${mission}`,
    ``,
    `Output ONLY the translated HTML — no markdown fences, no commentary. Your entire reply must be valid HTML that can replace the original verbatim.`,
    ``,
    `Preserve EXACTLY, unchanged:`,
    `- every tag, attribute, class, and id`,
    `- all data-* attributes, especially data-correct, data-k, data-answer, data-alt (quiz scoring reads these; they must not change)`,
    `- every <script> and <style> block, and all inline JS/CSS`,
    `- href/src values and URLs`,
    `- the number and order of elements — never add, remove, reorder, or merge anything, especially .quiz blocks and their .opt options (quiz identity is positional)`,
    ``,
    `Translate into ${name} ONLY the human-readable text: visible text nodes and the human-readable values of title, alt, placeholder, and aria-label.`,
    ``,
    `Do NOT translate the OBJECT OF STUDY — any foreign-language material the course teaches (vocabulary, example sentences, non-Latin scripts), code, proper nouns, or the values inside data-answer / data-alt. Leave all of it exactly as-is. When unsure whether a token is being taught rather than explained, leave it unchanged.`,
  ].join("\n");
}

function textSystem(lang: string, src: SourceItem, what: string): string {
  const name = langInfo(lang).name;
  return `Translate the following ${what} into ${name} (${lang}). Output ONLY the translation — no quotes, no commentary. Preserve any HTML tags, markdown, code, proper nouns, and foreign-language study material unchanged; translate only the natural-language prose. Course: ${src.courseTitle}.`;
}

async function translateViaClaude(
  kind: Kind,
  lang: string,
  src: SourceItem,
): Promise<{ title?: string; html?: string; text?: string; reply?: string }> {
  if (kind === "lesson" || kind === "reference") {
    const title = await callClaude(textSystem(lang, src, "short title"), src.title ?? "");
    const html = stripFence(await callClaude(htmlSystem(lang, src), src.html ?? ""));
    if (kind === "lesson") validateHtmlStructure(src.html ?? "", html);
    return { title, html };
  }
  if (kind === "title") return { text: await callClaude(textSystem(lang, src, "course title"), src.text ?? "") };
  if (kind === "mission") return { text: await callClaude(textSystem(lang, src, "course mission"), src.text ?? "") };
  // question
  const text = await callClaude(textSystem(lang, src, "learner's question"), src.text ?? "");
  const reply = src.reply ? await callClaude(textSystem(lang, src, "teacher's reply"), src.reply) : undefined;
  return { text, reply };
}

// One Claude Messages-API call via fetch (default Convex runtime — no "use node").
// Model defaults to Opus 4.8; set TRANSLATION_MODEL=claude-sonnet-5 to trade some
// fidelity for cost. No temperature/top_p (rejected on 4.8), no thinking field.
async function callClaude(system: string, user: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  if (!user.trim()) return "";
  const model = process.env.TRANSLATION_MODEL || "claude-opus-4-8";
  const maxTokens = Number(process.env.TRANSLATION_MAX_TOKENS || "16000");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { stop_reason?: string; content?: Array<{ type?: string; text?: string }> };
  if (data.stop_reason === "refusal") throw new Error("translation refused by safety classifier");
  if (data.stop_reason === "max_tokens") throw new Error("translation truncated — raise TRANSLATION_MAX_TOKENS");
  const text = (data.content ?? [])
    .filter((b) => b?.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("empty translation");
  return text;
}

// Defensive: strip a ```html … ``` fence if the model wraps the document.
function stripFence(s: string): string {
  const m = s.trim().match(/^```(?:html)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1]!.trim() : s.trim();
}

// A cheap structural guard: the count of quiz-scoring markers must survive
// translation. A mismatch means the model added/dropped/renamed a quiz or
// option — which would break positional quiz scoring — so fail the item (falls
// back to the English source in the reader) rather than ship a broken lesson.
function validateHtmlStructure(source: string, out: string): void {
  for (const re of [/data-correct=/g, /data-answer=/g, /data-k=/g]) {
    const a = (source.match(re) ?? []).length;
    const b = (out.match(re) ?? []).length;
    if (a !== b) throw new Error(`quiz structure changed in translation (${re.source}: ${a}→${b})`);
  }
}

// ---- Owner: the Editions panel data ---------------------------------------

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
