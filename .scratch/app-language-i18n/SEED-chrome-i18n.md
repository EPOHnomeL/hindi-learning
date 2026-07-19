# Seed brief — new Wayfinder effort: Chrome / app-UI internationalization (i18n)

## What this session is

**Chart a brand-new wayfinder map** for app-UI (chrome) internationalization. This is a *separate
effort* from course-publishing — its own `.scratch/<slug>/` dir and its own `wayfinder:map` issue.
Run `/wayfinder` (chart-the-map mode) with the loose idea below; do **not** try to resolve tickets in
the same session (charting is one session's work).

Suggested slug: `.scratch/chrome-i18n/` (or `app-ui-i18n/` — your call).

## The loose idea (the destination-naming starting point)

Localize the **application interface itself** — nav, buttons, dashboard chrome, dialogs, system
copy — into languages beyond English, and let a user run the **app UI in one language while consuming
course content in another**. App-UI language and content language become **two independent settings**.

## Why it exists now — provenance

Promoted from the **course-publishing map's** "Not yet specified" fog (`app-UI translation`). Two
things sharpened it into its own effort:

1. **Course-publishing ticket 07 collapsed** onto the realisation that **content-language translation
   already ships** — the `translations` table, `convex/translate.ts`, and the reader's per-Edition
   language switcher (access is already per-Edition). So the *content* half is done; what remains is
   the *chrome* half, which is this effort. Ticket 07's key distinction — **app-UI language vs
   content/enroll language are two different settings** — is the founding premise here.
2. The user named chrome-i18n as their **actual priority** and asked for it "separately."

## Ground facts to pin at charting (verify, then treat as truth)

- **No i18n framework exists in the app today — the chrome is English-only.** There is no message
  catalogue, no locale routing, no `t()` layer. So "name the destination" is real work: is the target
  a chosen framework + a first non-English locale, or just the extraction/architecture decision?
- **Content translation is a solved, separate system** (`translations` table, `convex/translate.ts`,
  per-Edition reader switcher) — do **not** re-chart it. Chrome-i18n consumes the *content-language*
  setting as a sibling, not a dependency.
- **Ponytail posture** — four known tenants and a bounded, known learner base. Don't chart a
  speculative many-locale platform; find out which languages are actually wanted first.

## Known interaction to carry in — the deferred catalogue item

Course-publishing **ticket 05** parked a follow-up: on the catalogue, selecting a language should also
localize the **card's title + mission** (today the catalogue query returns only source-language
title/mission). That straddles content-data-plumbing and chrome-i18n. Decide during charting whether
it belongs in this effort's scope or stays a course-publishing follow-up — name the interaction, don't
silently absorb it.

## Charting checklist (from the wayfinder skill)

1. `/grilling` + `/domain-modeling` to **name the destination** — what "done" is (a locked
   architecture decision? a framework choice + first locale shipped? a spec to hand to a build?).
   The destination fixes scope before anything else.
2. Grill again **breadth-first** to map the frontier: framework choice, message extraction strategy,
   locale detection/routing (per-user setting vs URL vs tenant default), where the app-UI-language
   setting lives (new `users` field? — note 07 deliberately did *not* add one), pluralization/RTL,
   translation workflow (human vs the existing LLM `translate.ts` rail?), tenant interaction (does a
   tenant pin a default chrome language?).
3. Create the map (`wayfinder:map`), Destination + Notes filled, fog sketched into Not-yet-specified.
4. Create the tickets you can specify now; wire blocking in a second pass. Stop — don't resolve.

## Suggested skills

- `/grilling` + `/domain-modeling` — the charting core.
- `convex:convex-expert` — for any `users`/`tenants` locale-field or message-catalogue data shape.
- `/research` — likely a ticket in the map: survey the app's current framework (Next.js? Vite?) and
  what i18n approach fits it, and how `convex/translate.ts` could (or shouldn't) be reused for chrome
  strings.
- `/ponytail` posture throughout.

## Repo conventions

Local-markdown tracker under `.scratch/` (see `docs/agents/issue-tracker.md`). Commit straight to
`main`, stage by path, conventional commits ending with
`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Concurrent sessions are live
on `main` — stage only your own files. Context lives in the repo, not machine-local memory
(`CLAUDE.md`).
