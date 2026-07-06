# 02 — Entitlement model & the single access-resolution seam

Status: needs-triage

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (**Entitlement**, **Preview**, **Seller**). Spec: [`../PRD.md`](../PRD.md). Decision: [ADR 0016](../../../docs/adr/0016-paid-course-marketplace-stripe-connect-facilitator.md).

## Want

The paygate's data model and the **one** access seam every read consults — testable
at the Convex layer with no Stripe and no UI. This is the spine; issues 03–05 build
on it.

## Acceptance

- **Schema additions:**
  - `topics.price` — optional `{ amount: number (minor units), currency: string }`.
    **Present ⇒ paid; absent ⇒ free** (today's behaviour, untouched).
  - **`entitlements`** relation: `(userId, topicId, source)` where `source` records
    provenance (e.g. `"purchase"`), indexed `by_user_topic` (dedup + access check)
    and `by_topic`. Presence of the row **is** the access; never expires.
  - **`pendingEntitlements`** relation (email-keyed, pre-account), mirroring
    `pendingShares`: `(topicId, email)` indexed `by_email`, `by_topic_email`
    (dedup), `by_topic`. Turned into a real `entitlement` on sign-up.
- **`resolveTopicAccess(ctx, userId | null, slug)`** helper → the Topic + a level:
  - `owner` / `viewer` — as today (owner, or a `shares` row).
  - `entitled` — a signed-in user with an `entitlements` row for the Topic.
  - `preview` — a **paid** Topic reached by someone with none of the above (Guest,
    or an authed-but-unentitled user): read is limited to the **Preview**.
  - `none` — a **free** Topic with no owner/Viewer access via an unauthorised path,
    or an unknown slug.
- **Extend [`getViewableTopic`](../../../convex/lib.ts#L68)** so an **entitled** user
  returns the Topic — i.e. an Entitlement grants **Viewer-equivalent** access
  everywhere (read + their own Progress + Certificate eligibility) with no
  per-surface change. Owner/Viewer paths are unchanged.
- **`claimPendingEntitlements(ctx, userId, email)`** — the twin of
  [`claimPendingShares`](../../../convex/lib.ts#L19): on account creation, convert
  each `pendingEntitlements` row for the email into an `entitlements` row
  (idempotent per `(userId, topicId)`; clear the pending row either way). Called
  from [`createOrUpdateUser`](../../../convex/auth.ts#L34) right after the `users`
  insert, next to the existing `claimPendingShares` call.
- **Widen the Allowlist gate** in `createOrUpdateUser`: admit an email that
  `isAdmitted` **or** has a `pendingEntitlements` row (a paid buyer). A buyer
  account gains **no** selling/authoring privilege (that's issue 03's `sellers`
  grant only).
- **Preview identity:** a helper `previewLessonKey(ctx, topicId)` = the lowest-`seq`
  non-superseded Lesson, reusing the non-superseded filter from
  `content.listLessons` / `routine.frontierLesson`.

## Depends on

- Nothing. Pure Convex + schema; lands before 03–05.

## Notes

- **Entitled ≡ Viewer** is the load-bearing simplification: once `getViewableTopic`
  returns for entitled users, `capture.setProgress`, `certificates` eligibility, and
  the authed reader all "just work". Verify Responses/Questions remain **owner-only**
  (a buyer must not gain write access the Viewer never had).
- Keep `pendingEntitlements` a **separate** table from `entitlements` (don't overload
  one table with an optional email) — it mirrors the `pendingShares`/`shares` split
  the codebase already reasons about.
- Tests mirror `shares.test.ts` (pending→claim on sign-up, idempotency),
  `whitelist.test.ts` (gate admits paid email; buyer gets no sell grant), and add
  `resolveTopicAccess` truth-table coverage (owner/viewer/entitled/preview/none ×
  paid/free).
