// **Narration of a Lesson.** The play control inside the lesson, under its
// heading, that reads the lesson aloud. The control itself is NARRATE_BRIDGE in
// `src/app/_components/lessonSrcDoc.ts`; this is the rail behind it.
//
// **Recordings are made off the server and uploaded** (2026-11-24). The operator
// renders a course on their own machine with Kokoro, an open speech model, and
// `scripts/narrate.ts` uploads the finished mp3s through the PUBLISH_SECRET
// seams below. Nothing in this file calls a speech provider, so there is no key
// to configure, no per-character bill, and nothing a press of the play button
// can spend.
//
// That replaced the ElevenLabs pilot of 2026-09-14, which rendered on first
// press and so needed a "who may commission a render" permission, a pilot course
// constant and a sample budget. All three are gone with it. What is left is one
// rule: **a recording exists, and the reader would show you the lesson it
// narrates** (same Edition, same paywall; see `status`).
//
// What this still does not decide (see `.plan/maps/course-narration/map.md`):
// whether listening counts as Progress.
//
// **A translated Edition is narrated once a person has edited it** (2026-11-27,
// Hindi first). A recording reads a body, and the body a translated lesson
// reads is its `translations` row. Only a row whose body is a blob is narrated:
// that is what the Edition editor's save writes (`content/authoring.ts`), while
// a lesson nobody has touched is still the machine's inline `html`. That inline
// body has no id to pin a recording to, and narrating it would put a voice on
// words no person has checked. So the rule is the source one, with the
// translated body in place of the lesson's: a recording of the body as it reads
// now, or nothing.
//
// The voices a learner chooses between are `narrationVoices(lang)` in
// `./narrationVoices`. A recording's identity in `lessonAudio` is
// topic + lesson + language + voice + model, plus `sampleChars`, a column the
// pilot's audition budget left behind: every recording made here writes 0, and
// anything else is one of the pilot's samples.

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type QueryCtx } from "./_generated/server";
import { assertAdmin } from "./adminSecret";
import { lessonLocked, resolveEdition, type EditionAccess } from "./edition";
import { NARRATION_MODEL, isNarrationVoice, narrationVoices } from "./narrationVoices";
import { SOURCE_LANG } from "./sourceLang";
import { topicBySlug } from "./topicAccess";

// Is this row one of today's recordings at all: a voice a learner can pick, made
// by the current model, of the whole lesson? The ElevenLabs pilot's rows fail it
// on voice and model both, which is how they stop being served the moment this
// deploys and how `purgeRetired` finds them.
function isCurrent(row: Doc<"lessonAudio">): boolean {
  return isNarrationVoice(row.voiceId, row.lang) && row.modelId === NARRATION_MODEL && row.sampleChars === 0;
}

// Every row for one lesson in one Edition, whatever made it. A lesson has
// one row per voice (plus, until they are purged, the pilot's), so the bound is
// generous rather than tight.
async function rowsFor(ctx: QueryCtx, topicId: Id<"topics">, lessonKey: string, lang: string) {
  return await ctx.db
    .query("lessonAudio")
    .withIndex("by_lesson", (q) => q.eq("topicId", topicId).eq("lessonKey", lessonKey).eq("lang", lang))
    .take(50);
}

/**
 * The body a recording of this lesson in `lang` must have been made from, or
 * null when that Edition's lesson is not narrated. The source Edition reads the
 * lesson's own body; a translated one reads its `translations` row, and only a
 * blob there (an edited lesson, see the header).
 */
async function narratedBody(
  ctx: QueryCtx,
  lesson: Doc<"lessons">,
  lang: string,
): Promise<Id<"_storage"> | null> {
  if (lang === SOURCE_LANG) return lesson.htmlStorageId ?? null;
  const row = await ctx.db
    .query("translations")
    .withIndex("by_topic_lang_kind_key", (q) =>
      q.eq("topicId", lesson.topicId).eq("lang", lang).eq("kind", "lesson").eq("key", lesson.key),
    )
    .unique();
  return row?.htmlStorageId ?? null;
}

export const NOTHING = { eligible: false, url: null, voice: null, voices: [] as string[] };

export const narrationStatus = v.object({
  eligible: v.boolean(),
  url: v.union(v.string(), v.null()),
  voice: v.union(v.string(), v.null()),
  voices: v.array(v.string()),
});

/**
 * The recordings of one lesson for a caller the reader has ALREADY resolved to
 * an Edition and an access level. Shared by `status` (a signed-in learner) and
 * `public.publicNarration` (a Guest), so the two cannot drift: whoever resolved
 * the caller, the same Edition rule, paywall and freshness checks decide.
 */
export async function narrationFor(
  ctx: QueryCtx,
  topic: Doc<"topics">,
  edition: { lang: string; level: EditionAccess },
  key: string,
  voice: string | undefined,
) {
  const cast = narrationVoices(edition.lang);
  if (cast.length === 0 || edition.level === "none") return NOTHING;
  const lesson = await ctx.db
    .query("lessons")
    .withIndex("by_topic_key", (q) => q.eq("topicId", topic._id).eq("key", key))
    .unique();
  // A superseded lesson is not found by the reader either (`readLesson`).
  if (!lesson?.htmlStorageId || lesson.supersededBy) return NOTHING;
  if (await lessonLocked(ctx, topic._id, edition.level, key)) return NOTHING;

  // The owner's in-place editor (ADR 0020) can repoint the Lesson body. A
  // recording of superseded text is not a recording of this lesson: it drops
  // out here, and the operator's next pull deletes the local mp3 so the next
  // render makes it again.
  const body = await narratedBody(ctx, lesson, edition.lang);
  if (!body) return NOTHING;
  const rows = (await rowsFor(ctx, topic._id, key, edition.lang)).filter(
    (r) => isCurrent(r) && r.sourceStorageId === body,
  );
  const urls = new Map<string, string>();
  for (const candidate of cast) {
    const row = rows.find((r) => r.voiceId === candidate);
    // A row whose blob has gone has nothing to play, so it is not on offer.
    const url = row ? await ctx.storage.getUrl(row.storageId) : null;
    if (url) urls.set(candidate, url);
  }
  const voices = [...urls.keys()];
  const first = voices[0];
  // A learner sees the control only when there is something to play: a play
  // button that can only ever fail is worse than no play button.
  if (!first) return NOTHING;
  const chosen = voice && urls.has(voice) ? voice : first;
  return { eligible: true, url: urls.get(chosen) ?? null, voice: chosen, voices };
}

/**
 * What the reader's play button needs, in one subscription: is there a narration
 * of this lesson this caller may hear, in which voices, and where is the one they
 * asked for?
 *
 * `voices` is the subset of the Edition's `narrationVoices(lang)` with a playable recording of the
 * lesson AS IT READS NOW, in casting order. `voice` is the requested one when it
 * is among them, otherwise the first, so a learner whose saved choice has no
 * recording of this lesson still hears it rather than losing the control.
 *
 * Every refusal is the same empty answer: a caller outside the gate learns
 * nothing about what is behind it, including whether the lesson exists.
 */
export const status = query({
  args: { topicSlug: v.string(), key: v.string(), lang: v.optional(v.string()), voice: v.optional(v.string()) },
  returns: narrationStatus,
  handler: async (ctx, { topicSlug, key, lang, voice }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return NOTHING;
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) return NOTHING;
    // **Exactly the reader's rule, asked through the reader's own seam.**
    // `resolveEdition` answers which Edition this caller is actually served and
    // at what level, which is not the same as "holds some grant on the course":
    //
    //  - A caller holding only a translated Edition who arrives with no `?lang`
    //    is served that translation, so `lang` here comes back as it, not as the
    //    source. They hear that Edition's recordings (if it has any), never the
    //    English ones over a Hindi lesson.
    //  - On a paid Edition a `preview` caller reads one lesson and no more.
    //    `lessonLocked` is that paywall, and audio of a lesson is the lesson.
    //
    // No administrator arm (it existed until 2026-11-24, when an admin was who
    // commissioned a render). The reader gives an admin nothing a grant does
    // not, and a recording URL is a permanent bearer link to the whole lesson,
    // so the audio gives them nothing more either.
    //
    // There is also no course constant any more. The pilot was gated to
    // `prophetic-school` because a press could spend money at a provider; now
    // the only way audio exists is an operator uploading it, so "a recording
    // exists" IS the gate, for whichever course gets one.
    const edition = await resolveEdition(ctx, topic, userId, lang ?? null);
    return await narrationFor(ctx, topic, edition, key, voice);
  },
});

// ---- the operator's upload rail (scripts/narrate.ts, PUBLISH_SECRET) --------

/**
 * Which recordings this deployment already holds for a course, so the uploader
 * sends only what is missing. `chars` is the length of the script the recording
 * reads: the uploader compares it too, so a lesson whose WORDING changed without
 * its body changing (a fixed `speakable` rule) is sent again.
 * A recording of a body the lesson has since moved on
 * from is still listed, under the body it WAS made from: the uploader compares
 * that id with the one it pulled, so a stale row reads as "not uploaded" there.
 */
export const uploaded = query({
  // `lang` absent is the source Edition, which is what every caller sent before
  // translated Editions were narrated.
  args: { secret: v.string(), topicSlug: v.string(), lang: v.optional(v.string()) },
  returns: v.array(
    v.object({ lessonKey: v.string(), voiceId: v.string(), sourceStorageId: v.string(), chars: v.number() }),
  ),
  handler: async (ctx, { secret, topicSlug, lang }) => {
    assertAdmin(secret);
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) return [];
    const edition = lang ?? SOURCE_LANG;
    // Bounded, not `.collect()`: a course is tens of lessons by a handful of
    // voices. ponytail: paginate if a course ever nears a thousand recordings.
    const rows = await ctx.db
      .query("lessonAudio")
      .withIndex("by_lesson", (q) => q.eq("topicId", topic._id))
      .take(2000);
    const held = [];
    for (const r of rows) {
      if (r.lang !== edition || !isCurrent(r) || !r.sourceStorageId) continue;
      // A row whose mp3 has gone is not held: `status` will not serve it, so
      // the uploader must be allowed to send it again.
      if (!(await ctx.db.system.get(r.storageId))) continue;
      held.push({ lessonKey: r.lessonKey, voiceId: r.voiceId, sourceStorageId: r.sourceStorageId as string, chars: r.chars });
    }
    return held;
  },
});

/**
 * Record an uploaded mp3 as the narration of one lesson in one voice. The bytes
 * are already in storage (`content.publish.generateContentUploadUrl` minted the
 * URL); this is the row that makes them a recording.
 *
 * **A refusal RETURNS `{ ok: false, reason }`, it does not throw.** A mutation
 * that throws rolls back everything it did, the `storage.delete` included, so
 * throwing would leave every refused upload sitting in storage, billed and
 * unreachable. Returning lets the delete commit. The caller is the operator's
 * own script, which turns a refusal back into an error on its side.
 *
 * The one exception is the secret: a caller without it is not told anything and
 * nothing of theirs is touched.
 */
export const saveUpload = mutation({
  args: {
    secret: v.string(),
    topicSlug: v.string(),
    lessonKey: v.string(),
    // The Edition the recording is in; absent is the source Edition.
    lang: v.optional(v.string()),
    voiceId: v.string(),
    // The lesson body the mp3 was rendered from, as pulled (a translated
    // Edition's: its `translations` row's blob). The lesson may have
    // been edited between the pull and this call, hours later.
    sourceStorageId: v.id("_storage"),
    storageId: v.id("_storage"),
    chars: v.number(),
  },
  returns: v.object({ ok: v.boolean(), reason: v.optional(v.string()) }),
  handler: async (ctx, { secret, topicSlug, lessonKey, lang, voiceId, sourceStorageId, storageId, chars }) => {
    assertAdmin(secret);
    const edition = lang ?? SOURCE_LANG;
    // **Two refusals keep their hands off storage**, because `storageId` is an
    // argument and every refusal below deletes it: aimed at a lesson body, that
    // would bin the lesson. So the upload must not BE the body it claims to
    // narrate, and it must not be labelled as anything other than an mp3. (An
    // upload with no content type at all is let through: the label is only
    // there when the uploader sent one.)
    const blob = await ctx.db.system.get(storageId);
    if (!blob) return { ok: false, reason: "The uploaded file is not in storage." };
    if (storageId === sourceStorageId) return { ok: false, reason: "The upload is the lesson body, not a recording of it." };
    if (blob.contentType && blob.contentType !== "audio/mpeg") {
      return { ok: false, reason: `Expected an audio/mpeg upload, got ${blob.contentType}.` };
    }
    const refuse = async (reason: string) => {
      await ctx.storage.delete(storageId);
      return { ok: false, reason };
    };

    const topic = await topicBySlug(ctx, topicSlug);
    // The third hands-off refusal: a file that is ALREADY some recording of this
    // course, other than the one this call replaces. Binning it on a refusal, or
    // pointing a second row at it, would silently take a voice away from a
    // lesson. The uploader always mints a fresh file, so this is a caller's
    // mistake, never a retry (a retry names the same lesson and voice).
    if (topic) {
      const rows = await ctx.db
        .query("lessonAudio")
        .withIndex("by_lesson", (q) => q.eq("topicId", topic._id))
        .take(2000);
      const taken = rows.some(
        (r) => r.storageId === storageId && !(r.lessonKey === lessonKey && r.lang === edition && r.voiceId === voiceId),
      );
      if (taken) return { ok: false, reason: "That file is already another lesson's recording." };
    }

    if (!isNarrationVoice(voiceId, edition)) return await refuse(`"${voiceId}" is not a narration voice for "${edition}".`);
    if (!topic) return await refuse(`No course "${topicSlug}".`);
    const lesson = await ctx.db
      .query("lessons")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topic._id).eq("key", lessonKey))
      .unique();
    if (!lesson || lesson.supersededBy) return await refuse(`No lesson "${lessonKey}" in "${topicSlug}".`);
    const body = await narratedBody(ctx, lesson, edition);
    if (!body) return await refuse(`Lesson "${lessonKey}" is not narrated in "${edition}": nobody has edited its translation.`);
    if (body !== sourceStorageId) {
      return await refuse(`Lesson "${lessonKey}" was edited after this recording was made. Pull and render it again.`);
    }

    // Replace rather than insert beside: one row per lesson and voice. The
    // superseded mp3 goes with its row, because Convex storage is billed by the
    // byte and an orphaned blob is unreachable.
    const existing = await ctx.db
      .query("lessonAudio")
      .withIndex("by_lesson", (q) =>
        q
          .eq("topicId", topic._id)
          .eq("lessonKey", lessonKey)
          .eq("lang", edition)
          .eq("voiceId", voiceId)
          .eq("modelId", NARRATION_MODEL)
          .eq("sampleChars", 0),
      )
      .take(10);
    for (const row of existing) {
      if (row.storageId !== storageId && (await ctx.db.system.get(row.storageId))) {
        await ctx.storage.delete(row.storageId);
      }
      await ctx.db.delete(row._id);
    }
    await ctx.db.insert("lessonAudio", {
      topicId: topic._id,
      lessonKey,
      lang: edition,
      voiceId,
      modelId: NARRATION_MODEL,
      sampleChars: 0,
      sourceStorageId,
      storageId,
      chars,
    });
    return { ok: true };
  },
});

/**
 * **Delete every recording that is no longer served**: a voice that left
 * its language's `narrationVoices`, an older model, one of the pilot's samples. This is how the
 * ElevenLabs pilot's recordings leave a deployment.
 *
 * DRY RUN unless `apply` is true, like the other operator rails here: without it
 * each batch only reports what it would delete (in the return value for the
 * first batch, in `npx convex logs` for the rest).
 *
 * IRREVERSIBLE with `apply`. The pilot's audio was paid for per character, and
 * deleting it cannot be undone short of paying again, so this runs only on the
 * owner's explicit say-so:
 *
 *   npx convex run lessonAudio:purgeRetired '{"apply":true}'
 *
 * It does NOT touch a current recording of a body the lesson has moved on from;
 * `saveUpload` replaces that one when the lesson is rendered again.
 */
export const purgeRetired = internalMutation({
  args: { apply: v.optional(v.boolean()), cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.object({ retired: v.number(), applied: v.boolean(), more: v.boolean() }),
  handler: async (ctx, { apply, cursor }): Promise<{ retired: number; applied: boolean; more: boolean }> => {
    // The table has no index on voice or model and does not need one for a
    // one-off sweep: walk it a page at a time, continuing in a fresh transaction.
    const page = await ctx.db.query("lessonAudio").paginate({ numItems: 100, cursor: cursor ?? null });
    const retired = page.page.filter((r) => !isCurrent(r));
    if (apply) {
      for (const row of retired) {
        if (await ctx.db.system.get(row.storageId)) await ctx.storage.delete(row.storageId);
        await ctx.db.delete(row._id);
      }
    }
    console.log(
      `lessonAudio.purgeRetired: ${retired.length} of ${page.page.length} rows retired, ${apply ? "deleted" : "dry run, nothing deleted"}`,
    );
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.lessonAudio.purgeRetired, { apply, cursor: page.continueCursor });
    }
    return { retired: retired.length, applied: !!apply, more: !page.isDone };
  },
});
