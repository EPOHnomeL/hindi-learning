import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

// The Hub, as Convex tables (see PRD §4). Local workspace files (lessons/,
// references/) remain the source of truth; `pnpm run publish` mirrors them
// here. Capture tables (responses/progress/questions) are written by the
// reader as the learner reads. Auth tables come from Convex Auth.
export default defineSchema({
  ...authTables,

  // The Allowlist (ADR 0011): the set of emails permitted to sign up, managed at
  // runtime by the single Admin instead of the old `AUTH_ALLOWED_EMAILS` env var.
  // Emails are stored already-normalised (trimmed, lower-cased) so a lookup at
  // sign-up never misses on casing/whitespace. `isAdmin` marks the one Admin row,
  // which the portal shows but refuses to remove. An empty table admits nobody.
  whitelist: defineTable({
    email: v.string(),
    isAdmin: v.optional(v.boolean()),
  }).index("by_email", ["email"]),

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
    // The LLM provider a Topic is authored with (e.g. "openrouter"). Owned by a
    // parallel feature (course-content-editing); declared optional here only so
    // this branch's schema stays compatible with the shared dev deployment, whose
    // rows already carry it. Not read by this feature — reconcile at merge.
    provider: v.optional(v.string()),
  })
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerId"])
    .index("by_owner_slug", ["ownerId", "slug"])
    .index("by_public_token", ["publicToken"]),

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
  }).index("by_topic", ["topicId"]),

  // A Share: grants one Viewer read-only access to one **Edition** — a
  // (Topic, language) pair (course-translation). `lang` is the granted edition's
  // BCP-47 code; a Viewer may hold several Shares on one Topic (one per language).
  // `lang` is optional so pre-translation rows read as the English edition ("en").
  // `by_viewer` powers "Shared with me"; `by_topic` lists a Topic's Viewers (and
  // cascades on delete); `by_topic_viewer` lists a Viewer's Editions on a Topic
  // (dedup is done in-memory over these, since legacy rows carry no `lang`).
  shares: defineTable({
    topicId: v.id("topics"),
    viewerId: v.id("users"),
    lang: v.optional(v.string()),
  })
    .index("by_viewer", ["viewerId"])
    .index("by_topic", ["topicId"])
    .index("by_topic_viewer", ["topicId", "viewerId"]),

  // A pending Share: an invite to an email that has *no account yet*. Recorded
  // when an owner shares to an unregistered address, and turned into a real Share
  // by `claimPendingShares` the moment that email signs up. Sign-up itself stays
  // gated by the Admin's Allowlist (ADR 0011) — an invite does not open that door.
  // `by_email` is the claim-on-sign-up lookup; `by_topic_email` dedups an invite
  // (at most one per (Topic, email)); `by_topic` lists a Topic's open invites and
  // would cascade on Topic delete. `lang` names the invited Edition (optional →
  // English), so an invite claimed at sign-up becomes a language-scoped Share.
  pendingShares: defineTable({
    topicId: v.id("topics"),
    email: v.string(),
    lang: v.optional(v.string()),
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
  // AND the single-flight lock for the translate Routine (mirrors `generation`).
  // Seeded "translating" by `startTranslation` on a completed course, which then
  // fires the routine; the fired run claims it (`claimTranslation` stamps
  // `claimedAt`/`runId`), `publishTranslation` ticks `done` per item, and
  // `reportTranslation` flips it "ready" (unpublished items → `failed`, English
  // fallback) or "failed". `total` counts translatable items. Reused (patched) on
  // re-translate.
  translationJobs: defineTable({
    topicId: v.id("topics"),
    lang: v.string(),
    status: v.union(v.literal("translating"), v.literal("ready"), v.literal("failed")),
    total: v.number(),
    done: v.number(),
    failed: v.number(),
    error: v.optional(v.string()),
    // Set when a fired run claims this job; keeps a second run from grabbing it.
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
  })
    .index("by_user", ["userId"])
    .index("by_topic", ["topicId"])
    .index("by_topic_user", ["topicId", "userId"]),

  // A **pending Entitlement** (ADR 0016): a paid purchase for an email that has
  // *no account yet* — the paid twin of a `pendingShares` invite. Minted by the
  // verified ITN when the buyer's email has no `users` row, and turned into a
  // real (language-scoped) Entitlement by `claimPendingEntitlements` the moment
  // that email signs up. Carries the `lang` so the claimed access is scoped to the
  // Edition bought. `by_email` is the claim-on-sign-up lookup and the Allowlist
  // admission check (a paid email may sign up though sign-up is otherwise closed);
  // `by_topic_email_lang` dedups a purchase; `by_topic` cascades on Topic delete.
  pendingEntitlements: defineTable({
    email: v.string(),
    topicId: v.id("topics"),
    lang: v.string(),
    // The PayFast payment that bought it — copied onto the real Entitlement when
    // the buyer claims it. Optional for rows minted by the manual Admin grant.
    pfPaymentId: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_topic", ["topicId"])
    .index("by_topic_email_lang", ["topicId", "email", "lang"]),

  // The ITN idempotency ledger (.scratch/payfast-payments): one row per PayFast
  // payment id already processed. fulfillPurchase records it inside the same
  // transaction that mints access + writes the Ledger, so a re-delivered ITN
  // (PayFast retries) is a no-op — never a double grant or double Ledger row.
  payfastEvents: defineTable({
    pfPaymentId: v.string(),
  }).index("by_pf_payment_id", ["pfPaymentId"]),

  // The money **Ledger** (.scratch/payfast-payments): one row per sale, written by
  // the verified ITN in the same transaction as the Entitlement. All sales settle
  // into the operator's single PayFast account, so this is the record of what the
  // operator owes each author: the ITN's gross/fee/net (cents) split 50/50 on net
  // into authorShare (owed to the author) and platformShare. The operator pays out
  // by EFT out of band and flips `owed` → `paid` with a reference — `by_status`
  // is the owed-per-author rollup's scan.
  ledger: defineTable({
    topicId: v.id("topics"),
    lang: v.string(),
    sellerId: v.id("users"),
    buyerEmail: v.string(),
    gross: v.number(),
    fee: v.number(),
    net: v.number(),
    authorShare: v.number(),
    platformShare: v.number(),
    pfPaymentId: v.string(),
    status: v.union(v.literal("owed"), v.literal("paid")),
    payoutRef: v.optional(v.string()),
  }).index("by_status", ["status"]),

  // A **Seller**'s capability record (ADR 0016 / .scratch/payfast-payments).
  // Selling is a two-gate capability: the PRESENCE of a row is the Admin's
  // **can-sell** grant, and the author then saves the SA payout bank details the
  // operator EFTs their Ledger share to — no external onboarding, authors never
  // register a payment account. A Seller (CONTEXT) requires BOTH before pricing.
  // Revoking can-sell deletes this row (which stops *new* pricing) but never
  // touches already-sold Entitlements. One row per user; `by_user` is the
  // grant/status lookup. Bank details are Admin-readable only (never returned by
  // a non-admin query, never logged).
  sellers: defineTable({
    userId: v.id("users"),
    payout: v.optional(
      v.object({
        accountHolder: v.string(),
        bank: v.string(),
        accountNumber: v.string(),
        branchCode: v.string(),
      }),
    ),
  }).index("by_user", ["userId"]),
});
