# PRD: Course completion & certificates

Status: shipped — course-completion delivered (issues 01–05 done; commits 88a2f83…ff7ec91)

> Vocabulary follows [`CONTEXT.md`](../../CONTEXT.md) — in particular the new
> **Completion** (terminal Topic state) and **Certificate** / **Certificate
> link** terms added for this feature. Design decisions and rejected
> alternatives are recorded in
> [ADR 0015](../../docs/adr/0015-course-completion-and-certificates.md); this PRD
> is the build spec.

## Problem Statement

Two connected gaps, from the learner's side:

1. **A course never ends.** The Routine authors the next Lesson every time the
   owner completes the Frontier (buffer-of-one). There is no way for the teacher
   to declare "the mission is achieved — stop." A learner who has genuinely
   finished keeps being offered "Generate next lesson", and an unattended Routine
   would keep drafting Lessons indefinitely. There is no sense of *arriving*.
2. **Finishing is unrewarded and unrecorded.** A learner who works all the way
   through a course gets no artefact, no proof, and no moment of celebration.
   There is nothing to keep, show a manager, or share.

## Solution

A course can reach **Completion** — a terminal state where its curriculum is
finished and no more Lessons will ever be authored. The teach skill declares
this when the Mission's "Success looks like" outcomes are substantially achieved;
the owner can also end their own course manually (the escape hatch for
open-ended, "lifelong" missions). Once a Topic is completed, the Routine's gate
stops authoring, and the reader stops offering "Generate next lesson".

When a signed-in learner has both (a) a completed Topic and (b) marked every
non-superseded Lesson complete, they have **earned a Certificate**. Earning is
celebrated in-app with a confetti animation and a certificate-card reveal, where
the learner types the **name** to print on it. The Certificate is then a
permanent, immutable record with its own **Certificate link** — an anonymous,
account-less URL (`/certificate/<token>`) anyone can open, showing only the
achievement (name, course title, completion date, lesson count) and never the
lessons or the learner's email. From that page the learner (or anyone) can
**download** it as a PDF via the browser's print-to-PDF.

Both the owner and a shared **Viewer** can each earn their own Certificate for
the same Topic (each keyed to their own account and Progress). An anonymous
**Guest** cannot — there is no account to attribute it to. A completed course can
be **reopened** later (mission shifts, learner wants more); reopening resumes
authoring but never revokes a Certificate already earned.

## User Stories

### Completing a course — teacher-driven
1. As the teach skill, I want to call a `completeCourse` command when I judge the Mission's "Success looks like" outcomes substantially achieved, so that a finished course stops generating Lessons.
2. As the teach skill, I want `completeCourse` to be guarded by the publish secret like my other write-backs, so that only the trusted teaching runtime can terminate a course.
3. As the teach skill, I want clear instructions on *when* to terminate (outcomes met, or the zone of proximal development is exhausted / returns diminish) versus keep going, so that I neither stop prematurely nor run forever.
4. As the teach skill, I want to know that lifelong/open-ended missions may legitimately never auto-complete, so that I leave those to the owner's manual end rather than forcing a finish.

### Completing a course — owner-driven
5. As an owner, I want a clearly-labelled "Mark course complete" action on my course, so that I can conclude a course whose mission I've satisfied (especially open-ended ones the teacher won't auto-end).
6. As an owner, I want a confirmation before ending my course, so that I don't terminate authoring by accident.
7. As an owner, I want to reopen a course I (or the teacher) completed, so that I can keep learning when my mission grows.
8. As an owner, I want reopening to resume the normal next-lesson authoring, so that a reopened course behaves like an active one again.
9. As a Viewer, I never see "Mark course complete" or "Reopen" on a shared course — only the owner terminates or reopens.

### Authoring stops when complete
10. As an owner of a completed course, I want the "Generate next lesson" control replaced by a "View your certificate" affordance, so that the finished state is obvious and I'm not invited to generate more.
11. As the system, I want the Routine's gate to refuse any completed Topic (daily cron, reader button, and setup fire all no-op), so that a completed course cannot author another Lesson.
12. As the system, I want a manual/`curl` fire against a completed course to still be a no-op at the gate, so that termination holds even outside the reader.

### Earning a certificate
13. As an owner, I want to earn a Certificate once my course is complete and I've marked every Lesson complete, so that I have proof I finished.
14. As a Viewer, I want to earn my own Certificate on a shared course once it's completed and I've marked every Lesson complete, so that finishing someone else's course still rewards me.
15. As a Guest (anonymous public-link reader), I understand I cannot earn a Certificate, because there's no account to attribute it to.
16. As a learner, I want to be prompted for the name to print on my Certificate when I earn it, so that it reads correctly and never exposes my email.
17. As a learner, I want my Certificate to be issued exactly once per course, so that revisiting or re-marking lessons doesn't create duplicates.
18. As a learner, I want my Certificate to record the completion date, the course title, and how many lessons it covered, so that it's a meaningful record.
19. As a learner, I want my Certificate to survive the course later being reopened and extended, so that my proof of what I finished isn't rewritten or revoked.
20. As a learner, if the course is completed *after* I'd already finished every lesson, I want to earn my Certificate the next time I open it, so that late termination still rewards prior completion.

### Celebrating
21. As a learner, I want a celebratory animation (confetti + a certificate-card reveal) at the moment I earn a Certificate, so that finishing feels like an achievement.
22. As a learner, I want the celebration to appear once — not every time I revisit a completed lesson — so that it stays special and isn't annoying.
23. As a learner, I want the celebration to lead directly into viewing and downloading my Certificate, so that I can act on the moment.

### Viewing, sharing, and downloading
24. As a learner, I want a "View certificate" affordance on my completed course (in the reader and on the dashboard card), so that I can return to it any time.
25. As a learner, I want a public Certificate link I can copy and share, so that anyone — a manager, a friend — can see I completed the course without signing in.
26. As anyone with the Certificate link, I want to open it with no account and see the name, course title, completion date, and lesson count, so that I can verify the achievement.
27. As anyone with the Certificate link, I never see the course's Lessons, Resources, Q&A, or the learner's email, so that a Certificate reveals only the achievement.
28. As anyone viewing a Certificate, I want a "Download" button that saves it as a clean, print-formatted PDF, so that I can keep or attach it.
29. As a holder of a wrong or made-up Certificate token, I get nothing (a uniform not-found), so that Certificates can't be enumerated.

### Dashboard
30. As an owner, I want my completed courses marked as complete on the dashboard with a link to the Certificate, so that I can see and reach my achievements at a glance.
31. As a Viewer, I want a shared course I've finished to show my completion and my Certificate link in "Shared with me", so that my own achievement on it is visible to me.

## Implementation Decisions

- **Completion is a terminal `topics.status` value.** Extend the existing
  `status` union (`seeded | active`) with `completed`. The reader and dashboard
  read this to switch affordances; the Routine gate reads it to stop.
- **Three completion mutations, one state.**
  - `completeCourse` — publish-secret-guarded (like `reportGeneration` /
    `replyToQuestion`), called by the teach skill; sets a Topic `completed`.
  - Owner **end-course** — authed, owner-only (through the existing owner gate);
    sets the caller's own Topic `completed`.
  - Owner **reopen** — authed, owner-only; sets a completed Topic back to
    `active`. (The teach skill can also reopen via the secret-guarded path if
    needed; owner is the primary reopener.)
  A Viewer is refused on all three server-side, regardless of UI.
- **The Routine gate hard-refuses a completed Topic.** `tryAcquireGeneration`
  returns not-acquired with a `completed` reason before any Frontier check, so
  the daily cron, the reader button (`requestNextLesson`), and setup
  (`requestSetup`) all no-op. This is the load-bearing "stop authoring"
  guarantee; hiding the reader button is convenience on top. The existing soft
  `caughtUp` state is untouched and still means "nothing new *for now*".
- **A new `certificates` relation**, one row per earned Certificate:
  `(topicId, userId, token, learnerName, courseTitle, lessonCount, issuedAt)`.
  `learnerName`, `courseTitle`, and `lessonCount` are **snapshots** frozen at
  issue. Keyed for two lookups: `by_token` (anonymous public read) and
  `by_topic_user` (dedup + "does this caller have one?"). The token is 256-bit
  random hex from Web Crypto, mirroring the Public-link token (ADR 0013), and is
  **distinct from** the Topic's `publicToken`.
- **Eligibility is derived; issuance is a claim.** A caller is *eligible* for a
  Topic when its `status` is `completed` **and** every non-superseded Lesson in
  the Topic appears in that caller's own completed Progress (the same
  non-superseded filtering the Frontier uses; the same per-caller Progress read
  as `capture.myProgress`). Because a Certificate must carry a **name** and none
  is stored on the account, the learner **claims** it: a `claimCertificate`
  mutation takes the display name, re-checks eligibility server-side, and mints
  idempotently (a second call returns the existing row — never a duplicate). A
  blank name falls back to the email's local-part. Before the claim, there is no
  row — only eligibility, exposed by a `myCertificate` query returning either the
  earned row or an eligibility flag.
- **An anonymous Certificate read seam**, `convex/certificates.ts`, queries only
  and authorized **by token, never by `getAuthUserId`** — the exact shape of
  `convex/public.ts`. Its public query returns an **explicit output allowlist**
  (learner name, course title, issue date, lesson count) so it can never leak the
  email or any Lesson content; a missing/invalid token returns uniform `null`.
- **A new public route `/certificate/[token]`** outside the `(app)` auth group
  (alongside `/share/[token]`, ADR 0012), rendering the Certificate from the
  token-authorized query. It carries a **print stylesheet**; a "Download" button
  calls `window.print()` for save-as-PDF. The same component renders the in-app
  "View certificate" view. `rel="noreferrer"` / no-referrer posture matches the
  Public-link route.
- **The celebration** is an in-app moment shown when `myCertificate` reports
  newly eligible-or-just-earned: a `canvas-confetti` burst plus a Tailwind/CSS
  card reveal, containing the name field that completes the claim. It is
  suppressed after first view via a per-Certificate marker in `localStorage`
  (same per-device pattern as the reader's seen-replies / Guest ticks), and it
  fires for whoever becomes eligible whenever they next load a completed course
  (covering a Viewer, or an owner absent when the teacher terminated).
- **Reader & dashboard affordances.** On a completed Topic the reader replaces
  `NextLessonButton` with a "View your certificate" control; the course chrome
  gains the owner's "Mark course complete" / "Reopen" actions (owner-only,
  absent for Viewers). The dashboard's existing `✓ Complete` marker links to the
  Certificate; the "Shared with me" cards show a Viewer's own completion +
  Certificate link.
- **Teach skill instructions.** Add a "Terminating a course" section to the teach
  skill (`SKILL.md`): judge against the Mission's "Success looks like"; call
  `completeCourse` when substantially met or the ZPD is exhausted; note that
  lifelong/open-ended missions may only ever end via the owner's manual action.

## Testing Decisions

- **Good tests assert external behavior at the Convex function seam** — not
  internals — in the style of `convex/public.test.ts`, `routine.test.ts`, and
  `capture.test.ts`: seed Users/Topics/Lessons/Progress with `t.run`, act as a
  caller with `withIdentity`, set `PUBLISH_SECRET` in `beforeAll`, and assert
  what each caller can and cannot do or see.
- **One load-bearing seam: the Convex function API**, exercised via `convexTest`.
  Covered:
  - **Completion state & gate** — `completeCourse` (secret-guarded) and owner
    end-course set `completed`; a Viewer/non-owner is refused; `reopen` returns
    to `active`. `tryAcquireGeneration` refuses a completed Topic (so
    `requestNextLesson` / `requestSetup` / `dailyFire` no-op), and resumes after
    reopen. Prior art: `routine.test.ts` gate/lock + secret tests.
  - **Certificate eligibility** — not eligible while the Topic is `active` even
    with all lessons done (buffer-of-one guard); not eligible when `completed`
    but a lesson is unmarked; eligible when `completed` + all non-superseded
    lessons in the caller's Progress; superseded lessons don't block eligibility.
  - **Claim & idempotency** — `claimCertificate` mints one row, snapshots
    name/title/lesson-count/date; a second call returns the same row (no
    duplicate); a claim while ineligible is refused; blank name → email
    local-part; owner and a Viewer each earn their own on the same Topic.
  - **Permanence across reopen** — a Certificate earned, then the Topic reopened
    and extended and re-completed, is unchanged and not re-minted.
  - **Anonymous public read** — `publicCertificate(token)` returns only the
    allowlisted fields for a valid token; a wrong/absent token returns `null`;
    the payload never includes the email or Lesson content. Prior art:
    `public.test.ts` token-only read tests.
- **No new frontend tests** — consistent with the repo (topic-sharing precedent).
  The celebration animation, `/certificate/[token]` page, owner controls, and
  dashboard/reader affordances are verified manually; the correctness that
  matters (who can terminate, who can earn, what the public link exposes) is
  enforced and tested at the Convex seam. Any trivial reader derivation reuses
  the existing pure `readerDerive.test.ts` seam.

## Out of Scope

- **A real user profile / display-name field.** The name is captured per
  Certificate at claim time and snapshotted; a reusable account-level display
  name is deferred.
- **Certificate-link on/off/regenerate controls.** The link is always-on in v1
  (low-sensitivity content). Revoke/regenerate can be layered on later, mirroring
  the Public-link controls.
- **Server-rendered or client-image (PNG) certificate downloads.** Download is
  browser print-to-PDF only.
- **Verifiable / signed credentials** (QR verification, a public registry,
  tamper-proofing). The token link is proof-by-possession, like the Public link.
- **A hard lesson-count cap or an upfront fixed syllabus.** Termination stays a
  judgment against the Mission's outcomes; the model remains emergent.
- **Per-Viewer Responses and Q&A.** Unchanged — a Viewer's earning rides on
  Progress only (which they already track). Guests remain write-less.
- **Notifications** when a course is completed or a Certificate is earned — it
  simply appears on the learner's next visit.
- **Multiple Certificates per (User, Topic)** (e.g. a new one each time a course
  is extended and re-finished). One immutable Certificate records the first
  completion.

## Further Notes

- The feature is mostly backend (a `completed` status value + gate refusal, three
  completion mutations, a `certificates` table with a claim + eligibility query,
  and a token-only public read seam) plus three UI surfaces (reader/dashboard
  affordances, the celebration, the public Certificate page) and one teach-skill
  doc change. It builds directly on two shipped patterns: the Routine gate
  (ADR 0008) and the Public-link capability token (ADR 0013).
- Live Convex queries mean the reader flips to the completed state and the
  celebration surfaces automatically when the Topic's `status` changes — no extra
  sync work.
- No prototype was needed; every design question resolved in the grilling session
  (see ADR 0015).
- Implementation issues live under `issues/` and are dependency-ordered: `01`
  (completion state + gate + teach-skill doc) and `02` (certificates backend)
  are the backbone; `03`–`05` (reader/dashboard affordances, celebration, public
  page) build on them.
