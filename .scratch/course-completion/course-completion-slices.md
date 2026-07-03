# Course completion & certificates — vertical slices

Tracer-bullet breakdown of [`PRD.md`](./PRD.md). Each slice cuts through every
layer (schema → Convex API → reader/UI → tests) and is demoable on its own.
Vocabulary: [`CONTEXT.md`](../../CONTEXT.md) (**Completion**, **Certificate**,
**Certificate link**). Decision: [ADR 0015](../../docs/adr/0015-course-completion-and-certificates.md).
Single load-bearing test seam: the Convex function API via `convexTest`
(mirroring `public.test.ts`, `routine.test.ts`, `capture.test.ts`); UI verified
manually, per repo norm.

> These slices re-cut the layered `issues/01`–`05` vertically for grab-and-go
> implementation. Same feature, same PRD, same ADR — pick whichever framing you
> build against.

---

## Slice 1 — Terminate a course & stop authoring

### What to build

An end-to-end **Completion** path. A Topic gains a terminal `status: "completed"`
value. The teach skill can declare a course finished (a publish-secret-guarded
`completeCourse`), and the **owner** can end their own course from the app and
reopen it later. A completed Topic is refused by the Routine's authoring gate, so
the daily cron, the reader button, and setup all no-op — the course provably
stops generating Lessons. The reader hides "Generate next lesson" on a completed
course. This slice delivers the "doesn't generate indefinitely" fix on its own,
with no certificate yet.

### Acceptance criteria

- [ ] `topics.status` accepts `completed` alongside `seeded | active` (still optional for the legacy row).
- [ ] `completeCourse(topicSlug)` — publish-secret-guarded (same guard as `reportGeneration`) — sets a Topic `completed`.
- [ ] An authed, owner-only end-course mutation sets the caller's own Topic `completed`; a Viewer/non-owner is refused server-side.
- [ ] An authed, owner-only reopen mutation returns a `completed` Topic to `active`.
- [ ] `tryAcquireGeneration` refuses a completed Topic (`reason: "completed"`) before the Frontier check, so `requestNextLesson`, `requestSetup`, and `dailyFire` no-op; authoring resumes after reopen. The soft `caughtUp` state is untouched.
- [ ] The reader shows "Mark course complete" (behind a confirmation) and, when completed, "Reopen" — both owner-only, absent for Viewers; the "Generate next lesson" affordance is gone on a completed course.
- [ ] The teach skill `SKILL.md` gains a "Terminating a course" section: judge against the Mission's "Success looks like"; call `completeCourse` when substantially met / the ZPD is exhausted; lifelong missions end only via the owner's manual action.
- [ ] Convex-seam tests: secret + owner completion set `completed`; Viewer refused; reopen restores; gate refuses when completed and resumes after reopen.

### Blocked by

- None — can start immediately. (Foundation for slices 2–4.)

---

## Slice 2 — Earn & view a certificate in-app

### What to build

The functional certificate path, end-to-end but plain (no confetti, no public
page). A `certificates` relation stores one immutable, snapshotted Certificate
per `(User, Topic)`. When a signed-in learner has a completed Topic **and** has
marked every non-superseded Lesson complete, they are *eligible*; they **claim**
the Certificate by supplying the name to print, which mints one row idempotently
(with a capability token) and shows it in a simple in-app Certificate view. Both
the owner and a shared **Viewer** can each earn their own; an anonymous **Guest**
cannot (no mutation exists for them).

### Acceptance criteria

- [ ] A `certificates` relation: `(topicId, userId, token, learnerName, courseTitle, lessonCount, issuedAt)`, indexed `by_token` and `by_topic_user`; name/title/count are snapshots frozen at issue.
- [ ] Eligibility is derived: `status === "completed"` **and** every non-superseded Lesson is in the caller's own completed Progress (same filters as the Frontier / `capture.myProgress`).
- [ ] `myCertificate(topicSlug)` (owner-or-Viewer gated) returns the caller's earned row, else an eligibility flag, else neither.
- [ ] `claimCertificate(topicSlug, name)` re-checks eligibility, mints one row with a fresh 256-bit hex token; a second call returns the same row (idempotent); an ineligible claim is refused; blank name → email local-part.
- [ ] A plain in-app affordance lets an eligible learner enter their name, claim, and view their Certificate; it appears for owner and Viewer alike, and on the dashboard the completed course links to "View certificate" (including a Viewer's own on a shared course).
- [ ] Permanence: reopening (slice 1) then re-completing does not re-mint or mutate an existing Certificate.
- [ ] Convex-seam tests: eligibility gating (active-but-done → no; completed-but-one-unmarked → no; completed + all done → yes; superseded don't block); claim idempotency + snapshots + blank-name fallback; owner and Viewer each earn their own; permanence across reopen.

### Blocked by

- Slice 1 (needs the `completed` state to reach eligibility).

---

## Slice 3 — Public certificate link + PDF download

### What to build

Make the earned Certificate shareable and downloadable. A token-only public read
seam (`convex/certificates.ts`, queries only, authorized by token like
`public.ts`) backs an anonymous `/certificate/[token]` page outside the `(app)`
auth group. Anyone with the link sees only the achievement — name, course title,
completion date, lesson count — and never the Lessons or the email. A "Download"
button prints the page to PDF via the browser, and the in-app view offers a "copy
public link" affordance.

### Acceptance criteria

- [ ] `publicCertificate(token)` returns an explicit output allowlist (learnerName, courseTitle, issuedAt, lessonCount) and nothing else; a missing/invalid token returns uniform `null`.
- [ ] `/certificate/[token]` renders anonymously (no account) from that query, reusing the ungated `/share/[token]` auth-group carve-out and its `rel="noreferrer"`/no-referrer posture.
- [ ] The page shows a clean, brand-consistent ("My Course") Certificate with the snapshot name, course title, completion date, and lesson count — no Lessons/Resources/Q&A/email.
- [ ] A "Download" button calls `window.print()`; a print stylesheet yields a single tidy page (no app chrome) for save-as-PDF.
- [ ] A bad token renders a plain, uniform not-found (no existence signal).
- [ ] The in-app "View certificate" (from slice 2) exposes a copy-public-link action and reuses the same Certificate component so in-app and public views can't drift.
- [ ] Convex-seam tests (in slice 2's suite or adjacent): public read returns only allowlisted fields; wrong/absent token → `null`.

### Blocked by

- Slice 2 (needs the Certificate row + token).

---

## Slice 4 — Completion celebration

### What to build

The rewarding moment. When a learner becomes eligible, the reader celebrates with
a `canvas-confetti` burst and a Tailwind/CSS certificate-card reveal, folding the
name field and claim from slice 2's plain prompt into the celebration and leading
into the view/download CTA. It fires once per Certificate (suppressed afterward
via a per-device `localStorage` marker) and for whoever becomes eligible whenever
they next load a completed course (an owner absent at termination, or a Viewer who
had already finished).

### Acceptance criteria

- [ ] Add `canvas-confetti` (small, framework-free); the reveal uses the repo's existing Tailwind `animate-*` idiom (scale-in / fade / shine).
- [ ] The celebration shows when `myCertificate` reports the caller newly eligible or just-earned on the viewed course; its name field completes `claimCertificate`, then it transitions to a "View / Download certificate" CTA.
- [ ] It fires once — after first view it's suppressed via a per-Certificate `localStorage` marker; revisiting a completed lesson doesn't re-trigger it.
- [ ] It fires for whoever becomes eligible on their next load (owner or Viewer), not only at the instant of the final "Mark complete".
- [ ] Dismissing without naming still lets the learner claim later from the "View certificate" affordance (slice 2/3).
- [ ] Respects `prefers-reduced-motion` (skip/soften); the confetti is a one-shot burst, not a loop.

### Blocked by

- Slice 2 (the claim flow it wraps). Soft-uses slice 3's download CTA.
