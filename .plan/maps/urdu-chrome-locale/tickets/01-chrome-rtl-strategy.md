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
is [03](03-rtl-app-shell.md).
