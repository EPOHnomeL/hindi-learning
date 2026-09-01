---
type: task
blocked_by: []
---

# First-open welcome panel in the reader (signed-in + Public link)

## Question

## Why

A new person's first contact with a course is a lesson — either they open one for
the first time in the app, or they arrive cold on a Public link. In both cases the
reader drops them straight into lesson content with no orientation: no idea what
the course is for, how long it is, where they are in it, or where "home" is.

The existing empty-state work doesn't cover this. `EmptyLibrary`
([Dashboard.tsx:655](../../../../src/app/_components/Dashboard.tsx#L655)) only fires
for a signed-in learner who owns nothing *and* can't author — a person who opens a
shared or purchased course never sees it, and a Guest on a Public link never sees
the dashboard at all. The Guest reader's only orientation today is the course title
in the sidebar and the tenant lockup linking to `/`
([PublicReader.tsx:165-186](../../../../src/app/_components/PublicReader.tsx#L165-L186)).

Welcome them once, on first open, with enough to decide to continue: what this
course is, how big it is, and the next lesson to click.

## Scope

- A `Welcome` panel component, rendered by both reader shells:
  - signed-in — [CourseShell.tsx](../../../../src/app/_components/CourseShell.tsx)
  - Guest / Public link — [PublicReader.tsx](../../../../src/app/_components/PublicReader.tsx)
- Panel content:
  - **Course name** — `course.title` (the served Edition's title).
  - **Lesson count** — `course.lessons.length`.
  - **Mission excerpt** — the first ~2 lines of the Edition mission, truncated.
  - **Next lesson** — the lowest-`seq` lesson not yet completed (lesson 1 for a
    genuinely new person), as the panel's primary "Continue" action, deep-linking
    to `${base}/lessons/${key}`.
  - **Tenant portal link** — the tenant's front door (e.g.
    `ywampotch.my-course.app`), so a Guest can reach the brand's home. Reuse the
    `Brand` → `/` lockup pattern already in
    [PublicReader.tsx:168](../../../../src/app/_components/PublicReader.tsx#L168);
    emit an absolute tenant URL when the reader is being served from a different
    host than the course's tenant, otherwise keep it relative.
- Backend: add `mission` to the `publicCourse` output allowlist
  ([public.ts:79-90](../../../../convex/public.ts#L79-L90)) — it is deliberately an
  explicit allowlist, so the Guest payload can't carry the field until it's listed.
  Serve the **Edition-translated** mission with English fallback, i.e. the
  `await ed.mission()` accessor already used at
  [reader.ts:188](../../../../convex/content/reader.ts#L188) — not the raw
  `topics.mission`.
- Trigger — show the panel **only** on a first open:
  - Guest: no `progress` rows for that token's course (the guest payload already
    carries `progress` with `opened` / `completed` —
    [public.ts:100-102](../../../../convex/public.ts#L100-L102)), plus the per-device
    `completed` set the reader already loads
    ([PublicReader.tsx:74-77](../../../../src/app/_components/PublicReader.tsx#L74-L77)).
  - Signed-in: no `opened`/`completed` progress for that course.
  - Server-side progress is the trigger of record so the welcome doesn't reappear
    on a second device; any local flag is a same-session dedupe only, keyed
    `hindi:*` so sign-out sweeps it
    ([accountLocalState.ts](../../../../src/app/_components/accountLocalState.ts)).
- Dismissible, and never blocking: the lesson stays reachable behind/below it.
- All copy through `useTranslations` with keys in every Edition locale (the
  reader is already fully i18n'd; see the `Dashboard`/`Reader` namespaces).

## Out of scope

- **Welcome email on sign-up.** Considered and dropped — this welcome is for
  someone *opening a lesson*, not creating an account. The invite-email seam
  (`convex/email.ts`, `convex/inviteEmail.ts`) stays untouched.
- A dashboard-wide welcome or product tour — [Improve onboarding flow](01-improve-onboarding-flow.md) owns the broader onboarding flow.
- Real per-lesson progress semantics beyond the existing `opened`/`completed`
  rows — [Progress feature](../../learning-experience/tickets/03-progress-feature.md) owns the Progress feature. This issue consumes what exists and must
  not fork a second progress model.
- Paid/preview upsell copy — the Paygate ([Paygate.tsx](../../../../src/app/_components/Paygate.tsx))
  already handles locked Editions; the welcome panel must not duplicate it.

## Acceptance criteria

- [x] A signed-in learner opening their first lesson of a course sees the welcome
      panel showing the course name, its lesson count, a mission excerpt, and a
      Continue action pointing at lesson 1.
- [x] A Guest arriving on a Public link sees the same panel, with a link to the
      tenant portal that lands on that tenant's front door.
- [x] The Continue action targets the lowest-`seq` **not-completed** lesson, so a
      returning person with partial progress is pointed at their next lesson, not
      back at lesson 1.
- [x] The panel does not appear on a second open of the same course — including
      from a different device/browser for a signed-in learner.
- [x] A course with no mission renders the panel without an empty gap or the word
      "null"; a course with zero published lessons shows no Continue action.
- [x] The mission shown on a non-English Edition is that Edition's translated
      mission, falling back to English when the translation isn't ready.
- [x] `publicCourse` returns `mission` and no other newly-exposed field.
- [x] The panel is dismissible and the lesson is readable without dismissing it.

## Tests (TDD, `convexTest` seam)

1. `publicCourse` returns the Edition mission for a translated Edition and the
   English mission as fallback; the returns validator rejects any other new field.
2. `publicCourse` on a course with `mission: undefined` returns `null`, not a throw.
3. Next-lesson selection is a pure helper (alongside
   [readerDerive.ts](../../../../src/app/_components/readerDerive.ts), unit-tested
   like [readerDerive.test.ts](../../../../src/app/_components/readerDerive.test.ts)):
   empty progress → lesson 1; lessons 1–2 completed → lesson 3; all completed →
   no Continue action; out-of-order `seq` → still lowest not-completed.
4. First-open predicate: no progress rows → show; any `opened` row for that course
   → hide; a `completed` row on another course → still show for this one.
5. Zero-lesson course → panel renders, no Continue action (mirrors the existing
   `noLessonsPublished` path at
   [PublicReader.tsx:190](../../../../src/app/_components/PublicReader.tsx#L190)).
6. Tenant-portal link: same host as the course's tenant → relative `/`; different
   host → absolute `https://<slug>.my-course.app/`.

## Notes

- Requirements came from the user directly (2026-07-28): show the next lesson, the
  course name, the lesson count, a bit of the mission "that they can then
  continue", and a tenant-portal link — scoped to "only for users opening a lesson
  for the first time or public links".
- Open questions for triage:
  - Modal/overlay vs. an inline card above the lesson body? Inline is the lazier
    build and can't trap a Guest behind a dialog — proposed default.
  - Should a signed-in learner opening their *very first lesson ever* (any course)
    get extra product-level framing, or is the per-course panel enough? Assumed
    per-course only; the account-level story belongs to [Improve onboarding flow](01-improve-onboarding-flow.md).
- **The mission excerpt is prose only — headings are dropped, not flattened**
  (2026-08-01, from the user seeing it live on `prophetic-school`). Missions are
  authored markdown that typically opens with `# Mission: <course name> — …` and then
  a paragraph. `missionExcerpt` stripped the marker and collapsed all whitespace to
  one line, fusing the heading onto the sentence beneath it with no punctuation —
  "…hearing God's voice Why I want a living, day-to-day walk…". That heading is also
  usually the course title restated, which the panel already renders in its `<h2>`
  directly above the excerpt. So `HEADING_LINE` drops whole heading lines and the
  excerpt is cut from the prose; a mission that is *nothing* but headings falls back
  to their words, keeping the "no empty gap" criterion above. Fixed in
  [welcomeDerive.ts](../../../../src/app/_components/welcomeDerive.ts) with unit
  tests; the mission text itself was never wrong, the derivation was.
- `mission` is only ever *drafted* by the Routine and published via
  `publish.publishMission` ([publish.ts:53](../../../../convex/content/publish.ts#L53)),
  so a freshly seeded course will legitimately have none for a while — the
  no-mission path is the common case early on, not an edge case.

## Done when

The Welcome panel renders once on first open in both reader shells with the specced content, and its dismissal is remembered for a signed-in learner and for a Guest alike.

## Answer

**Already built — this ticket was open on stale context.** Closed 2026-08-01 from
[ywampotch-launch 08](../../ywampotch-launch/tickets/08-fix-known-stale-docs-and-tracker.md),
which found it (as GitHub #113) among four facts the tracker still asserted about a
world that no longer exists.

Evidence in the tree today:

- `src/app/_components/Welcome.tsx` — the panel, on the shared `Dialog`.
- `src/app/_components/welcomeDerive.ts` (+ `.test.ts`) — the pure seam:
  `missionExcerpt`, `latchFirstOpen`, `guestProgress`.
- Rendered by **both** shells — `CourseShell.tsx:355` (signed-in) and
  `PublicReader.tsx:274` (Guest / Public link).
- `mission` is on the `publicCourse` allowlist (`convex/public.ts:94`), served as
  the Edition-translated `await ed.mission()` (`convex/public.ts:200`) — exactly as
  specced, and nothing else newly exposed.

**Two deviations from the spec, both deliberate and both recorded in code:**

1. **Modal, not the inline card the spec proposed as its "lazier default"** — the
   user's call, `da02161`. The spec's objection to a modal was that it could trap a
   Guest behind a dialog; `Dialog` is the native `<dialog>`, so Esc, backdrop and
   the X all close it through one path.
2. **Dismissal is per-tab-session (`sessionStorage`), not server-persisted** for
   *either* audience — so the spec's "remembered for a signed-in learner and for a
   Guest alike" is met by the *trigger* rather than by the dismissal: opening a
   lesson writes an `opened` progress row, and `latchFirstOpen` reads server
   progress, so the panel does not return on a second visit or a second device. The
   latch exists because progress is a live query and an unlatched
   `progress.length === 0` tore the panel away mid-sentence.

**It has since grown past this spec.** [ywampotch-launch 17](../../ywampotch-launch/tickets/17-payment-complete-moment-on-card-return.md)
(`f8b55c3`) made the purchase acknowledgement a *variant* of this same panel rather
than a competing surface — `welcomeVariant()` picks `purchase-complete` /
`purchase-confirming` / `first-open` / none, so the generic welcome can never also
appear to a buyer. Anyone touching this panel must read that ticket too.

**Walked in a browser 2026-08-01** — the earlier close was read off the code; this
is the walk it owed. Local dev build (Chrome via Playwright) pointed at the **prod**
Convex deployment, so the panel rendered the live `prophetic-school` course, its 56
lessons and its real mission; Guest queries only, nothing written. Every acceptance
criterion above is ticked on that evidence:

- Panel renders on a Public link with the course name, "56 lessons", the mission
  excerpt, `Start Lesson 1` → `…/lessons/0001-learning-to-listen`, and the portal
  link (`http://ywampotch.localhost:3001/` locally — `tenantHomeHref`'s local
  analogue of `https://ywampotch.my-course.app/`).
- Dismissible, and the lesson is readable *behind* it — 8,075 characters of lesson
  body present both before and after dismissal, so the modal never blocks the read.
- Does not return on a second open in the same visit; a `/references/glossary` deep
  link gets no panel at all.
- The excerpt reads as prose — see the mission-excerpt note above; this walk is what
  caught it.

**The signed-in half was not walked** — it needs real credentials on prod, which this
session had no business using. It rests on the shared component and the shared
derivation (one `Welcome`, one `latchFirstOpen`, both shells), plus unit tests. The
panel's *purchase* variants likewise remain on ywampotch-launch's owed operator-walk
list.

<!-- Migrated 2026-07-30 from GitHub issue #113 (filed 2026-07-28), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->

---

## Context folded from the retired `welcome` map (2026-08-01)

<!-- was .plan/maps/onboarding/tickets/02-first-open-welcome-panel.md; that single-ticket map was consolidated into onboarding -->

- **The gap is specific:** both reader shells drop a newcomer straight into lesson content
  with no orientation. `EmptyLibrary` does not cover it — it only fires for a signed-in
  learner who owns nothing *and* cannot author, so someone opening a shared or purchased
  course never sees it, and a Guest never sees the dashboard at all.
- **Two shells, one component:** `CourseShell.tsx` (signed-in) and `PublicReader.tsx`
  (Guest / Public link). A Welcome that only appears for signed-in learners misses the colder
  of the two audiences.
- **"Once" is the hard part, and it differs per audience.** A signed-in learner's dismissal
  can persist server-side; a Guest has no account, so it has to be local. Get both right or
  the panel becomes an every-visit nag.
- Content is drawn from what already exists — the served Edition's title, lesson count, and
  the next lesson — so this needs no authoring and no new content pipeline.
- **Distinct from its neighbours:**
  [Improve onboarding flow](01-improve-onboarding-flow.md) is the whole first-run flow, and
  [Scope the onboarding & marketing video](../../media-generation/tickets/03-scope-onboarding-and-marketing-video.md)
  is the pre-signup pitch. This is the moment *after* they are already in a course.
- Skills: `/tdd`, `/prototype` (a panel is worth seeing before it is specced further),
  `/run` (check it on a real Public link, not just signed in).
- **Fog:** whitelabel treatment — a tenant's Welcome panel arguably needs that tenant's voice,
  not just its palette. Not yet sharp.
- **Out of scope:** the dashboard empty state (`EmptyLibrary`) — already shipped, different
  audience.
