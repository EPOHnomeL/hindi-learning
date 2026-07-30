---
type: grilling
blocked_by: [04]
---

# Catalogue (marketplace) localisation spec

## Question

Spec how the **course catalogue** localises. It has two halves that ride different languages —
name the seam and decide both:

- **Card frame strings** (app-language) — "Enroll", "Free", "Continue", filter/sort labels, empty
  states. These key off the app-language via the layer chosen in 04.
- **Card title + mission** (content-language) — the catalogue query today returns only
  source-language title/mission. Translated title/mission **already exist** in the `translations`
  table (`kind: "title"` / `kind: "mission"`), so this is a query join, not new translation.
  **This absorbs course-publishing ticket 05's parked follow-up** — cross-referenced there.

Decide:

- **Which language drives a card's title + mission** — the app-language as a browse default, a
  dedicated catalogue content-language filter, or the viewer's held-Edition language? Name the rule
  and how it interacts with the app-language.
- **The catalogue query change** — how the catalogue query joins `translations` for the chosen
  language, with English source fallback when a translation is absent.
- **Guest vs. signed-in** behaviour on the catalogue (chrome is not access-controlled).

Output: a spec for the localised catalogue covering both halves. Depends on 04 for the frame-string
layer.

## Done when

Both language axes are specced — the rule for which language drives card title + mission, the
`translations` query join with English fallback, and the guest-vs-signed-in behaviour — ready to hand
to a downstream build.

## Answer

Resolved 2026-07-20 (grilling session, db93fffc). Grilled the two genuine forks one at a time; the rest
resolved from locked upstream facts (04) and already-shipped design (course-publishing 05, `AppGate`).
Both halves specced; the query half is a join over two existing-shaped helpers, not a new translation
pipeline (ponytail).

**The seam — one surface, two language axes** (the founding premise, map §Notes):

| Axis | What it covers | Driven by | Layer (locked, 04) |
| --- | --- | --- | --- |
| **Frame strings** | "Join now", "Free", "Premium", "Continue", "Open", filter chips (All/Free/Premium/My courses), state badges (Joined/Purchased), header ("Browse courses", "← My courses"), empty state | **app-language** | `next-intl`, cookie-resolved |
| **Card title + mission** | the course's own name and one-line mission on each card | **app-language by default, per-card selector overrides**, English source fallback | `translations` table join |

**Half 1 — frame strings (app-language).** Plain `next-intl` message keys (04), keyed off the active
app-language. 06 does not own the key set — the inventory + key convention is ticket 05's job (resolved in
parallel): keys are `next-intl` nested namespaces by surface, and the catalogue's namespace is
**`Catalogue`**. Frame strings live under `Catalogue.*` in `en.json` (e.g. `Catalogue.filter.all`,
`Catalogue.badge.joined`, `Catalogue.action.join`, `Catalogue.empty.title`) — exact leaf keys are 05's
one-shot sweep, not enumerated here.

**Half 2 — card title + mission (content-language). Rule (grilled): the active app-language drives each
card's title + mission by default; the existing per-card language selector overrides it; English source is
the fallback whenever the chosen language has no translation.**

- **Default** — a card renders title + mission in the learner's active app-language; the query joins
  `translations` for that language and falls back to the English source (`topics.title` / `topics.mission`)
  when no row exists. The fallback is per-card, silent, and expected (not an error): the app-language
  offer-set (5 `messages/*.json`, per 04) and a course's translation set are independent, so a
  Spanish-chrome learner sees English titles on any course not translated to Spanish.
- **Override** — the per-card language selector shipped by course-publishing 05 (globe + native names,
  present only when the tenant `translations` flag is on **and** the course has > 1 Edition) now drives
  that card's displayed title + mission too, not just which Edition Join/Buy grants. Picking a language
  flips the card's text and the Join/Buy target together. **This is exactly course-publishing 05's parked
  deferral, now built here.**
- **Selector default (grilled, refines 05)** — when present it defaults to the **app-language if the
  course has that Edition, else English**, so displayed text and the Join/Buy target agree at rest. (05's
  flat "English default" is superseded: text and action must not disagree until the learner touches it.)
- **No selector** (flag off, or single-Edition course) ⟹ title + mission = app-language with English
  fallback, which for a single-Edition English-only course is simply English. No control shown.

**Coherence note:** Edition existence and title/mission-translation-row existence are the same event — the
translate run that produces an Edition also writes its `kind:"title"`/`kind:"mission"` rows. So "the course
has an `es` Edition" ⟺ "`es` title/mission rows exist", and the default rule never lands text and selector
on different languages.

**The query change (convex — spec for the downstream build).** The join is trivial and mirrors shipped code:

- `translatedTitle(ctx, topicId, lang, sourceTitle)` (`convex/lib.ts:439`) **already** joins `translations`
  (`by_topic_lang_kind_key`, `kind:"title"`, `key:""`) with English fallback and short-circuits `SOURCE_LANG`
  to the source with no query. Reuse it verbatim.
- Add a mirror **`translatedMission(ctx, topicId, lang, sourceMission)`** — identical shape, `kind:"mission"`,
  `key:""`, `text` payload, `topics.mission` as the fallback. (Today `market.ts`'s `myPurchases` returns
  `topic.mission` raw — the un-joined source; the catalogue is the first place mission is localised.)
- The catalogue query (built by the downstream PRD, **not** in this spec ticket) resolves per card a
  `displayLang` = the selector pick when the learner has touched it, else the active app-language; then
  `title = translatedTitle(…, displayLang, topic.title)` and `mission = translatedMission(…, displayLang, topic.mission)`.
  A `.map` over the already-loaded card list calling two O(1)-indexed helpers — no `convex/translate.ts`
  call, no new pipeline.
- **App-language is consumed as an abstract query input** — the *concept* ticket 03 resolves (03 landed it as
  the cookie, synced from a `userPrefs` table; a Convex query can't read the cookie, so the client passes the
  active language as an arg). 06 does not decide where it is stored; the catalogue query reads the same
  resolved active language the rest of the chrome uses. Nothing here re-decides 03.

**Guest vs. signed-in.** Resolved from fact, not grilled. The catalogue lives in the `(app)` route group,
wrapped by **`AppGate`** (`src/app/_components/AppGate.tsx`): a signed-out visitor to the catalogue URL is
shown `<SignIn>` at that URL (no redirect) and lands on the catalogue only after authenticating. **No guest
ever renders a catalogue card.** So the app-language driving title + mission is always the signed-in
learner's resolved app-language (03: the cookie, synced from `userPrefs` at login). The guest app-language
(03: the cookie itself, pre-login) still exists globally — it themes the `SignIn` chrome the visitor lands
on — but never drives a catalogue card. **No divergent guest catalogue path to build.**

**Boundary held.** 06 owns catalogue localisation (both halves' spec + the query join). It did not re-decide:
where the app-language setting is stored (03), the global string-key convention/inventory (05), or the
catalogue's layout (course-publishing 05, shipped). No dependency on 03's resolution specifics surfaced — the
abstract "active app-language" input was sufficient, so 06 ran fully in parallel.
