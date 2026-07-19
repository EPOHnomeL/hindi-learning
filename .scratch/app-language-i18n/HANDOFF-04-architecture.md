# Handoff — Chrome-i18n ticket 04: Architecture decision (the spine)

## Your task this session

Resolve **exactly one** wayfinder ticket — the architecture spine of the chrome-i18n effort:
`.scratch/app-language-i18n/issues/04-architecture-i18n-layer-catalogue-storage.md`.

It is a **HITL `grilling` ticket**. You resolve it *with* the user, one question at a time, giving a
recommended answer with each — **never answer your own questions**. Do **not** resolve any other
ticket this session (one ticket per wayfinder session).

## Start here

1. Read the map (low-res index) then the ticket body, then the research asset — **don't restate them,
   reference them**:
   - Map: `.scratch/app-language-i18n/issues/00-app-language-i18n-map.md`
   - Ticket 04: `.scratch/app-language-i18n/issues/04-architecture-i18n-layer-catalogue-storage.md`
   - Research (ticket 02, feeds this): `.scratch/app-language-i18n/research-app-router-i18n.md`
   - Prior-art to grill *against*: `.scratch/app-language-i18n/issues/01-global-app-language-picker-full-chrome-i18n.md`
2. **Claim it** before any work — add `**Claimed:** <session>` under its Status line.
3. Grill the four decisions in the ticket body. Record: append a Resolution to the ticket, flip Status
   `done`, add a Decisions-so-far line to the map, graduate/confirm the affected fog (below), commit.

## The four decisions (detail in the ticket — this is just the spine)

1. **The i18n layer** — framework (`next-intl`/`use-intl`, no locale routing) vs. in-house `t(key)`.
   Must span App Router Server + Client Components and satisfy "trivial to add a language".
2. **Where catalogues live** — in-repo per-locale JSON (build-time, 5 known langs) vs. a Convex
   `localizations` table loaded at runtime (ticket 01's proposal).
3. **How a string is translated** — hand-authored per language vs. generated via the content LLM path.
4. **How adding the 6th language works end-to-end** — the concrete maintainer operation. This is the
   **acceptance test** for the whole decision.

## What the research already recommends (ticket 02) — grill it, don't rubber-stamp

The asset lands on: **`next-intl` "without i18n routing"** (locale from a cookie via async
`getRequestConfig`) over an in-house layer; **repo per-locale JSON** over a Convex table + LLM rail;
**reuse `convex/languages.ts`** as the existing 5-language registry; **do NOT wire chrome into
`convex/translate.ts`** (it's a `PUBLISH_SECRET`-guarded OpenRouter *content* routine — wrong shape for
a small fixed UI-string set); Hindi chrome needs a **Devanagari-capable font** (mirror the reader's Noto
handling). "Add a language = one JSON file + one `LANGUAGES` entry" is the concrete acceptance bar.

Ticket 04 exists to **grill this against ticket 01's shape** (the `t()` layer, a Convex `localizations`
table, LLM generation with a `sourceHash` cache) and have the user **adopt / revise / reject** — the
research is an input, not the verdict.

## Coordinator's lean (from the orchestrating session — informational, not binding)

The research is strong and I'd endorse it: `next-intl` + repo JSON + reuse `convex/languages.ts` kills
real complexity, and the corrections about `convex/translate.ts` and runtime-add-out-of-scope are
sound. But this is the **user's** call in the grilling — let it land there.

## Boundaries — don't collide with the parallel ticket

**Ticket 03 (storage/resolution/picker) runs in parallel in a different session** — do NOT touch it.
Watch the seam: **03 owns the *user's app-language setting*** (the `users` locale field vs a `userPrefs`
row, guest `localStorage`, resolution order, the picker). **04 owns the *rendering layer + string
catalogue storage***. Both are "where does something live" questions — keep 04 to the *catalogue*, not
the *user preference*. If a decision genuinely spans both, name it and defer the settings half to 03.

## Fog to resolve/confirm when 04 lands (from the map's "Not yet specified")

- **Pluralization & number/date/currency formatting** — the map flags this as **likely absorbed** into
  04, because `next-intl`'s ICU format gives pluralization + `Intl` formatting free. **Confirm** this
  collapses into your layer choice (and clear it from the fog) rather than staying a separate ticket.
- **Catalogue staleness / sync** (a `sourceHash`-style marker) graduates once 04 + 05 settle — likely
  *not* this ticket, but note whether your layer choice changes its shape.

## Downstream

Ticket 04 **unblocks ticket 05 (extraction) and ticket 06 (catalogue surface)**. Record the decision
precisely enough that those can build with no wayfinding left.

## Suggested skills

- `/grilling` + `/domain-modeling` — the decision core; grill against ticket 01, one question at a time.
- `convex:convex-expert` — only if a `localizations`-table option is seriously weighed, or to confirm
  `convex/languages.ts` is the right registry to reuse. (The user-locale-field shape belongs to 03.)
- `/ponytail` posture — 5 known languages, bounded learner base; smallest layer that satisfies
  "trivial to add a language". No speculative many-locale platform.

## Repo conventions

Local-markdown tracker (`docs/agents/issue-tracker.md`). Commit straight to `main`, **stage explicitly
by path** (concurrent sessions are live on `main` — never `git add -A`, never `--amend`), re-check
`git diff --cached --stat`. Message `docs(app-language-i18n): resolve ticket 04 — …` ending with
`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Push only if asked. Context
lives in the repo, not machine-local memory (`CLAUDE.md`).
