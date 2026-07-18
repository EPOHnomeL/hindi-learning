# course-publishing/07: Language-scoped access & the user content-language

**Status:** open
**Depends on:** 01
**Labels:** wayfinder:grilling

Child of [Course publishing map](00-course-publishing-map.md).

Surfaced resolving [ticket 01](01-model-self-enroll-grant.md) (2026-07-18): the user wants course
access scoped by a user's chosen **content language**. Split from the enroll mechanic (per-language
enrollment) and from full app-UI translation (a separate future effort) — this ticket is the
**access-policy + UX layer** in between.

## Question

Gated throughout by the tenant **`translations`** flag (whitelabel issue 04) — when a tenant branch
has translations **off**, none of this applies: English-only, no picker, no greying-out, self-enroll
stays simple. Decide, via `/grilling` (+ a `/prototype` pass for the UI, per the user's "make an
intuitive UI" ask):

1. **The user content-language setting** — a new per-user field (none exists today; `users` carries
   no language). What are the allowed values, the default, and where it's set. Note the user's
   distinction: the **app-UI language** (English for now — full app translation is a separate effort)
   and the **content/enroll language** are *two different settings*; this ticket owns only the
   content-language.
2. **The access rule** — a member may access / self-enroll in a course only in an Edition matching
   their content language. Courses with **no Edition in that language** appear in the catalogue
   **disabled** (visible-but-locked, so the learner knows it exists but can't enter). Pin exactly
   what "disabled" permits (see it, see why, maybe request it?) vs forbids.
3. **Switching language** — can a member change their content language, and what happens to courses
   they already enrolled in under the old language (grandfathered per ticket 01? hidden? still
   listed)?
4. **Interaction with the existing per-Edition model** — pricing, shares, public links, and
   entitlements are already per-Edition/language; confirm this policy layers cleanly over them and
   doesn't contradict an owner sharing across languages.
5. **The UI** — an intuitive presentation of: choosing/switching content language, the disabled
   cross-language course cards, and (for later) the app-language-vs-content-language distinction.
   `/prototype` the catalogue card states and the language control.

Resolve, comment, close, add a Decisions-so-far line to the map. Feeds the catalogue surface
([ticket 05](05-tenant-catalogue-surface.md)) and the PRD ([ticket 06](06-prd-and-issue-breakdown.md)).
