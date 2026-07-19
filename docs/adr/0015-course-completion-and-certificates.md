---
status: proposed
---

# Course completion & certificates

A Topic can now reach a terminal **Completion** state that stops the authoring
loop, and a signed-in learner who finishes a completed course earns an immutable
**Certificate** with its own anonymous, printable public link. This adds the
first *terminal* state to the teaching model (which until now buffered lessons
forever) and a second capability-token concept alongside the ADR 0013 Public
link.

## Context

Two gaps motivated this, both surfaced in a grilling session (2026-07-03):

1. **The teaching loop never ends.** The Routine authors the next Lesson
   whenever the owner completes the Frontier (buffer-of-one, ADR 0008). There is
   no way for the teacher to say "the mission is achieved — stop." A course
   generates lessons indefinitely, paced only by the learner and the on-demand
   cooldown. `topics.status` was only `seeded | active`.
2. **Finishing a course is unrewarded and unrecorded.** A learner who works
   through a whole course gets no artefact and no proof. The ask: a certificate
   for courses *completed on the platform* (not for anonymous public-link
   readers), with a shareable public link that is downloadable.

Two facts about the current model shape the design:

- **Progress is already per-reader.** Both the owner and a shared Viewer track
  their own `progress` rows, keyed by their account (`capture.setProgress` via
  `getViewableTopic`). A **Guest** (public link) writes nothing server-side — its
  progress lives only in `localStorage`. So "did *this account* finish every
  lesson?" is answerable today for owners and Viewers, and structurally
  unanswerable for Guests.
- **There is no display name.** Accounts hold only an email
  (`auth.ts` inserts `{ email }`). A public certificate must not leak that email.

## Decision

- **Completion is a terminal Topic state, `status: "completed"`.** It means the
  curriculum is finished — no further Lessons will be authored. The Routine's
  gate (`tryAcquireGeneration`) hard-refuses a completed Topic
  (`reason: "completed"`), so the daily cron, the reader button, and setup all
  no-op. Completion is **reversible**: reopening returns the Topic to `active`
  and authoring resumes. It is distinct from the existing soft **caught-up**
  state (nothing new *for now*), which still exists.
- **Two ways to complete a course, both writing the same state.** Primary: the
  teach skill calls a `PUBLISH_SECRET`-guarded `completeCourse(topicSlug)` when
  it judges the Mission's **"Success looks like"** outcomes substantially
  achieved (no fixed syllabus — the model stays emergent). Secondary: the
  **owner** ends their own course from the app (a deliberate, clearly-labelled
  action), which is the escape hatch for open-ended/"lifelong" missions that
  never auto-terminate. A **Viewer** never terminates — they can only earn a
  Certificate once the Topic is already completed.
- **A Certificate is a stored, per-(User, Topic) entity — not a derivation.** A
  new `certificates` table: `(topicId, userId, token, learnerName, courseTitle,
  lessonCount, issuedAt)`, indexed `by_token` (public read) and `by_topic_user`
  (dedup + "do I have one"). The `learnerName` and `lessonCount` are **snapshots**
  frozen at issue, so a later reopen/extend of the course does not mutate an earned
  Certificate. Issued **once** per (User, Topic); never revoked, never re-issued.
  - **Amendment (course title is live, not frozen):** the read seams now resolve
    the course's **current** title (in the Edition language the certificate was
    earned in) rather than the frozen `courseTitle` column, so renaming a course —
    e.g. fixing a placeholder title after certificates were already issued — shows
    on every issued certificate. The `courseTitle` column is retained only as a
    fallback when the Topic has been deleted. `learnerName`/`lessonCount` stay
    frozen. See `convex/certificates.ts` (`liveCourseTitle`).
- **Eligibility is derived; issuance is a claim.** A User is *eligible* when the
  Topic is `completed` **and** they have marked every non-superseded Lesson
  `completed`. Because the certificate must carry a **name** and none is stored,
  the user **claims** the certificate by supplying the display name to print;
  the claim mutation re-checks eligibility and mints idempotently. Before the
  claim there is no row — only eligibility.
- **The Certificate link is its own capability token, parallel to ADR 0013 — not
  the Topic's `publicToken`.** A 256-bit token (Web Crypto, hex) minted at issue
  powers an anonymous `/certificate/[token]` route outside the `(app)` auth
  group. Reads go through a token-only seam (`convex/certificates.ts`, queries
  only) with an **explicit output allowlist** — name, course title, issue date,
  lesson count — that can never return the email or any Lesson content. The link
  works even when the course itself is private. **Always-on** in v1: no
  off/regenerate controls (the content is low-sensitivity and the whole point is
  a shareable link).
- **Download is print-to-PDF.** The certificate page carries a print stylesheet;
  a "Download" button calls `window.print()` and the user saves as PDF. Zero new
  dependencies, vector-crisp, and the one page serves both the in-app view and
  the public link — matching the repo's "artifacts that print well" ethos.
- **Earning is celebrated in-app, once.** When a User becomes eligible, the
  reader shows a celebration — a `canvas-confetti` burst plus a Tailwind/CSS
  card reveal — that also collects the name and completes the claim. It fires for
  whoever becomes eligible whenever they next load (e.g. a Viewer when the owner
  terminates the course), and is suppressed on subsequent visits
  (client-tracked). On a completed course the reader replaces the "Generate next
  lesson" affordance with a "View your certificate" one.

## Considered Options

- **Certificate on "all current lessons complete", no termination gate** —
  rejected: with buffer-of-one that is the normal "caught up" state, so
  certificates would be minted mid-course and invalidated as new lessons arrive.
  A terminal Completion state is what makes "all done" mean "finished".
- **Overload the Topic's Public link for the certificate** — rejected: it
  conflates "my achievement" with "the whole course is public", forces the course
  public to share a cert, and exposes all Lessons/Q&A/Progress. A distinct,
  content-restricted token is safer and independent of the course's privacy.
- **Purely derived certificate (no row)** — rejected: no stable public token to
  hand out, no frozen issue date, and the public URL would have to encode
  `(topic, user)`, leaking identity and breaking snapshots on course change.
- **Overload `reportGeneration` with a `"completed"` outcome** — rejected as the
  primary path: it ties a curriculum-level decision to an in-flight authoring
  run. A dedicated `completeCourse` works whether or not a run is live.
- **Auto-derive the name from the email local-part** — rejected: often wrong or
  ugly and semi-leaks the email publicly. Prompting once at claim time gives the
  learner control. (A real profile-name field was deferred as out of scope.)
- **Client-side PNG/PDF (html2canvas + jsPDF) or server-rendered PDF** —
  rejected for v1: a new dependency / bundle weight (and canvas font rasterizing
  is lossy), or a headless renderer Convex doesn't have. Print-to-PDF is enough.
- **framer-motion for the celebration** — rejected: a heavy new dependency and a
  new animation paradigm for a single moment, against the repo's minimal-deps
  grain. `canvas-confetti` (~2KB) + the existing Tailwind `animate-*` idiom
  covers it.

## Consequences

- **First terminal state in the teaching model.** Reviewers and the teach skill
  must now treat `completed` as an authoring stop. The teach skill's
  instructions gain a "Terminating a course" section (judge against "Success
  looks like"; call `completeCourse`; note that lifelong missions may only end
  via the owner override).
- **Reopening leaves history.** A reopened-then-re-completed course keeps the
  *original* Certificate (its snapshot). No second certificate is minted for the
  same (User, Topic); the achievement records the first completion.
- **Guests are excluded by construction**, not by a check — they have no account
  to attribute a Certificate to and no server-side Progress. This is the
  intended reading of "not for publicly shared courses".
- **New public, unauthenticated surface** (`/certificate/[token]` +
  `convex/certificates.ts`). Like ADR 0013 it authorizes by token only and
  returns uniform `null` for a bad token; the output allowlist is the guard
  against leaking the email or lesson content.
- **A tiny course still yields a certificate** (e.g. an owner ends a one-lesson
  course). Accepted: it is the learner's own achievement, low-stakes.
