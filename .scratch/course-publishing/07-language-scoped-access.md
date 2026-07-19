# course-publishing/07: Language-scoped access & the user content-language

**Status:** done (2026-07-19, `/grilling` — rescoped mid-session)
**Claimed:** session 4be664b1 (2026-07-19)
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

## Resolution (2026-07-19)

**The ticket was rescoped mid-grilling.** Its chartered premise — a new per-user
**content-language** setting that *gates access*, with cross-language courses shown **disabled** in
the catalogue — was found **obsolete**. The user pointed out (and the codebase confirms) that
**course-content translation already works and is live**: the `translations` table, `convex/translate.ts`,
and the reader's per-Edition language switcher already let any member read a course's lessons in any
translated Edition they have a grant to. Access is already **per-Edition** `(topic, lang)` via the four
existing grants plus the new `enrollments` grant (ticket 01). There is therefore **no missing
access-scoping layer** for content-language to add — the elaborate `users.contentLang` + disabled-card
machinery would have solved a non-problem.

### Dropped (do NOT build)

The following, explored and then discarded once the premise collapsed:

- **No `users.contentLang` field.** No new per-user content-language setting, no default, no migration,
  no `setContentLang` mutation, no settings/catalogue picker for it.
- **No language-scoped *access rule*.** Content-language does not gate access or self-enroll.
- **No "disabled / greyed-out" cross-language catalogue cards** (neither free nor paid), no
  "not available in your language" locked state, no request-translation affordance.
- **No content-language switching rules / grandfathering logic** — moot without the setting.

(These correspond to the ticket's original sub-questions 1–4 and the Q1–Q6 exploration in-session.)

### What survives — the thin enroll-language question

Ticket 01 fixed enrollment as **per-Edition** `{ userId, topicId, lang }`. The one genuine open
question it left: **when a member self-enrolls a free published course from the catalogue, which
language Edition does the one-click Join target?** Resolved:

1. **Per-card language pick, default English.** The catalogue card carries a **small language control**
   defaulting to **English** (the always-present source Edition, `lang != "en"` are the translation rows)
   and listing the course's **available translated languages**. **Join self-enrolls the *selected*
   Edition** → one `enrollments` row `{ userId, topicId, lang }`.
2. **Want another language? Join again in it.** Multi-language access is additive: each Join is a
   separate per-Edition grant, **idempotent** per `(user, topic, lang)`, **permanent/grandfathered** —
   all exactly as ticket 01 / ADR 0023 already specify. **No change to the enroll data model.**
3. **Every published course is joinable in at least English** — no locked/disabled cards. Translated
   courses simply offer more entries in the picker.
4. **Gated by the tenant `translations` flag.** Flag **off** ⟹ the card shows **no language control**
   (English-only one-click Join). Flag **on** ⟹ the language control appears with the available
   translations. (Existing tenants default the flag `true`.)

### UI

**No `/prototype` pass** (user decision): under the thin scope the entire UI is a **Join button + a
language dropdown** on a catalogue card, and the hosting surface doesn't exist yet. **Spec'd in words
for [ticket 05](05-tenant-catalogue-surface.md) to render:** on each catalogue card, when the tenant
`translations` flag is on, a compact language selector (native names from `convex/languages.ts`
`LANGUAGES`, English first/default) sits beside the **Join** action; selecting a language and clicking
Join self-enrolls that Edition. Flag off → the selector is absent.

### Per-Edition model — layers cleanly

Confirmed (ticket sub-question 4): pricing (`listings`), `shares`, `publicLinks`, and `entitlements`
stay per-Edition and untouched; an owner may still share/sell any single Edition across languages. The
thin resolution adds only a **read-time language choice on the Join affordance** — no new grant type,
no resolver change beyond ticket 01's `enrolled` branch.

### Spun off — chrome / app-UI i18n is now a wanted, separate effort

The user's actual current priority surfaced here: **translating the app UI itself** (chrome — buttons,
menus, nav, the reader frame; no i18n framework exists in the app today, English-only). This is the
item the map already parked as *"a candidate for its own wayfinder effort/map, not this one"*
(`00-course-publishing-map.md` "Not yet specified"). It is **explicitly out of scope for this ticket
and this map** and is being promoted to **its own wayfinder effort** — see the map's Decisions-so-far
note. This ticket owned only the (now-obsolete) content-language access layer.
