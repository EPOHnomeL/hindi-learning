---
type: grilling
blocked_by: []
---

# Decide the chrome RTL strategy

## Question

The app has never rendered right-to-left. `src/app/layout.tsx` sets `<html lang={locale}>` and
says outright that "`dir` stays ltr — RTL is out of scope". Urdu makes it in scope. Decide
**how** the chrome flips, and how much of the existing markup has to change to survive it.

The decisions to close:

1. **The flip itself.** `dir="rtl"` on `<html>` keyed off the locale (a per-locale `rtl` flag —
   `langInfo(locale).rtl` already exists and is `true` for `ur`) is the obvious shape. Confirm
   that, and confirm nothing downstream fights it: the tenant pre-paint `<style>`, the dark-mode
   inline script, and the lesson iframe (which sets its *own* `dir` per Edition — an Urdu-chrome
   user reading an English lesson must get RTL chrome around an LTR lesson, and vice versa).
2. **How much physical-property debt exists.** Tailwind's logical utilities (`ms-`/`me-`,
   `ps-`/`pe-`, `start-`/`end-`, `text-start`) flip for free; `ml-`/`mr-`, `pl-`/`pr-`,
   `left-`/`right-`, `text-left` do not. Count the real offenders across the in-scope learner
   surfaces before deciding — a grep is minutes, and the answer decides whether this is a
   one-session sweep or a per-surface campaign. Absolutely-positioned chrome (dialog close
   buttons, dropdown carets, drawer edges) and any `translateX` are the usual casualties.
3. **Icons and directional affordances.** Back/forward arrows, progress/lesson navigation and
   the reader's next/prev must point the other way; a globe or a check must not mirror. Decide
   the rule (a small mirror-these list, or a `rtl:-scale-x-100` utility on the directional ones)
   rather than fixing them ad hoc.
4. **The font.** Urdu in the Latin `Spectral` stack is tofu. Mirror Hindi's escape hatch
   (`layout.tsx:38`, `Noto_Serif_Devanagari` swapped on by `isDevanagari(locale)`) with an
   Urdu-script equivalent. **Noto Naskh Arabic vs Noto Nastaliq Urdu is a genuine choice**:
   Nastaʿlīq is what Urdu readers expect, and it needs materially more line-height, which
   affects every fixed-height chrome element. Decide the face and whether the line-height change
   is global or scoped.
5. **How this is judged done, and by whom.** Nobody in the operator set reads Urdu. Decide the
   acceptance path — a per-surface visual pass with a native reader, or a pseudo-locale/`dir=rtl`
   smoke pass an English speaker can run — before 03 claims to be finished.

Size the answer honestly: if the sweep is large, say so, and say whether Urdu ships behind the
picker only once the sweep lands or lands as a visibly-imperfect locale first.

## Done when

The strategy is written here as an `## Answer`: where `dir` is set and from what; a counted
inventory of physical-property and positioning offenders on the in-scope learner surfaces with
the fix pattern for each class; the icon-mirroring rule; the chosen Urdu face plus its
line-height consequence; and the acceptance path. Explicitly **decided, NOT built** — the build
is [03](10-rtl-app-shell.md).

<!-- Moved 2026-09-01 from `urdu-chrome-locale/01` into the technical-foundation map, which groups this repo’s scalability, refactoring and code-architecture work. Renumbered to 09 because `blocked_by` is map-local and the old numbers collided. Inbound links across `.plan/` were repointed in the same commit. -->

## Answer

Decided 2026-09-03 with the operator, who chose **full RTL chrome in one go** over
shipping Urdu LTR first with the flip as a follow-up. Everything below is the strategy;
the build is [10](10-rtl-app-shell.md).

### 1. The flip

`dir={langDir(locale)}` on `<html>` in `src/app/layout.tsx`, beside the `lang` that is
already there. `langDir` is `convex/languages.ts:235`: it already exists, it is pure,
and it wraps the `RTL_CODES` set that returns `true` for `ur`. **No new `src/i18n`
constant.** The registry is where per-language direction already lives (it is what the
reader and both pickers read), and a second source of truth for the same fact is how
they drift apart. `layout.tsx` already imports `isDevanagari` from that module, so this
is one more named import from a file it depends on anyway.

Nothing downstream fights it, confirmed by reading each:

- The tenant pre-paint `<style>` injects `--color-*` tokens only, no directional
  properties.
- The dark-mode and scroll-restoration inline scripts touch `data-theme` and
  `history.scrollRestoration`, both direction-blind.
- The lesson iframe keeps its own per-Edition `dir` (`lessonSrcDoc.ts`), and
  `CourseShell` already threads a `dir` of its own (`CourseShell.tsx:57`, `:203`) from
  the served Edition. An `<iframe>` is a separate document, so an inherited `dir` cannot
  leak into it. **Both cross-pairs therefore work by construction**, RTL chrome around
  an LTR lesson and LTR chrome around an Urdu Edition. But the build must still walk
  them, because "by construction" is inference, not evidence.

### 2. The physical-property debt, counted rather than estimated

`grep -rE '\b(ml-|mr-|pl-|pr-|left-|right-|text-left|text-right)' src/` gives **73 hits
across 27 files**. Broken down, the sweep is much smaller than the raw number:

| Class | Count | Fix |
| --- | --- | --- |
| `text-left` on buttons and rows | 30 | `text-start` |
| Prose comments containing "left"/"right" | 5 | none, not code |
| Admin-only surfaces (`AdminPanel.tsx`) | 12 | none, out of scope and English-only |
| Toggle-switch knobs (`after:left-0.5` plus `peer-checked:after:translate-x-4.5`) | 4 | `after:start-0.5` plus an `rtl:` negated translate |
| Centring pins (`left-1/2 -translate-x-1/2`) | 3 | none, symmetric and direction-blind |
| Absolute corner pins (`right-1`, `right-3`, `-right-2`, `right-0`, `left-0`) | 7 | `end-*` / `start-*` |
| Margins and padding (`ml-`, `mr-`, `pl-`, `pr-`) | 12 | `ms-`/`me-`/`ps-`/`pe-` |

Plus one hit the grep does **not** catch: `md:border-r` on the reader sidebar
(`CourseShell.tsx:265`, `PublicReader.tsx:187`) is a physical border and needs
`md:border-e`.

This is a **one-session sweep**, not a per-surface campaign. Tailwind 4 ships every
logical utility needed (`ms-`/`me-`, `ps-`/`pe-`, `start-`/`end-`, `text-start`/`text-end`,
`border-s`/`border-e`) and the `rtl:` variant covers the handful that cannot be expressed
logically.

**The drawer is not a problem.** The mobile sidebar is a *bottom sheet*: it slides on
`translate-y`, with `md:translate-x-0` only as a desktop reset. Vertical motion is
direction-blind, so there is no slide direction to mirror. This was the single largest
risk going in and it evaporated on reading the file.

### 3. Icons and directional affordances

There is **no icon-mirroring rule to write, because there are no directional icons.**
`icons.tsx` holds 24 icons; the only one with an axis is `chevron`, which points *down*
and is only ever rotated on the vertical (`rotate-180` for open/closed disclosure).
Globes, checks and locks must not mirror, and none of them do.

The directional affordances that do exist are **text**, not icons:

- Four `→` glyphs baked into `messages/en.json` strings (`Reader.nextLesson`,
  `Reader.generateNext`, `Certificate.openPublicPage`, `Editions.viewArrow`). **Rule: a
  directional glyph inside a message is part of the message.** Each catalogue writes its
  own arrow, so `ur.json` carries `←` where `en.json` carries `→`. No CSS, no mirroring
  list, and it comes out right automatically for every future locale.
- One JSX literal, `<span aria-hidden>←</span>` at `CourseShell.tsx:324`. It is decoration
  beside a translated label, so it gets `rtl:-scale-x-100` rather than a trip through the
  catalogue.
- `AdminPanel`'s three `← Courses` links and its `rotate-90` caret are admin surfaces,
  ruled out of chrome-localisation scope by the app-language-i18n map. Left alone
  deliberately.

### 4. The font: **Noto Naskh Arabic**, not Nastaliq

Nastaliq is what an Urdu *reader* expects for running prose, and choosing against it is
the one call here a native reader might overturn. Taking it anyway, for chrome
specifically:

- Chrome is short labels inside **fixed-height controls**: the bottom tab bar, buttons,
  badges, and card subtitles pinned at `min-h-[38px]` with `line-clamp-2`. Nastaliq's
  steeply sloping baseline needs roughly double the line-height of Naskh, so dropping it
  in clips or reflows nearly every one of those, which converts a one-session sweep into
  a per-component height audit.
- Noto Nastaliq Urdu is also several times the byte weight of Noto Naskh Arabic, on a
  font loaded into every page of the app shell.
- Naskh is the ordinary face for Urdu *user interfaces*, for exactly these reasons.

So: `Noto_Naskh_Arabic` via `next/font/google`, exposed as `--font-naskh`, applied by a
`.font-naskh` class in `globals.css` and switched on by an `isRtl(locale)` test on
`<body>`. A direct mirror of the `isDevanagari` to `.font-deva` escape hatch it sits
beside. **No global line-height change** is needed, which is the point of the choice.

This decision is one font import and one class name. If a native reader wants Nastaliq
for chrome, reversing it is a small ticket, and the height audit it implies is the real
cost being deferred, not hidden.

### 5. Acceptance: how this is judged done, and by whom

Nobody in the operator set reads Urdu, so the acceptance path splits the two things that
can be wrong, and claims only the one it can actually check:

- **Layout correctness, checkable now, by an English speaker.** Direction faults are
  *visible* without reading the language: clipped labels, overlapping pins, a caret on the
  wrong side, a scrollbar in the wrong gutter. The pass is to set the app language to
  اردو, then walk reader, dashboard, settings and checkout, plus the two cross-pairs in
  section 1. This is the claim ticket 10 is allowed to make.
- **Translation quality, not checkable now, and not claimed.** The 709 Urdu strings ship
  LLM-drafted and pending human review, exactly as `af`/`es`/`fr`/`hi` did in `b2a4887`
  (2026-07-20) and still are. This is not a gap this work introduces; it is the standing
  posture of every non-English catalogue in the repo, and it stays open fog on the
  [translation-and-locales map](../../translation-and-locales/map.md).

**Urdu ships as soon as the sweep lands.** The operator chose the full flip precisely so
that it does not appear as a visibly imperfect locale first.
