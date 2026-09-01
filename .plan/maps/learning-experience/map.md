# Learning experience: how a course reads, and how it teaches

<!-- INDEX, not a store. Each unit lives in its own ticket; this map gists and
     links. Load once per session, zoom into tickets on demand. -->

## Destination

Everything a **learner** meets lives in one place: the way in, the reader they spend
their time in, the device they hold it on, and the pedagogy that decides what the
course does to them.

Chartered 2026-09-01 by gathering the learner-facing work scattered across five feature
maps (`pedagogy`, `reader-experience`, `onboarding`, `mobile-reader-todos`,
`installable-app`), during the consolidation that took `.plan` from 33 map directories
to 7 active maps.

Scope is fixed by one test: **would a learner notice this?** The onboarding path, the
reader, progress, the installed app and teaching method all pass. What an author does
to a course is `authoring`; what it costs is `distribution`.

## Notes

- **This map carries build tickets, deliberately.** wayfinder's default is
  plan-don't-do, and this is the Notes override the convention requires. Tickets
  [01](tickets/01-teach-back-in-the-teach-skill.md),
  [04](tickets/04-not-found-edge-cases.md),
  [06](tickets/06-dashboard-empty-state-ignores-catalogue.md) are execution;
  [05](tickets/05-improve-onboarding-flow.md),
  [07](tickets/07-walk-the-bottom-nav.md) and
  [08](tickets/08-the-ios-instruction-sheet.md) are **walks**, which no session can fake
  and which resolve on what was actually seen. Only
  [02](tickets/02-interactive-ai-chat-substrate.md) and
  [03](tickets/03-progress-feature.md) are decisions.
- **Verify before reasoning.** Checked in the tree on 2026-09-01: there is **no
  `not-found.tsx` anywhere under `src/app`** (04 is real), `emptyLibrary` at
  `src/app/_components/Dashboard.tsx:128` still reads only the four ownership lists
  plus `amAllowlisted` and never the catalogue (06 is real), and the schema carries no
  chat, thread or live-session table (02 is unbuilt). Re-check before acting: the
  pedagogy tickets that came here were written 2026-07-15 and the onboarding ones
  2026-08-06.
- **The iOS sheet is built and its gate is not walked.** Ticket
  [08](tickets/08-the-ios-instruction-sheet.md) shipped in commit `2c3dd01`
  (`isIosBrowser` in `installPromptDerive.ts`, the Share glyph and two steps in
  `InstallSheet.tsx`) and was walked in emulated-iPhone Chromium. It stays open for
  one reason: **its release gate needs a real iPhone**, a Google sign-in and a password
  sign-in completed inside the installed app, because an installed iOS app has its own
  cookie jar and the OAuth return may complete in Safari with no error shown. That
  walk is a human's. Do not close it from a code read.
- **`installable-app` never had a `map.md`**, only a `spec.md` and its tickets, which
  is why ticket 04 there was **invisible to every frontier** for the whole effort.
  Found and recorded 2026-09-01; a minimal map was written for that closed effort so
  its record is whole. The lesson generalises: a ticket without a map above it is not
  tracked work.
- **ADR 0001 is the wall ticket 02 runs into.** No LLM in the web app's serving path.
  Chat is a new interaction plane and a new serving path, and 02 has to either amend
  that ADR or argue that a Convex action is not "the web app". Per CLAUDE.md a stale
  ADR gets a **superseding** ADR; it never gets rewritten.
- Skills worth calling here: `grilling` for 02 and 03, `tdd` for 04 and 06 (06 already
  names the regression test it wants, mirroring how `pending` is covered), `run` for
  the three walks, and `domain-modeling` for whatever 02 decides to call itself.

## Where the tickets came from

<!-- provenance, not status: chartr derives status from the ticket files -->

| # | Subject | Came from |
|---|---|---|
| 01 | Teach-back in the teach skill | `pedagogy/03` |
| 02 | Interactive AI chat substrate | `pedagogy/04` |
| 03 | Progress feature | `reader-experience/01` |
| 04 | Not-found and deep-link edge cases | `reader-experience/03` |
| 05 | Improve the onboarding flow (a walk) | `onboarding/01` |
| 06 | Dashboard empty state contradicts the catalogue | `onboarding/03` |
| 07 | Walk the mobile bottom nav at phone width | `mobile-reader-todos/04` |
| 08 | The iOS instruction sheet | `installable-app/04` |

Renumbering was forced: `blocked_by` is map-local and the numbers collided across the
donor maps. The old numbers remain those tickets' identity in their donor maps'
history, so **do not reuse them here**. Each moved ticket carries an HTML comment
footer naming where it came from, including the two whose `blocked_by` edge pointed at
a resolved ticket that stayed behind.

## The dependency graph

**No edges.** All eight tickets are on the frontier, which is unusual and worth stating
rather than leaving as an absence: the learner surface is wide rather than deep, and
the three walks in particular are independent of everything.

```
frontier (8):  01 02 03 04 05 06 07 08
blocked   (0):  none
```

Two orderings are worth respecting even though neither is a `blocked_by`:

- **05 before anything cut from 05.** Ticket 05 is observation, not building: walk a
  cold sign-up on prod, on a tenant subdomain, on a phone, and write down where a
  person stalls. Nothing downstream of it can be ticketed until that list exists.
- **06 is inside 05's territory and does not wait for it.** It is a named, verified
  defect with a file and a line number, so it ships on its own.

## Decisions so far

<!-- one line per resolved ticket -->

_(none yet: chartered 2026-09-01.)_

## Not yet specified

<!-- in-scope fog: real, but not sharp enough to ticket. Four of these were tickets
     until 2026-09-01; their full bodies are kept at assets/deferred/ so re-cutting one
     costs a `git mv` and a number. -->

- **Learning-pyramid phases**, the organising frame that would tie the modalities
  together (read, audio-visual, demonstration, discussion, practice, teach others) and
  the undecided fork underneath it: are phases *structural* (schema, per-concept phase
  state, reader UI) or *policy* (authoring rules in the teach skill and nothing else)?
  Deferred because it is a frame for features that mostly do not exist, and because the
  pyramid's retention percentages are pop-science: any version of this has to be framed
  on the modalities, not the numbers. Body:
  [assets/deferred/learning-pyramid-phases.md](assets/deferred/learning-pyramid-phases.md).
  Entangled with the course-modules fog on
  [authoring](../authoring/map.md).
- **Experiential learning**, making real-world assignments and report-back first class
  rather than delegating them outward ("go find a community"). Body:
  [assets/deferred/experiential-learning.md](assets/deferred/experiential-learning.md).
  `clears-with: 01`
- **Diagnostic grilling mode and a "teach me that" handoff**, bringing the
  `grill-my-knowledge` skill's interview into the app so the loop finds the edge of a
  learner's understanding deliberately instead of inferring it from quiz Responses. Its
  own ticket said "deferred, not yet grilled or PRD'd", and it collides with ADR 0001
  in the same place 02 does. Body:
  [assets/deferred/diagnostic-mode.md](assets/deferred/diagnostic-mode.md).
  `clears-with: 02`
- **A live, host-led group quiz** (Kahoot-shaped: join code, big-screen host view, live
  leaderboard) for demoing a course to a room. The rare feature where Convex's
  reactivity does half the work, and the rare one needing no LLM at all. No committed
  intent. Body:
  [assets/deferred/live-group-quiz.md](assets/deferred/live-group-quiz.md).
- **What Progress means once a concept has more than one modality.** If a concept can be
  read, discussed and taught back, "complete" stops being one bit. Cannot be phrased
  sharply until 03 settles what Progress is today.
  `clears-with: 03`

## Out of scope

- **Authoring, editing and media**: `authoring`.
- **Checkout, pricing and redemption**: `distribution`.
- **Repeat sign-in friction and session lifetime**:
  [technical-foundation/08](../technical-foundation/tickets/08-review-session-management.md),
  with password recovery at
  [technical-foundation/21](../technical-foundation/tickets/21-forgot-password-flow.md).
- **Offline lesson content**, which is a bearer-URL and lease question, not a reader
  one: [technical-foundation/05](../technical-foundation/tickets/05-offline-lesson-content-under-a-lease.md).
- **Which surfaces are clunky and why**, as an evidence question:
  [ui-overhaul](../ui-overhaul/map.md) owns the PostHog rail and the ranking that comes
  out of it.
- Cohorts, multi-learner features and persistent player accounts (carried over from the
  deferred pedagogy scope).
