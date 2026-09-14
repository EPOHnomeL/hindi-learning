// **AI narration of a Lesson, pilot scope.** The play control inside the lesson,
// under its heading, that reads the lesson aloud in an ElevenLabs voice. The
// control itself is NARRATE_BRIDGE in `src/app/_components/lessonSrcDoc.ts`; this
// is the rail behind it.
//
// This is a deliberately tiny slice of the deferred course-audio design
// (`.plan/maps/authoring/assets/deferred/course-audio.md`), which leaves format,
// lifecycle, Editions and Progress all open. Nothing here decides any of them.
// What it does decide, for the pilot only:
//
//  - **Straight narration, one voice**, not a two-host podcast overview. No
//    script-generation LLM pass, so there is no second model call to review, no
//    second bill, and what you hear is what the lesson says.
//  - **Lazy, cached forever.** Rendered on the first press of the button and
//    stored; every later press is a storage URL. Nothing is rendered at publish,
//    so the pilot cannot quietly start billing for lessons nobody listens to.
//  - **Gated to one lesson, for administrators of it.** `prophetic-school`,
//    English, first lesson, and a caller who is a sys admin, a `ywampotch`
//    tenant admin, or the course's owner (see `pilotLesson`). The gate is
//    SERVER-side and the UI reads the same verdict back, so there is exactly one
//    place the pilot can be widened.
//
// Provider choice: ElevenLabs, chosen 2026-09-14 over Gemini TTS (which would
// have reused the already-provisioned `GOOGLE_AI_API_KEY`) because voice quality
// is the thing the pilot exists to judge, and a spike run on the cheaper voice
// answers a question nobody asked. It costs one operator key, below.
//
// Operator setup (one line, on the deployment, NOT in `.env`):
//   npx convex env set ELEVENLABS_API_KEY <key>
// Optional, both env-overridable so a voice can be auditioned without a deploy
// (and both keyed into the cache, so flipping one really does re-render):
//   ELEVENLABS_VOICE_ID   default below
//   ELEVENLABS_MODEL_ID   default eleven_multilingual_v2

import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery, query, type QueryCtx } from "./_generated/server";
import { narrationFromHtml } from "./narrationText";
import { SOURCE_LANG } from "./sourceLang";
import { topicBySlug } from "./topicAccess";
import { isCallerAdmin } from "./whitelist";

// The pilot gate, as two constants rather than a config table: widening this is
// a decision, and a decision should show up in a diff.
const PILOT_SLUG = "prophetic-school";

// "Rachel", a stock ElevenLabs voice. Not a considered casting call, just a
// starting point for the audition; `ELEVENLABS_VOICE_ID` swaps it.
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

// `eleven_multilingual_v2` is the expressive model (10k characters per request).
// `eleven_flash_v2_5` is half the price and takes 40k, at a lower quality bar.
// The pilot is a quality audition, so it defaults to the expressive one.
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";

// `eleven_multilingual_v2`'s per-request character limit. A longer lesson is
// REFUSED rather than silently truncated: an audio file that stops mid-lesson
// with no indication is worse than a button that says why it will not play, and
// chunk-and-stitch is real design work this pilot has not done.
const MAX_CHARS = 10_000;

const voiceId = () => process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID;
const modelId = () => process.env.ELEVENLABS_MODEL_ID ?? DEFAULT_MODEL_ID;

type Pilot = { topic: Doc<"topics">; lesson: Doc<"lessons"> };

/**
 * The one gate. Returns the Topic and Lesson when this caller, on this lesson,
 * in this Edition, is inside the pilot, and `null` otherwise.
 *
 * Every condition is checked server-side, because the client copy of a rule is a
 * convenience and never a control: `status` below hands the UI this same verdict
 * so the button and the action can never disagree about who is in the pilot.
 */
async function pilotLesson(
  ctx: QueryCtx,
  topicSlug: string,
  lessonKey: string,
  lang: string | undefined,
): Promise<Pilot | null> {
  if (topicSlug !== PILOT_SLUG) return null;
  // Absent `?lang` is the source Edition, which IS the pilot's English. Any
  // explicit other Edition is out.
  if ((lang ?? SOURCE_LANG) !== SOURCE_LANG) return null;
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const topic = await topicBySlug(ctx, topicSlug);
  if (!topic) return null;
  // **Administrators of this course, and nobody else** (2026-09-14). Not
  // `canWrite`, not an Editor, not a Viewer holding a grant, and emphatically not
  // a learner: an unproven voice and an unproven bill get the smallest audience
  // that can still judge them.
  //
  // Three principals qualify, and `isCallerAdmin` supplies two of them: a sys
  // admin (an allowlist row with `isAdmin` and no slug) passes every scoped
  // check, and a tenant admin passes only their OWN tenant's. Passing
  // `topic.tenantSlug` is what makes that second clause tenant-local, so
  // another brand's admin is refused here. A course with no tenant (the apex)
  // degrades to the unscoped check, which is sys-admin-only: the safe direction.
  //
  // The owner is kept alongside them rather than folded in, because course
  // ownership and the Allowlist are genuinely different tables and an owner who
  // was never made an admin would otherwise lose the button on their own course.
  const admin = (await isCallerAdmin(ctx, topic.tenantSlug)) || topic.ownerId === userId;
  if (!admin) return null;
  const first = await ctx.db
    .query("lessons")
    .withIndex("by_topic_seq", (q) => q.eq("topicId", topic._id))
    .order("asc")
    .first();
  if (!first || first.key !== lessonKey) return null;
  return { topic, lesson: first };
}

// The cached render for this lesson under the CURRENT voice and model. Keyed on
// all five so an env swap is a miss, not a stale hit.
async function cached(ctx: QueryCtx, pilot: Pilot): Promise<Doc<"lessonAudio"> | null> {
  const row = await ctx.db
    .query("lessonAudio")
    .withIndex("by_lesson", (q) =>
      q
        .eq("topicId", pilot.topic._id)
        .eq("lessonKey", pilot.lesson.key)
        .eq("lang", SOURCE_LANG)
        .eq("voiceId", voiceId())
        .eq("modelId", modelId()),
    )
    .unique();
  if (!row) return null;
  // The owner's in-place editor (ADR 0020) can repoint the Lesson body. A render
  // of superseded text is a miss, so an edited lesson re-narrates on next play
  // instead of reading the old words forever. Legacy rows carry no
  // `sourceStorageId` and are trusted rather than force-rebilled.
  if (row.sourceStorageId && row.sourceStorageId !== pilot.lesson.htmlStorageId) return null;
  return row;
}

/**
 * What the reader's play button needs, in one subscription: may this caller
 * listen to this lesson at all, and is there already a rendered file to play?
 *
 * `url` is null while nothing has been rendered. Because this is a live query,
 * the button does NOT need the action's return value: the render's insert pushes
 * the URL here and playback starts from the subscription.
 */
export const status = query({
  args: { topicSlug: v.string(), key: v.string(), lang: v.optional(v.string()) },
  handler: async (ctx, { topicSlug, key, lang }) => {
    const pilot = await pilotLesson(ctx, topicSlug, key, lang);
    if (!pilot) return { eligible: false as const, url: null };
    const row = await cached(ctx, pilot);
    return { eligible: true as const, url: row ? await ctx.storage.getUrl(row.storageId) : null };
  },
});

// The action's read half: the gate again (an action is unauthenticated code
// until it asks), plus the body to narrate and whatever is already rendered.
export const pilotBody = internalQuery({
  args: { topicSlug: v.string(), key: v.string(), lang: v.optional(v.string()) },
  handler: async (ctx, { topicSlug, key, lang }) => {
    const pilot = await pilotLesson(ctx, topicSlug, key, lang);
    if (!pilot) return null;
    const row = await cached(ctx, pilot);
    return {
      topicId: pilot.topic._id,
      lessonKey: pilot.lesson.key,
      sourceStorageId: pilot.lesson.htmlStorageId ?? null,
      cachedStorageId: row?.storageId ?? null,
    };
  },
});

// The action's write half. Replaces any row for this exact key rather than
// inserting beside it, so a re-render after an edit leaves one row, not two.
export const saveAudio = internalMutation({
  args: {
    topicId: v.id("topics"),
    lessonKey: v.string(),
    sourceStorageId: v.optional(v.id("_storage")),
    storageId: v.id("_storage"),
    chars: v.number(),
  },
  handler: async (ctx, { topicId, lessonKey, sourceStorageId, storageId, chars }) => {
    const key = { lang: SOURCE_LANG, voiceId: voiceId(), modelId: modelId() };
    const existing = await ctx.db
      .query("lessonAudio")
      .withIndex("by_lesson", (q) =>
        q
          .eq("topicId", topicId)
          .eq("lessonKey", lessonKey)
          .eq("lang", key.lang)
          .eq("voiceId", key.voiceId)
          .eq("modelId", key.modelId),
      )
      .unique();
    if (existing) {
      // Bin the superseded mp3 as well as the row. Convex storage is billed by
      // the byte and an orphaned blob is unreachable, so nothing would ever
      // notice it again.
      await ctx.storage.delete(existing.storageId);
      await ctx.db.delete(existing._id);
    }
    await ctx.db.insert("lessonAudio", { topicId, lessonKey, ...key, sourceStorageId, storageId, chars });
  },
});

/**
 * Render this lesson's narration, or hand back the one already rendered.
 *
 * Safe to press twice: the cache is checked first, and a concurrent double press
 * costs one extra render and converges on one row (the second `saveAudio` bins
 * the first). Returns the playable URL, so a caller that wants to play
 * immediately can, though the live `status` query delivers it too.
 */
export const speak = action({
  args: { topicSlug: v.string(), key: v.string(), lang: v.optional(v.string()) },
  handler: async (ctx, { topicSlug, key, lang }): Promise<string> => {
    const pilot = await ctx.runQuery(internal.lessonAudio.pilotBody, { topicSlug, key, lang });
    // Not in the pilot. Deliberately the same refusal for "wrong course", "wrong
    // lesson" and "not an administrator of it": a caller outside the gate learns
    // nothing about what is behind it.
    if (!pilot) throw new ConvexError({ message: "Narration is not available for this lesson." });

    if (pilot.cachedStorageId) {
      const url = await ctx.storage.getUrl(pilot.cachedStorageId);
      if (url) return url;
      // A row pointing at a deleted blob: fall through and re-render rather than
      // hand back a URL that 404s.
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new ConvexError({
        message: "Narration is not configured yet: ELEVENLABS_API_KEY is not set on this deployment.",
      });
    }

    if (!pilot.sourceStorageId) throw new ConvexError({ message: "This lesson has no body to read." });
    const body = await ctx.storage.get(pilot.sourceStorageId);
    if (!body) throw new ConvexError({ message: "This lesson's body could not be loaded." });
    const text = narrationFromHtml(await body.text());
    if (!text) throw new ConvexError({ message: "This lesson has no prose to read aloud." });
    if (text.length > MAX_CHARS) {
      // Named numbers, because the operator reading this needs to know how far
      // over it is before deciding whether chunking is worth building.
      throw new ConvexError({
        message: `This lesson is ${text.length} characters, past the ${MAX_CHARS} a single render takes. Splitting long lessons is not built yet.`,
      });
    }

    // **The bill, before it is incurred.** ElevenLabs charges per character, so
    // this line IS the cost of the render, visible in `npx convex logs` whether
    // the call then succeeds or fails. It exists because on 2026-09-14 the first
    // real press was refused by the provider and there was no way to answer "what
    // would that lesson have cost?" without it. USD is at the published
    // multilingual-v2 rate; flash models are half.
    const usd = ((text.length / 1000) * 0.1).toFixed(3);
    console.log(`lessonAudio: ${pilot.lessonKey} narration is ${text.length} chars, about $${usd} on ${modelId()}`);

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId()}`, {
      method: "POST",
      headers: { "content-type": "application/json", "xi-api-key": apiKey },
      body: JSON.stringify({ text, model_id: modelId(), output_format: "mp3_44100_128" }),
    });
    if (!res.ok) {
      // The provider's own words, truncated. A 401 (bad key) and a 429 (quota)
      // are the two that will actually happen, and both are unguessable from a
      // generic failure message.
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      // 402 is its own case because it is the one refusal that is not a bug and
      // not a typo: the account cannot use this voice on its current plan. Saying
      // so plainly, and naming the two ways out, saves reading a raw provider
      // payload in a lesson header.
      if (res.status === 402) {
        throw new ConvexError({
          message:
            `This ElevenLabs plan cannot use voice ${voiceId()}. Upgrade the plan, or point ` +
            `ELEVENLABS_VOICE_ID at a voice the account owns. Provider said: ${detail}`,
        });
      }
      throw new ConvexError({ message: `ElevenLabs refused the render (${res.status}). ${detail}`.trim() });
    }

    // `res.blob()` carries the provider's content type; restate it so the stored
    // blob is served as audio no matter what the response header said.
    const storageId: Id<"_storage"> = await ctx.storage.store(
      new Blob([await res.arrayBuffer()], { type: "audio/mpeg" }),
    );
    await ctx.runMutation(internal.lessonAudio.saveAudio, {
      topicId: pilot.topicId,
      lessonKey: pilot.lessonKey,
      sourceStorageId: pilot.sourceStorageId,
      storageId,
      chars: text.length,
    });
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new ConvexError({ message: "The narration was rendered but could not be served." });
    return url;
  },
});
