# 02 — Certificates: relation, eligibility, claim, and the anonymous read seam

Status: ready-for-agent

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (**Certificate**, **Certificate link**, **Completion**). Spec: [`../PRD.md`](../PRD.md). Decision: [ADR 0015](../../../docs/adr/0015-course-completion-and-certificates.md).

## Want

The whole certificate backend, testable at the Convex seam with no UI: a
`certificates` relation, a derived eligibility signal, an idempotent claim that
mints a snapshot with a capability token, and an anonymous token-only read seam
that exposes only the achievement.

## Acceptance

- **A new `certificates` relation**, one row per earned Certificate:
  `(topicId, userId, token, learnerName, courseTitle, lessonCount, issuedAt)`,
  indexed `by_token` (anonymous read) and `by_topic_user` (dedup + "do I have
  one?"). `learnerName` / `courseTitle` / `lessonCount` are **snapshots** frozen
  at issue.
- **Eligibility** is derived, not stored: a caller is eligible for a Topic when
  its `status` is `completed` **and** every non-superseded Lesson (same filter as
  the Frontier) appears in *that caller's own* completed Progress (same per-caller
  read as `capture.myProgress`).
- **`myCertificate(topicSlug)`** (authed, owner-or-Viewer gated) returns the
  caller's earned Certificate row if it exists, else an eligibility flag, else
  neither — enough for the reader/celebration/dashboard to decide what to show.
- **`claimCertificate(topicSlug, name)`** (authed, owner-or-Viewer gated):
  re-checks eligibility server-side; mints one row with a fresh 256-bit hex token
  (Web Crypto, like the Public-link token) and the snapshots; a second call
  returns the **existing** row (idempotent — never a duplicate); a claim while
  ineligible is refused. A blank/whitespace `name` falls back to the email's
  local-part. `lessonCount` snapshots the non-superseded Lesson count at issue.
- **Permanence**: reopening a Topic (issue `01`) and later re-completing it does
  **not** re-mint or mutate an existing Certificate.
- **An anonymous read seam `convex/certificates.ts`**, queries only, authorized
  **by token, never `getAuthUserId`** — the exact shape of
  [`convex/public.ts`](../../../convex/public.ts). `publicCertificate(token)`
  returns an **explicit output allowlist** — `learnerName`, `courseTitle`,
  `issuedAt`, `lessonCount` — and **nothing else** (never the email, userId, or
  any Lesson content). A missing/invalid token returns uniform `null`.

## Depends on

- `01` (needs `status: "completed"` and the completion mutations to reach an
  eligible state in tests).

## Notes

- Reuse the non-superseded filtering already in `routine.frontierLesson` /
  `content.listLessons` and the per-caller Progress read in `capture.myProgress`
  so eligibility can't drift from what the reader shows.
- Tests (the load-bearing seam) mirror `public.test.ts` (token reads) and
  `routine.test.ts` (`PUBLISH_SECRET`, `withIdentity`): eligibility gating
  (active-but-all-done → not eligible; completed-but-one-unmarked → not eligible;
  completed + all done → eligible; superseded lessons don't block), claim
  idempotency + snapshots + blank-name fallback, owner and Viewer each earning
  their own, permanence across reopen, and the public read's allowlist + null.
- Covers PRD stories 13, 14, 15 (Guest excluded — no public mutation exists),
  16 (name arg + fallback), 17, 18, 19, 20 (eligibility persists until claimed),
  26, 27, 29.
