import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getViewableTopic, holdsSeat, loadEdition, mintToken, readableLang } from "./lib";
import { SOURCE_LANG } from "./sourceLang";
import { assertTenantFlag } from "./tenantFlags";
import { topicLessonCounts } from "./progressCounts";
import { langInfo } from "./languages";
import { resolveEmblem, resolvedEmblemValidator, snapshotEmblem } from "./emblem";

// The earned-Certificate shape shared by the authed seams (`myCertificate` and
// `claimCertificate`): the achievement, the Edition language it was earned in
// (course-translation), plus its resolved Emblem (ADR 0017). The Emblem is
// resolved fresh on every read (an image is a same-origin signed URL), so a
// frozen `imageId` always yields a current URL.
const earnedCertificateValidator = v.object({
  token: v.string(),
  learnerName: v.string(),
  courseTitle: v.string(),
  lessonCount: v.number(),
  issuedAt: v.number(),
  // The Edition the certificate was earned in (course-translation).
  lang: v.string(),
  emblem: resolvedEmblemValidator,
});

// The course's CURRENT title, in the Edition language the certificate was earned
// in (course-translation): the source `topic.title`, or its translated title for
// a non-source Edition. Falls back to the certificate's frozen `courseTitle`
// snapshot only when the Topic is gone. Live by product decision — a course rename
// shows on every already-issued certificate (this supersedes ADR 0015's original
// "frozen title" rule; the snapshot column now only backstops a deleted Topic).
async function liveCourseTitle(
  ctx: QueryCtx,
  row: Doc<"certificates">,
  topic: Doc<"topics"> | null,
): Promise<string> {
  if (!topic) return row.courseTitle;
  const lang = row.lang ?? SOURCE_LANG;
  // Translated-else-source course title (decoded), via the shared Edition reader.
  return await loadEdition(ctx, topic, lang).title();
}

async function certificatePayload(ctx: QueryCtx, row: Doc<"certificates">) {
  const topic = await ctx.db.get(row.topicId);
  return {
    token: row.token,
    learnerName: row.learnerName,
    courseTitle: await liveCourseTitle(ctx, row, topic),
    lessonCount: row.lessonCount,
    issuedAt: row._creationTime,
    lang: row.lang ?? SOURCE_LANG,
    emblem: await resolveEmblem(ctx, row.emblem),
  };
}

// Certificates (ADR 0015). Two auth models live in this file, kept apart:
//   - `myCertificate` / `claimCertificate` are AUTHED and owner-or-Viewer gated
//     (getAuthUserId → getViewableTopic): the in-app earn + view path. Both the
//     owner and a shared Viewer can earn their own; a Guest (no account) can't.
//   - `publicCertificate` (slice 3) is the anonymous, token-only read seam — the
//     exact shape of public.ts, authorized by token and never by getAuthUserId,
//     with an explicit output allowlist.

// Eligibility is derived, never stored: the Topic is `completed` AND the caller
// has completed every non-superseded Lesson. Reuses `topicLessonCounts` — the
// same counts the dashboard progress bar shows — so eligibility can't drift from
// what the learner sees. An empty course (no non-superseded Lessons) certifies
// nothing.
async function isEligible(ctx: QueryCtx, topic: Doc<"topics">, userId: Id<"users">): Promise<boolean> {
  if (topic.status !== "completed") return false;
  // **A Seat on an Organisation Voucher earns no Certificate** (ADR 0031, which put
  // this out of scope; the guard itself landed 2026-08-26 when the omission was
  // spotted). Gating eligibility rather than only the claim is what hides the offer on
  // all four surfaces that read this flag, so nobody is shown a button that refuses.
  //
  // TWO reasons, and the second is the sharper one.
  //
  //   1. A Certificate is a thing a member could lose with a forgotten PIN, and there
  //      is no recovery on that rail, so issuing one sells a promise the design cannot
  //      keep.
  //   2. **A Certificate prints a name the learner types**, and it is stored on the
  //      row. A real name beside a political party's cohort is exactly the special
  //      personal information (POPIA s26 via s1) that the self-chosen nickname exists
  //      to keep out of the database. Left open, this rail's one mitigation could be
  //      undone by a member being helpfully honest in a name box.
  //
  // A Seat that ADOPTS an email and a password is still refused. It still holds a Seat,
  // so reason 2 still applies, and the day that changes it should change deliberately
  // with the name question answered rather than as a side effect.
  if (await holdsSeat(ctx, userId)) return false;
  const { lessonCount, completedCount } = await topicLessonCounts(ctx, topic._id, userId);
  return lessonCount > 0 && completedCount === lessonCount;
}

async function certificateFor(ctx: QueryCtx, topicId: Id<"topics">, userId: Id<"users">) {
  return await ctx.db
    .query("certificates")
    .withIndex("by_topic_user", (q) => q.eq("topicId", topicId).eq("userId", userId))
    .unique();
}

// The caller's own achievement on a Topic: the earned Certificate if they have
// one, plus an eligibility flag when they don't — enough for the reader,
// celebration, and dashboard to choose between "View certificate", a claim
// prompt, or nothing. Owner-or-Viewer gated; null when signed-out or no access.
// `issuedAt` is the row's immutable `_creationTime`.
export const myCertificate = query({
  args: { topicSlug: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      certificate: v.union(v.null(), earnedCertificateValidator),
      eligible: v.boolean(),
    }),
  ),
  handler: async (ctx, { topicSlug }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const topic = await getViewableTopic(ctx, userId, topicSlug);
    if (!topic) return null;
    const row = await certificateFor(ctx, topic._id, userId);
    if (row) {
      // Already earned — nothing left to claim.
      return { certificate: await certificatePayload(ctx, row), eligible: false };
    }
    return { certificate: null, eligible: await isEligible(ctx, topic, userId) };
  },
});

// Claim (mint) the caller's Certificate. Owner-or-Viewer gated; idempotent — a
// second claim returns the existing row, never a duplicate, so a double-click or
// a reopen+re-complete can't re-mint (permanence). Re-checks eligibility
// server-side and refuses the ineligible. The name to print is a per-Certificate
// snapshot (no account display-name exists yet); blank/whitespace falls back to
// the email's local-part so the email itself never lands on a certificate.
// courseTitle + lessonCount are snapshotted at issue and never rewritten.
export const claimCertificate = mutation({
  args: { topicSlug: v.string(), name: v.string(), lang: v.optional(v.string()) },
  returns: earnedCertificateValidator,
  handler: async (ctx, { topicSlug, name, lang }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    const topic = await getViewableTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("topic not found");

    // Idempotent: an existing Certificate wins, unchanged (its frozen Emblem too).
    // Returned BEFORE the flag gate so a cert earned while `certificates` was on
    // keeps resolving after it flips off (frozen, not revoked — issue 04/17).
    const existing = await certificateFor(ctx, topic._id, userId);
    if (existing) return await certificatePayload(ctx, existing);

    // Whitelabel: minting a NEW certificate is a create-side act — gated by the
    // Topic's tenant `certificates` flag (no-op on the default site, issue 17).
    await assertTenantFlag(ctx, topic.tenantSlug, "certificates");

    // Re-check eligibility and snapshot the lesson count from one read (the same
    // counts the dashboard shows). lessonCount is frozen onto the Certificate.
    // Server-side, not merely hidden: `isEligible` carries the reasoning, and this is
    // the gate that actually holds. It sits AFTER the existing-certificate return
    // above, deliberately, so a Certificate already earned stays resolvable rather than
    // being revoked - frozen, not revoked, is this file's posture throughout.
    if (!(await isEligible(ctx, topic, userId))) throw new Error("not eligible");
    const { lessonCount } = await topicLessonCounts(ctx, topic._id, userId);

    const user = await ctx.db.get(userId);
    const fallback = (user?.email ?? "Learner").split("@")[0]!;
    const learnerName = name.trim() || fallback;
    // Snapshot the title of the Edition the learner completed in — a Viewer who
    // only holds the Spanish edition earns a Spanish-titled certificate.
    const effLang = (await readableLang(ctx, topic, userId, lang ?? null)) ?? SOURCE_LANG;
    // The title of the Edition the learner completed in (translated else source,
    // decoded), via the shared Edition reader.
    const courseTitle = await loadEdition(ctx, topic, effLang).title();
    const token = mintToken();

    // Freeze the Topic's Emblem onto the row, exactly as title/lessonCount are
    // frozen — a later reopen + re-fetch or owner change never rewrites it (ADR
    // 0017). An `imageId` references an immutable blob, so it always resolves.
    const emblem = snapshotEmblem(topic.emblem);
    const id = await ctx.db.insert("certificates", {
      topicId: topic._id,
      userId,
      token,
      learnerName,
      courseTitle,
      lessonCount,
      lang: effLang,
      ...(emblem ? { emblem } : {}),
    });
    const row = (await ctx.db.get(id))!;
    return await certificatePayload(ctx, row);
  },
});

// The anonymous Certificate read seam (ADR 0015) — the exact shape of public.ts.
// Authorized by TOKEN, never getAuthUserId, so it backs the account-less
// /certificate/[token] page. The `returns` validator is an explicit output
// allowlist: the achievement only (name, course, issue date, lesson count) —
// never the email, userId, topicId, or any Lesson content. A missing/invalid
// token returns uniform null, so certificates can't be enumerated. The allowlist
// grows by exactly one field — the resolved Emblem (ADR 0017): a same-origin image
// URL or a short glyph, never the email, userId, topicId, token, or Lesson content.
export const publicCertificate = query({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      learnerName: v.string(),
      courseTitle: v.string(),
      issuedAt: v.number(),
      lessonCount: v.number(),
      // The Edition's language + direction, so the public page renders RTL
      // titles correctly (course-translation). Never leaks Topic content.
      lang: v.string(),
      dir: v.union(v.literal("ltr"), v.literal("rtl")),
      emblem: resolvedEmblemValidator,
      // The course's public link, present ONLY when the course is publicly
      // available (its `publicToken` is live). `shareToken` is the course's own
      // anonymous read capability — already designed to be handed out — so the
      // certificate's Share button can point back at the course; `tenantSlug`
      // picks the canonical host (my-course.app apex or a tenant subdomain). Null
      // when the course is private: the certificate stays viewable, but there's
      // no course to link to. Never leaks the topicId, owner, or Lesson content.
      course: v.union(
        v.null(),
        v.object({ shareToken: v.string(), tenantSlug: v.union(v.null(), v.string()) }),
      ),
    }),
  ),
  handler: async (ctx, { token }) => {
    if (!token) return null;
    const row = await ctx.db
      .query("certificates")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!row) return null;
    const topic = await ctx.db.get(row.topicId);
    const lang = row.lang ?? SOURCE_LANG;
    return {
      learnerName: row.learnerName,
      courseTitle: await liveCourseTitle(ctx, row, topic),
      issuedAt: row._creationTime,
      lessonCount: row.lessonCount,
      lang,
      dir: langInfo(lang).rtl ? ("rtl" as const) : ("ltr" as const),
      emblem: await resolveEmblem(ctx, row.emblem),
      course: topic?.publicToken
        ? { shareToken: topic.publicToken, tenantSlug: topic.tenantSlug ?? null }
        : null,
    };
  },
});
