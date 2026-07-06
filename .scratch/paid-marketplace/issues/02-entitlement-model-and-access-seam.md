# 02 — Entitlement model & the single access-resolution seam

Status: needs-triage

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (**Entitlement**, **Preview**, **Seller**, **Edition**). Spec: [`../PRD.md`](../PRD.md). Decision: [ADR 0016](../../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md).

> **Edition update:** what is sold is an **Edition** `(Topic, language)`. The
> Entitlement is per-Edition and rides the **course-translation** feature's per-Edition
> access model (language-scoped Shares, per-Edition Public links). Grant, price, Preview,
> and access are all `lang`-scoped below.

## Want

The paygate's data model and the **one** access seam every read consults — testable
at the Convex layer with no Stripe and no UI. This is the spine; issues 03–05 build
on it.

## Acceptance

- **Schema additions:**
  - **Per-Edition price** — a listing keyed `(topicId, lang)` carrying
    `{ amount: number (minor units), currency: string }`. **Present ⇒ that Edition is
    paid; absent ⇒ free** (course-translation behaviour, untouched). Do **not** put the
    price on `topics` — a Seller prices languages independently.
  - **`entitlements`** relation: `(userId, topicId, lang, source)` where `source`
    records provenance (e.g. `"purchase"`), indexed `by_user_topic_lang` (dedup +
    access check) and `by_topic`. Presence of the row **is** access to that Edition;
    never expires; scoped to one `lang`.
  - **`pendingEntitlements`** relation (email-keyed, pre-account), mirroring the now
    language-scoped `pendingShares`: `(topicId, email, lang)` indexed `by_email`,
    `by_topic_email_lang` (dedup), `by_topic`. Turned into a real `entitlement` on
    sign-up.
- **`resolveEditionAccess(ctx, userId | null, slug, lang)`** helper (extending the
  course-translation per-Edition resolver) → the Topic + a level for that Edition:
  - `owner` / `viewer` — owner, or a language-scoped `shares` row for `lang`.
  - `entitled` — a signed-in user with an `entitlements` row for `(topic, lang)`.
  - `preview` — a **paid** Edition reached by someone with none of the above (Guest, or
    an authed-but-unentitled user): read is limited to that Edition's **Preview**.
  - `none` — a **free** Edition reached by an unauthorised path, or an unknown slug/lang.
- **Extend the viewable-Edition resolver** so an **entitled** user is admitted for that
  `lang` — an Entitlement grants **Viewer-equivalent** access for the Edition (read +
  their own per-Topic Progress + Certificate eligibility) with no per-surface change.
  Owner / language-scoped-Viewer / Public-link paths are unchanged. An `es` Entitlement
  must **not** admit `ur`.
- **`claimPendingEntitlements(ctx, userId, email)`** — the twin of
  [`claimPendingShares`](../../../convex/lib.ts#L19): on account creation, convert each
  `pendingEntitlements` row for the email into an `entitlements` row (idempotent per
  `(userId, topicId, lang)`; clear the pending row either way). Called from
  [`createOrUpdateUser`](../../../convex/auth.ts#L34) right after the `users` insert,
  next to the existing `claimPendingShares` call.
- **Widen the Allowlist gate** in `createOrUpdateUser`: admit an email that
  `isAdmitted` **or** has a `pendingEntitlements` row (a paid buyer). A buyer account
  gains **no** selling/authoring privilege (that's issue 03's `sellers` grant only).
- **Preview identity:** a helper `previewLessonKey(ctx, topicId)` = the lowest-`seq`
  non-superseded Lesson (language-independent — the *key* is shared across Editions;
  the reader renders it in `lang`), reusing the non-superseded filter from
  `content.listLessons` / `routine.frontierLesson`.

## Depends on

- The **course-translation** feature (the per-Edition access resolver, language-scoped
  `shares.lang`, `pendingShares.lang`, `publicLinks`). This issue extends those; it
  should not be built against the pre-Edition schema.

## Notes

- **Entitled ≡ language-scoped Viewer** is the load-bearing simplification: once the
  Edition resolver admits entitled users for a `lang`, `capture.setProgress`,
  `certificates` eligibility (which already snapshots `lang`), and the authed reader all
  "just work". Verify Responses/Questions remain **owner-only** (a buyer must not gain
  write access the Viewer never had).
- Keep `pendingEntitlements` a **separate** table from `entitlements` (don't overload
  one table with an optional email) — it mirrors the `pendingShares`/`shares` split the
  codebase already reasons about, now `lang`-scoped.
- Tests mirror `shares.test.ts` (pending→claim on sign-up, idempotency, `lang`-scoping),
  `whitelist.test.ts` (gate admits paid email; buyer gets no sell grant), and add
  `resolveEditionAccess` truth-table coverage (owner/viewer/entitled/preview/none ×
  paid/free) plus the cross-language check (`es` entitlement doesn't unlock `ur`).
