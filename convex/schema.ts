import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

// A Seller's SA payout bank details — where the operator EFTs their Ledger
// share. Single source of truth for the shape: the `sellers.payout` field, the
// save mutation's args (sellers.ts), and the admin payout reads (sellers.ts /
// ledger.ts) all derive from this one declaration.
export const payoutDetailsValidator = v.object({
  accountHolder: v.string(),
  bank: v.string(),
  accountNumber: v.string(),
  branchCode: v.string(),
});

// A tenant's theme (whitelabel, ticket 03 / whitelabel ADR draft §1): the 14-token palette
// plus optional brand assets. `light`/`dark` are loose records — not a fixed
// v.object — because CSS-friendly hyphenated token names (good-b, bad-b) can't
// be object keys in a validator; the exact key set is checked in code against
// the token list (see convex/tenants.ts assertThemeTokens). `dark` is optional
// and partial (else the default dark palette applies). Assets are raster blobs,
// mint-new-never-overwrite; absent → displayName wordmark / shared /icon.svg.
export const tenantThemeValidator = v.object({
  light: v.record(v.string(), v.string()),
  dark: v.optional(v.record(v.string(), v.string())),
  logo: v.optional(v.id("_storage")),
  favicon: v.optional(v.id("_storage")),
});

// A tenant's feature flags (ticket 04): five flat required booleans, each
// enforced server-side inside the gated mutation. v1 migration default is all
// `true` (no regression from today's always-on behaviour).
export const tenantFlagsValidator = v.object({
  certificates: v.boolean(),
  translations: v.boolean(),
  publicLinks: v.boolean(),
  qa: v.boolean(),
  seeding: v.boolean(),
  // The donation rail (ADR 0027) — the sixth flag, and the only OPTIONAL one.
  // The other five are required because their v1 default was `true` (no
  // regression from always-on behaviour), which had to be written onto every
  // row. A donation rail must default OFF — it is a new money destination and
  // opting in is a deliberate operator act — so ABSENCE already carries the
  // right meaning and needs no backfill. `assertTenantFlag` reads it truthily,
  // so an un-set flag is fail-closed, which is exactly what money wants.
  donations: v.optional(v.boolean()),
});

// The Hub, as Convex tables (see PRD §4). Local workspace files (lessons/,
// references/) remain the source of truth; `pnpm run publish` mirrors them
// here. Capture tables (responses/progress/questions) are written by the
// reader as the learner reads. Auth tables come from Convex Auth.
export default defineSchema({
  ...authTables,

  // Convex Auth's users table, inlined so we can extend it (per
  // https://labs.convex.dev/auth/setup/schema). All fields + both indexes match
  // `authTables.users` verbatim; the only addition is `tenantSlug` (whitelabel,
  // issue 07) — the tenant a user belongs to; absent = default site.
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    tenantSlug: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    // Whitelabel issue 22: the tenant-removal guard counts user accounts still
    // scoped to a slug via an indexed read (never a full scan of this growable
    // table). Absent slug = the default site; only referenced tenants match.
    .index("by_tenant", ["tenantSlug"]),

  // The whitelabel tenant record (whitelabel ADR draft §1, ticket 03 theme / 04
  // flags): one row per branded subdomain (`<slug>.my-course.app`), holding its
  // palette + brand assets + feature flags. `slug` is the subdomain label
  // (effectively immutable). One indexed `by_slug` read resolves skin + flags on
  // the hot host→tenant path. Tenancy is a visibility filter and a skin, not a
  // hard partition — access control stays ownership/Shares/public links.
  tenants: defineTable({
    slug: v.string(),
    displayName: v.string(),
    motto: v.optional(v.string()),
    theme: tenantThemeValidator,
    flags: tenantFlagsValidator,
    // Who the operator owes this tenant's donation income (ADR 0027). A user id,
    // not a bank account: settlement rides the existing `sellers.payout` details
    // and the Payouts tab, because `operatorBank` is global and singular by
    // decision (ADR 0026) and there is no tenant bank account to invent.
    // **Sys-admin-only to write** — a money destination is not a subdomain
    // administrator's call, and letting one set it would open self-dealing
    // (redirecting the tenant's donation income to any member account).
    donationPayee: v.optional(v.id("users")),
  }).index("by_slug", ["slug"]),

  // The Allowlist (ADR 0011, semantics revised by ADR 0021 — open sign-up): the
  // set of emails permitted to CREATE COURSES, managed at runtime by the Admin.
  // Emails are stored already-normalised (trimmed, lower-cased) so a lookup
  // never misses on casing/whitespace. `isAdmin` marks an Admin row, which the
  // portal shows but refuses to remove. An empty table admits nobody to course
  // creation. `tenantSlug` (whitelabel, issue 07 / whitelabel ADR draft §4)
  // scopes an admin: absent = sys admin (every tenant); set = tenant admin
  // (only that tenant).
  whitelist: defineTable({
    email: v.string(),
    isAdmin: v.optional(v.boolean()),
    tenantSlug: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    // Whitelabel issue 22: the tenant Members section reads a tenant's own rows
    // (slug match) and the assignable pool (unscoped) by tenant, and the removal
    // guard counts them — all indexed, never a full scan of the Allowlist.
    .index("by_tenant", ["tenantSlug"]),

  // A subject space, owned by its creator. `ownerId` is optional only so the
  // schema push accepts the pre-existing unowned Hindi row; `ensureTopic`
  // backfills it. `seq` orders a user's Topics in the switcher. `by_slug` stays
  // for the operator publish path and the still-global routine (issue 05).
  topics: defineTable({
    slug: v.string(),
    title: v.string(),
    ownerId: v.optional(v.id("users")),
    seq: v.optional(v.number()),
    // Seed flow (issue 07): a learner Seeds a Topic (title + "why"); the Routine
    // drafts the Mission and flips `seeded` → `active`. `status` is optional so
    // the legacy hindi row (pre-seed) is accepted; issue 09 sets it `active`.
    seed: v.optional(v.string()),
    mission: v.optional(v.string()),
    // `completed` (ADR 0015) is terminal: the Routine's gate refuses it, so a
    // finished course stops authoring. Reopen returns it to `active`.
    status: v.optional(v.union(v.literal("seeded"), v.literal("active"), v.literal("completed"))),
    // The course's Provider (ADR 0014): which teaching runtime authors + translates
    // it. `claude` is the existing claude.ai Routine; `openrouter` runs GLM 4.2
    // authoring / Gemini translation in Convex actions. Optional and chosen at
    // creation; ABSENT reads as `claude`, so every pre-existing course (incl. the
    // legacy Hindi row) stays on the Claude path untouched.
    provider: v.optional(v.union(v.literal("claude"), v.literal("openrouter"))),
    // The soft `~N lessons` estimate (PRD: Estimated lesson count): the Routine's
    // best guess at the course's eventual total Lesson count, refreshed each run
    // via `reportGeneration`. A property of the course (survives across runs), so
    // it lives here, not on the generation lock. Optional — a Topic never
    // estimated simply has no value. Advisory only (ADR 0015 / 0018): it never
    // gates authoring. `generationStatus` clamps + gates it on read.
    estimatedLessons: v.optional(v.number()),
    // Public link (issue 07 / ADR 0013): an unguessable token granting anonymous
    // read-only access. Present while the Topic is public; cleared (truly revoked)
    // when made private. `by_public_token` is the Guest read seam's lookup.
    publicToken: v.optional(v.string()),
    // The Topic's Emblem (ADR 0017): the mark of the subject shown on its
    // Certificate. Resolves image → glyph → generic default. `imageId` points at
    // an immutable Hub blob (a re-set mints a new blob, never overwrites, so a
    // `storageId` frozen onto an earned Certificate always resolves); `glyph` is
    // the emoji/short-char fallback. `ownerSet` marks an owner override so the AI
    // default (`completeCourse`) never clobbers it, regardless of write order.
    emblem: v.optional(
      v.object({
        imageId: v.optional(v.id("_storage")),
        glyph: v.optional(v.string()),
        ownerSet: v.optional(v.boolean()),
      }),
    ),
    // The whitelabel tenant this course belongs to (issue 07 / ADR 0021 §3):
    // absent = default site (shows on my-course.app only). `by_tenant` lists a
    // subdomain's own courses. Legacy rows carry none — a safe no-op backfill.
    tenantSlug: v.optional(v.string()),
  })
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerId"])
    .index("by_owner_slug", ["ownerId", "slug"])
    .index("by_public_token", ["publicToken"])
    .index("by_tenant", ["tenantSlug"]),

  // Immutable once published. A replacement carries `supersededBy` (the key of
  // the lesson that retired it). `key` is the filename stem, e.g.
  // "0001-blessed-is-the-man"; `seq` is its order.
  lessons: defineTable({
    topicId: v.id("topics"),
    key: v.string(),
    seq: v.number(),
    title: v.string(),
    // The rendered Lesson body lives in a **content blob** (Convex File Storage),
    // served over the `/content` HTTP route and keyed by `htmlStorageId`. The
    // legacy inline `html` was dropped after every row was migrated (the narrow
    // step, see .scratch/html-blob-storage).
    htmlStorageId: v.optional(v.id("_storage")),
    supersededBy: v.optional(v.string()),
  })
    .index("by_topic_seq", ["topicId", "seq"])
    .index("by_topic_key", ["topicId", "key"]),

  // A learner's Resource: either an uploaded blob (`kind: "file"`, bytes in
  // `rawStorageId`) or an external link (`kind: "url"`, in `url`). `processed`
  // (a manifest of rendered/extracted artifacts) is filled lazily by the Routine
  // on first need (issue 06). Dedupe by `(topicId, contentHash)` — the blob's
  // _storage sha256 for files, the URL string for links.
  resources: defineTable({
    topicId: v.id("topics"),
    ownerId: v.id("users"),
    filename: v.string(),
    rawStorageId: v.optional(v.id("_storage")),
    url: v.optional(v.string()),
    contentHash: v.string(),
    status: v.union(v.literal("raw"), v.literal("processing"), v.literal("ready")),
    kind: v.union(v.literal("file"), v.literal("url")),
    processed: v.optional(v.any()),
  })
    .index("by_topic", ["topicId"])
    .index("by_topic_hash", ["topicId", "contentHash"]),

  // The teacher's own learning records (markdown), one per Lesson authored —
  // loosely ADRs for the learner's progress, used to compute the next ZPD step.
  // Append-only history, so insert-once like Lessons (never edited in place).
  // In the repo-as-SoT model these lived in git; ADR 0009 moves content into
  // Convex, so the Routine publishes them here and pulls them back at materialise.
  learningRecords: defineTable({
    topicId: v.id("topics"),
    key: v.string(),
    seq: v.number(),
    markdown: v.string(),
  })
    .index("by_topic_seq", ["topicId", "seq"])
    .index("by_topic_key", ["topicId", "key"]),

  // Mutable: edited in place and re-published; current version always wins.
  // `contentHash` lets publish skip unchanged references.
  references: defineTable({
    topicId: v.id("topics"),
    key: v.string(),
    title: v.string(),
    // The rendered Reference body — a **content blob** like the Lesson body.
    // Mutable: a changed re-publish points at a new blob and deletes the old.
    // `contentHash` still gates skip-unchanged publishing.
    htmlStorageId: v.optional(v.id("_storage")),
    contentHash: v.string(),
  })
    .index("by_topic", ["topicId"])
    .index("by_topic_key", ["topicId", "key"]),

  // The learner's first answer to a quiz, recorded automatically. Indexes lead
  // with `topicId` so identical lessonKeys across Topics never collide (`topicId`
  // is required as of the issue-03 migration narrow — all rows are backfilled).
  responses: defineTable({
    userId: v.id("users"),
    topicId: v.id("topics"),
    lessonKey: v.string(),
    quizId: v.string(),
    answer: v.string(),
    correct: v.boolean(),
  })
    .index("by_topic_user_lesson_quiz", ["topicId", "userId", "lessonKey", "quizId"])
    .index("by_topic", ["topicId"]),

  // Per-lesson reading state, one row per (Topic, User, Lesson). Every reader —
  // the owner or a shared Viewer — tracks their own Progress here, keyed by their
  // userId, so a Viewer starts clean on a Topic shared with them. Every read is
  // user-scoped through `by_topic_user_lesson`; the Routine's gate reads the
  // *owner's* rows (a Viewer's completion must not fire authoring).
  progress: defineTable({
    userId: v.id("users"),
    topicId: v.id("topics"),
    lessonKey: v.string(),
    status: v.union(v.literal("opened"), v.literal("completed")),
  }).index("by_topic_user_lesson", ["topicId", "userId", "lessonKey"]),

  // The next-lesson Routine's single-flight lock, one row per Topic (see ADR
  // 0008). `frontierKey` is the lesson the in-flight (or last) run fired for;
  // with `status: "caughtUp"` it debounces re-fires until the Frontier advances.
  // `startedAt` backstops a crashed run that never reports (stale → re-fireable).
  generation: defineTable({
    topicId: v.id("topics"),
    status: v.union(
      v.literal("idle"),
      v.literal("generating"),
      v.literal("failed"),
      v.literal("caughtUp"),
    ),
    frontierKey: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    // The fire body is closed (ADR 0008), so a fired run learns its Topic by
    // calling `claimWork`, which stamps `claimedAt`/`runId` on one locked-but-
    // unclaimed row. Lets fire-all hand each concurrent run a distinct Topic.
    claimedAt: v.optional(v.number()),
    runId: v.optional(v.string()),
    // Last on-demand (button) fire, for the per-Topic manual cooldown (issue 08)
    // — the daily cron stays the primary authoring path. Survives reports.
    lastManualFireAt: v.optional(v.number()),
    // Fire-and-pray (Admin) bookkeeping. `finishRemaining` is how many more lessons
    // the back-to-back run may still author — set when the Admin starts it and
    // decremented each time a lesson is reported, so `reportGeneration` re-fires the
    // course's OWN provider (Claude routine or OpenRouter action) until it hits 0,
    // the course completes, or `cancelRequested` is set. Both absent for normal runs.
    finishRemaining: v.optional(v.number()),
    cancelRequested: v.optional(v.boolean()),
  }).index("by_topic", ["topicId"]),

  // The append-only Generation Run log (generation-observability PRD): one
  // immutable row per FINISHED Routine run, so the operator has a durable history
  // the single-flight `generation` lock (overwritten each run) can't give. Written
  // at every terminal exit — `reportGeneration` (published/nothing/failed),
  // `failGeneration` (fire never landed), `expireUnclaimedFinish` (finish run never
  // claimed) — via one `recordRun` helper, never patched or deleted (insert-once,
  // like lessons/learningRecords/certificates). `startedAt`/`endedAt` bracket the
  // run; `producedLessonKey`/`Title` name the Frontier Lesson a `published` run
  // advanced to (absent otherwise). No trigger/provider/token fields (kept lean;
  // the token seam is internal-course-studio/03's). The live "busy now" view reads
  // the lock, NOT this table — the hot acquire path is untouched. `by_topic`
  // supports a future per-course view; the global history query reads the default
  // `_creationTime` order (newest-first).
  generationRuns: defineTable({
    topicId: v.id("topics"),
    outcome: v.union(v.literal("published"), v.literal("nothing"), v.literal("failed")),
    startedAt: v.number(),
    endedAt: v.number(),
    error: v.optional(v.string()),
    producedLessonKey: v.optional(v.string()),
    producedLessonTitle: v.optional(v.string()),
  }).index("by_topic", ["topicId"]),

  // A Share: grants one person access to one **Edition** — a (Topic, language)
  // pair (course-translation). `lang` is the granted edition's BCP-47 code; a
  // person may hold several Shares on one Topic (one per language). `lang` is
  // optional so pre-translation rows read as the English edition ("en"). `role`
  // (ADR 0020) is the access level: absent/`viewer` = read-only, `editor` = may
  // make the owner's in-place prose edits on that one Edition; absent so every
  // existing Share stays a Viewer (no migration). `by_viewer` powers "Shared with
  // me"; `by_topic` lists a Topic's Viewers (and cascades on delete);
  // `by_topic_viewer` lists a person's Editions on a Topic (dedup is done
  // in-memory over these, since legacy rows carry no `lang`).
  shares: defineTable({
    topicId: v.id("topics"),
    viewerId: v.id("users"),
    lang: v.optional(v.string()),
    role: v.optional(v.union(v.literal("viewer"), v.literal("editor"))),
  })
    .index("by_viewer", ["viewerId"])
    .index("by_topic", ["topicId"])
    .index("by_topic_viewer", ["topicId", "viewerId"]),

  // A pending Share: an invite to an email that has *no account yet*. Recorded
  // when an owner shares to an unregistered address, and turned into a real Share
  // by `claimPendingShares` the moment that email signs up (sign-up is open —
  // ADR 0021). `by_email` is the claim-on-sign-up lookup; `by_topic_email` dedups an invite
  // (at most one per (Topic, email)); `by_topic` lists a Topic's open invites and
  // would cascade on Topic delete. `lang` names the invited Edition (optional →
  // English), so an invite claimed at sign-up becomes a language-scoped Share.
  // `role` (ADR 0020) rides through the claim, so an email can be pre-set as an
  // Editor before it has an account (absent → viewer).
  pendingShares: defineTable({
    topicId: v.id("topics"),
    email: v.string(),
    lang: v.optional(v.string()),
    role: v.optional(v.union(v.literal("viewer"), v.literal("editor"))),
  })
    .index("by_email", ["email"])
    .index("by_topic", ["topicId"])
    .index("by_topic_email", ["topicId", "email"])
    .index("by_topic_email_lang", ["topicId", "email", "lang"]),

  // An earned Certificate (ADR 0015): one immutable row per (User, Topic),
  // minted when the caller claims it (Topic `completed` + all non-superseded
  // Lessons in their own Progress). `learnerName` / `courseTitle` / `lessonCount`
  // are snapshots frozen at issue — reopening/extending the Topic never rewrites
  // them; the issue date is the row's `_creationTime`. `token` is a 256-bit hex
  // capability (the Certificate link), distinct from a Topic's `publicToken`.
  // `by_token` is the anonymous public read; `by_topic_user` is the dedup +
  // "does this caller already have one?" lookup.
  certificates: defineTable({
    topicId: v.id("topics"),
    userId: v.id("users"),
    token: v.string(),
    learnerName: v.string(),
    courseTitle: v.string(),
    lessonCount: v.number(),
    // The Edition the learner completed in (course-translation): the certificate
    // snapshots the title + text direction of that language. Optional so
    // pre-translation certificates read as the English edition ("en").
    lang: v.optional(v.string()),
    // The Emblem frozen at claim (ADR 0017), a snapshot of the Topic's Emblem
    // alongside `courseTitle`/`lessonCount` — no `ownerSet`, since precedence is
    // already resolved. `imageId` references an immutable blob, so it always
    // resolves even after the Topic's Emblem is later changed. Optional: rows
    // minted before this feature (and Topics with no Emblem) carry none, resolving
    // to the generic default glyph at read.
    emblem: v.optional(
      v.object({
        imageId: v.optional(v.id("_storage")),
        glyph: v.optional(v.string()),
      }),
    ),
  })
    .index("by_token", ["token"])
    .index("by_topic_user", ["topicId", "userId"]),

  // A question the learner asked from inside a lesson; the teacher replies.
  questions: defineTable({
    userId: v.id("users"),
    topicId: v.id("topics"),
    lessonKey: v.string(),
    text: v.string(),
    status: v.union(v.literal("open"), v.literal("answered")),
    reply: v.optional(v.string()),
  })
    .index("by_topic_user", ["topicId", "userId"])
    .index("by_topic_status", ["topicId", "status"]),

  // ---- Course translation (Editions) ---------------------------------------

  // A translated projection of one source (English) item into one language. The
  // source rows (lessons/references/topics/questions) stay untouched and
  // immutable; a row here holds the rendered-in-`lang` version. A MISSING row
  // means the reader falls back to the English source — so a row exists only for
  // a *successful* translation (failures live on the job, never as a bad row).
  // `sourceHash` is a hash of the source content this was translated from, so a
  // re-translate can skip items whose source is unchanged. `kind` selects which
  // field carries the payload: lesson/reference → title + html; title/mission →
  // text; question → text (the question) + reply. `key` is the lesson/reference
  // key, the question `_id`, or "" for the Topic-level title/mission.
  translations: defineTable({
    topicId: v.id("topics"),
    lang: v.string(), // BCP-47 code, e.g. "es", "ur" — never "en" (that's the source)
    kind: v.union(
      v.literal("lesson"),
      v.literal("reference"),
      v.literal("mission"),
      v.literal("title"),
      v.literal("question"),
    ),
    key: v.string(),
    title: v.optional(v.string()),
    // The translated lesson/reference body. Still stored inline (`html`) for new
    // translations — migrating the translation write-path to blobs is a follow-up.
    // Rows migrated by the one-shot backfill carry `htmlStorageId`; the reader
    // serves whichever is present (see .scratch/html-blob-storage).
    html: v.optional(v.string()),
    htmlStorageId: v.optional(v.id("_storage")),
    text: v.optional(v.string()),
    reply: v.optional(v.string()),
    sourceHash: v.string(),
  })
    .index("by_topic_lang", ["topicId", "lang"])
    .index("by_topic_lang_kind_key", ["topicId", "lang", "kind", "key"]),

  // One translation job per (Topic, language) — the Editions panel's live status
  // AND the single-flight lock for the translate run (mirrors `generation`).
  // Seeded "translating" by `startTranslation` on a completed course, which then
  // schedules the Gemini translate action; `publishTranslation` ticks `done` per
  // item, and `reportTranslation` flips it "ready" (unpublished items → `failed`,
  // English fallback) or "failed". `total` counts translatable items. Reused
  // (patched) on re-translate — a re-fire RESUMES: `done` is re-seeded with the
  // items whose translation is already fresh, and the run skips them.
  translationJobs: defineTable({
    topicId: v.id("topics"),
    lang: v.string(),
    status: v.union(v.literal("translating"), v.literal("ready"), v.literal("failed")),
    total: v.number(),
    done: v.number(),
    failed: v.number(),
    error: v.optional(v.string()),
    // Which engine last produced (or is producing) this Edition (translation-engine-
    // picker): `free` POSTs the cloud claude.ai translate Routine (no token cost,
    // slower); `gemini` schedules the in-Convex `translateTopic` action (follows
    // TRANSLATE_PROVIDER, Gemini by default). Optional — ABSENT reads as `gemini`,
    // so every pre-existing job stays on today's behaviour with no migration. A
    // re-translate with a DIFFERENT engine forces a full redo (translate.ts).
    engine: v.optional(v.union(v.literal("free"), v.literal("gemini"))),
    // The run's heartbeat: stamped at acquire, re-stamped by every published
    // item. A "translating" job whose heartbeat goes silent (the action was
    // killed infra-side, so nothing ever reported) is presumed dead and its
    // lock may be retaken (see translate.ts STALE_MS).
    claimedAt: v.optional(v.number()),
    runId: v.optional(v.string()),
  })
    .index("by_topic", ["topicId"])
    .index("by_topic_lang", ["topicId", "lang"]),

  // A per-Edition Public link: an unguessable token granting anonymous read-only
  // access to ONE (Topic, language) Edition — the account-less counterpart to a
  // language-scoped Share. Supersedes the single per-Topic `topics.publicToken`,
  // which is still honoured as a legacy English link (public.ts) so existing
  // links survive with no migration. `by_token` is the Guest read seam.
  publicLinks: defineTable({
    topicId: v.id("topics"),
    lang: v.string(),
    token: v.string(),
  })
    .index("by_token", ["token"])
    .index("by_topic", ["topicId"])
    .index("by_topic_lang", ["topicId", "lang"]),

  // A self-enroll grant (ADR 0023): a member's own, self-initiated read access to
  // ONE **Edition** — a (Topic, language) pair — of a **free, published** course.
  // The fifth access primitive, distinct from owner-granted `shares` and paid
  // `entitlements` so a self-join is never mislabelled under "Shared with me" /
  // "Purchases" (this is a discovery feature — the label is what the learner sees).
  // One row per (user, Topic, language); the presence of the row IS the access. An
  // enrolled learner is treated ≡ a Viewer of that Edition everywhere (read access,
  // own Progress, Certificate eligibility), scoped to one language (joining `en`
  // does not unlock `es`). PERMANENT / grandfathered like an Entitlement: pricing a
  // formerly-free Edition keeps existing enrollees in, stops only new free joins —
  // the resolver's enrollment check wins regardless of current price. Written only
  // for a currently-free, `published` Edition; idempotent per (user, Topic, lang).
  // `by_topic_user` is the resolver's hold check (a learner may hold several, one
  // per language — matched in-memory like Shares/Entitlements); `by_topic` cascades
  // on Topic delete; `by_user` backs "my enrolled courses".
  enrollments: defineTable({
    userId: v.id("users"),
    topicId: v.id("topics"),
    lang: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_topic", ["topicId"])
    .index("by_topic_user", ["topicId", "userId"]),

  // A **published Edition**: the owner's decision to list ONE (Topic, language)
  // Edition in its tenant's catalogue. Publishing is a `published` BOOLEAN at the
  // Edition grain — deliberately NOT a `topics.status` value (that course-level
  // grain is superseded) — so it composes with prices, Shares and public links
  // rather than folding into the authoring lifecycle. The row is written on the
  // first publish and flipped in place on unpublish (an absent row and
  // `published: false` both read as unlisted). Owner-only to write
  // (catalogue.setEditionPublished). Two consequences, both per-Edition: the
  // catalogue lists it, and — while the Edition is FREE — any signed-in caller
  // reads it as a Viewer (convex/lib.ts). Not to be confused with a **Public
  // link** (`publicLinks`, anonymous bearer token) or with the teach→Hub
  // "publish" push. `by_topic_lang` is the per-Edition lookup both consequences
  // use; `by_topic` lists a course's published Editions (and cascades on delete).
  publishedEditions: defineTable({
    topicId: v.id("topics"),
    lang: v.string(),
    published: v.boolean(),
  })
    .index("by_topic", ["topicId"])
    .index("by_topic_lang", ["topicId", "lang"]),

  // ---- Monetisation (paid marketplace, ADR 0016) ---------------------------

  // The price of one **Edition** — a (Topic, language) pair. The PRESENCE of a
  // listing row is what makes an Edition **paid**; its absence means the Edition
  // is free and behaves exactly as course-translation serves it today. `amount`
  // is in the currency's minor units (cents) and `currency` is a lower-case
  // ISO-4217 code — **ZAR-only** on the PayFast rail (the platform's settlement
  // currency; .scratch/payfast-payments). One row per Edition — `by_topic_lang`
  // is the price lookup the access resolver consults; `by_topic` lists a Topic's
  // priced Editions (and cascades on Topic delete).
  listings: defineTable({
    topicId: v.id("topics"),
    lang: v.string(),
    amount: v.number(),
    currency: v.string(),
  })
    .index("by_topic", ["topicId"])
    .index("by_topic_lang", ["topicId", "lang"]),

  // An **Entitlement**: an account's purchased, permanent right to read one paid
  // **Edition** — a (Topic, language) pair — past its free **Preview**. One row
  // per (buyer, Topic, language); the presence of the row *is* the access. It is
  // the paid twin of a language-scoped Share: an entitled buyer is treated as a
  // Viewer of that Edition everywhere (read access, own Progress, Certificate
  // eligibility), and — like a Share — is scoped to one language (buying `es`
  // does not unlock `ur`). Never expires. `by_topic_user` is the resolver's hold
  // check (a buyer may hold several, one per language — matched in-memory like
  // Shares); `by_topic` cascades on Topic delete; `by_user` backs "my purchases".
  // Rows are minted by the verified PayFast ITN (or the manual Admin grant).
  entitlements: defineTable({
    userId: v.id("users"),
    topicId: v.id("topics"),
    lang: v.string(),
    // The PayFast payment that bought this Edition — provenance back to the sale
    // (and its Ledger row). Optional: Admin-granted / legacy rows carry none.
    pfPaymentId: v.optional(v.string()),
    // The EFT reference that bought it instead (manual EFT rail, ticket 04). At
    // most one of the two is ever present, so every Entitlement says which rail
    // sold the seat; neither present = an Admin grant or a legacy row.
    eftRef: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_topic", ["topicId"])
    .index("by_topic_user", ["topicId", "userId"]),

  // A checkout-intent (.scratch/payfast-payments, auth-first per
  // .scratch/auth-first-checkout): one row per Buy click, linking our
  // `m_payment_id` reference to the buyer's ACCOUNT email (frozen at Buy —
  // never a typed argument), the Edition being bought, and the PRICE SHOWN at
  // that moment (`amount`, cents). The return page resolves it by
  // `m_payment_id` (an unguessable token — a bearer capability) to drive the
  // confirming banner, and the ITN matches the paid amount against `amount` —
  // the intent, not the live listing, so a re-price/un-list between Buy and
  // payment never strands a genuine payment. The intent itself grants nothing;
  // only the verified ITN does.
  checkoutIntents: defineTable({
    mPaymentId: v.string(),
    email: v.string(),
    topicId: v.id("topics"),
    lang: v.string(),
    amount: v.number(),
  }).index("by_m_payment_id", ["mPaymentId"]),

  // The ITN idempotency ledger (.scratch/payfast-payments): one row per PayFast
  // payment id already processed. fulfillPurchase records it inside the same
  // transaction that mints access + writes the Ledger, so a re-delivered ITN
  // (PayFast retries) is a no-op — never a double grant or double Ledger row.
  payfastEvents: defineTable({
    pfPaymentId: v.string(),
  }).index("by_pf_payment_id", ["pfPaymentId"]),

  // The money **Ledger** (.scratch/payfast-payments): one row per money event,
  // written by the verified ITN in the same transaction as whatever it grants.
  // Everything settles into the operator's single PayFast account, so this is the
  // record of what the operator owes each payee: the ITN's gross/fee/net (cents)
  // split on net into sellerShare (owed) and platformShare. The operator pays out
  // by EFT out of band and flips `owed` → `paid` with a reference — `by_status`
  // is the owed-per-payee rollup's scan.
  //
  // ADR 0027 admitted a SECOND kind of money event — a donation, which has no
  // course and grants nothing — to this shared table, the same move ADR 0026 made
  // when it widened `pfPaymentId`. That is what `topicId`/`lang` being optional
  // means: absent on a donation row, always present on a sale.
  ledger: defineTable({
    // The course/Edition this row is revenue for — a SALE row only. Absent on a
    // donation (ADR 0027): a donation buys no Edition.
    topicId: v.optional(v.id("topics")),
    lang: v.optional(v.string()),
    // Who the operator owes: the course owner on a sale, the tenant's
    // `donationPayee` on a donation.
    sellerId: v.id("users"),
    buyerEmail: v.string(),
    gross: v.number(),
    fee: v.number(),
    net: v.number(),
    sellerShare: v.number(),
    platformShare: v.number(),
    // Provenance: which rail sold this seat. EXACTLY ONE of the two is present —
    // `pfPaymentId` for a PayFast sale, `eftRef` for a manually confirmed bank
    // transfer (manual EFT rail, ticket 04). `pfPaymentId` was widened from
    // required to optional to make room for the second rail; there is no plan to
    // narrow it back (narrowing needs the data stripped in an earlier merge —
    // docs/agents/project-context.md).
    pfPaymentId: v.optional(v.string()),
    eftRef: v.optional(v.string()),
    // WHAT kind of money event this is (ADR 0027) — explicit, never inferred from
    // an absent `topicId`: "absent means donation" is an inference every future
    // reader has to rediscover, and it forecloses a third money source. Optional
    // only because rows predating ADR 0027 exist; every writer sets it, and
    // `backfill.backfillLedgerKind` stamps the legacy rows "sale" so it can be
    // narrowed to required later.
    kind: v.optional(v.union(v.literal("sale"), v.literal("donation"))),
    status: v.union(v.literal("owed"), v.literal("paid")),
    payoutRef: v.optional(v.string()),
  }).index("by_status", ["status"]),

  // A **Seller**'s capability record (ADR 0016 / .scratch/payfast-payments).
  // Selling is a two-gate capability: the PRESENCE of a row is the Admin's
  // **can-sell** grant, and the Seller then saves the SA payout bank details the
  // operator EFTs their Ledger share to — no external onboarding, Sellers never
  // register a payment account. A Seller (CONTEXT) requires BOTH before pricing.
  // Revoking can-sell deletes this row (which stops *new* pricing) but never
  // touches already-sold Entitlements. One row per user; `by_user` is the
  // grant/status lookup. Bank details are Admin-readable only (never returned by
  // a non-admin query, never logged).
  sellers: defineTable({
    userId: v.id("users"),
    payout: v.optional(payoutDetailsValidator),
  }).index("by_user", ["userId"]),

  // The **operator's collection** bank account (manual EFT rail, ywampotch-launch
  // ticket 02): where a buyer EFTs the purchase price. GLOBAL and SINGULAR — money
  // lands in one account whichever tenant sold the course — so this table holds at
  // most ONE row and needs no index (`.first()` is the read). Not to be confused
  // with `sellers.payout`, which is the opposite direction: where the operator EFTs
  // a Seller's share TO. Same four SA fields though, so it reuses
  // `payoutDetailsValidator` (its `accountHolder` is the ticket's "account name").
  // `enabled` is the rail's explicit on/off switch: false hides "Pay by EFT" and
  // makes the buyer-facing read return nothing. Sys-admin-only to write.
  // ponytail: a singleton row, not a settings key/value bag — grow it as typed
  // fields if the rail ever needs more, like `userPrefs`.
  operatorBank: defineTable({
    ...payoutDetailsValidator.fields,
    enabled: v.boolean(),
  }),

  // An **EFT intent** (manual EFT rail, ywampotch-launch ticket 03): one row per
  // "Pay by EFT" click, holding the `ref` the buyer types into their banking app
  // and everything the operator needs to match the transfer that arrives — who
  // (`userId`), what (`topicId` + `lang`) and how much was SHOWN (`amount`, cents,
  // frozen at click like `checkoutIntents.amount`, so a re-price never strands a
  // genuine payment). The intent grants NOTHING: only the operator's confirmation
  // (ticket 04) mints the Entitlement + Ledger row.
  //
  // Deliberately NOT a widened `checkoutIntents` (see ticket 03 notes): that table
  // sits on the live PayFast ITN path holding real purchases, and this rail must
  // have zero blast radius on it.
  //
  // `status` is the queue's state: `pending` awaits the money, `confirmed` was
  // granted, `dismissed` never got paid (litter, not an error). `by_ref` is the
  // reference-uniqueness check and the operator's lookup; `by_status` is the
  // confirm queue's read; `by_user_topic` is the buyer's own "do I already have a
  // reference for this Edition?" read (lang matched in memory, like entitlements).
  eftIntents: defineTable({
    ref: v.string(),
    userId: v.id("users"),
    topicId: v.id("topics"),
    lang: v.string(),
    amount: v.number(),
    status: v.union(v.literal("pending"), v.literal("confirmed"), v.literal("dismissed")),
  })
    .index("by_ref", ["ref"])
    .index("by_status", ["status"])
    .index("by_user_topic", ["userId", "topicId"]),

  // A signed-in user's personal preferences (app-language-i18n ticket 03 §1).
  // One row per user, minted on their first app-language pick. `locale` is a
  // free-form BCP-47 chrome-language code (e.g. "es"); absent = never picked.
  // This is the durable, cross-device ACCOUNT truth — it is NOT read on the hot
  // render path (that's the `hindi:locale` cookie); the client reads it at login
  // and syncs it into the cookie, so a new device Just Works. Future personal
  // prefs grow as new typed optional fields here (same model as `users`), never
  // a key/value bag. `by_user` is the single lookup.
  userPrefs: defineTable({
    userId: v.id("users"),
    locale: v.optional(v.string()),
  }).index("by_user", ["userId"]),
});
