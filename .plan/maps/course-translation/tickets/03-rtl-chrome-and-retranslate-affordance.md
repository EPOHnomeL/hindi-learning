---
type: task
blocked_by: []
---

# RTL reader chrome + a re-translate affordance for partially-ready Editions

## Question

**Where it stands:** open — reader-chrome RTL flip not built; retry not surfaced for ready-with-failures editions (re-entrancy guard is done)

> Deferred follow-up from the PR #4 review. Two reader/dashboard UX gaps around
> Editions. The RTL-chrome half overlaps the deferred **app-language-i18n** work
> (`.plan/maps/app-language-i18n/tickets/01-global-app-language-picker.md`).

## What to build

Two related polish items for the Editions reader experience:

1. **Flip the reader *chrome* for RTL Editions.** Today only the lesson/reference
   iframe content flips direction (via the content's `dir`/`lang`); the chrome
   around it does not. The sidebar nav labels and the lesson/reference `<h2>`
   headers render right-to-left text (Arabic, Urdu, …) inside left-to-right
   containers, giving wrong-side numbering, truncation ellipses, and alignment.
   The chrome should pick up the served Edition's direction. Note: full app-wide
   chrome localisation is the separate app-language-i18n feature — this issue is
   just the direction flip for the reader frame around a translated Edition, so
   coordinate to avoid duplicate work.

2. **Let an owner retry a partially-failed Edition.** When an Edition finishes
   with some items failed it is `status: "ready"` with a `failed` count, and the
   dashboard shows "Ready · N failed" with no way to retry — while the
   add-language control hides already-present languages, so those items stay on
   the English fallback permanently. The backend already re-runs a `ready` job
   (only stale/failed items reschedule); this just needs a "Re-translate" /
   "Retry failed" affordance surfaced when `status === "ready"` and `failed > 0`.

## Acceptance criteria

- [ ] Reading an RTL Edition (e.g. Urdu) flips the reader chrome direction — nav
      labels and content headers align/number correctly, not just the iframe.
- [ ] A `ready` Edition with `failed > 0` shows a retry affordance that re-runs
      the translation (only failed/stale items re-billed).
- [ ] The retry path respects the new re-entrancy guard (no action while a job is
      already `translating`).

## Blocked by

- None to start. RTL-chrome scope should be reconciled with app-language-i18n
  (`.plan/maps/app-language-i18n/tickets/01-global-app-language-picker.md`) so the
  direction handling isn't implemented twice.

## Comments

### EPOHnomeL — 2026-07-10

Verified 2026-07-10 (main @ 1b2db94) — still outstanding as written: the Edition `dir` reaches only the sandboxed iframe (via CoursePanes → ArtifactView); the chrome containers in CourseShell.tsx (root div :144, aside :164, nav :186) never get `dir`. And `RetryTranslation` renders only in the `status === "failed"` branch (Editions.tsx:141-149) — a "ready · N failed" Edition (translate.ts:372) shows no failed count and no retry. The retry mechanism itself is wired; only the affordance is missing.

## Done when

The reader chrome flips direction for an RTL Edition, and a partially-ready Edition offers a re-translate affordance — coordinated with the app-language-i18n map so neither duplicates the other.

<!-- Migrated 2026-07-30 from GitHub issue #66 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->

## Ruled out

**Ruled out of scope 2026-08-04 — no RTL Edition is in play, and the retry affordance is
polish the effort closed without.**

Both halves, separately:

- **RTL reader chrome.** The Edition `dir` still reaches only the sandboxed iframe; the
  chrome containers in `CourseShell.tsx` never get it. But nothing currently ships that would
  show the difference — the sibling [app-language-i18n](../../app-language-i18n/map.md) map
  ruled RTL out of scope because all five target chrome languages are LTR, and the Editions
  actually built by this effort (`st`, `st-ZA`, and the rest of the translation set) are LTR
  too. This is real work with, today, no user. It belongs with whoever ships the first RTL
  Edition — Urdu was the example — so the direction handling is designed once against a live
  case, not twice against a hypothetical.

- **Re-translate affordance for `ready · N failed` Editions.** The mechanism is already wired;
  `RetryTranslation` just renders only in the `status === "failed"` branch, so a partially
  failed Edition strands its failed items on the English fallback with no way back. Genuinely
  a gap, genuinely small — and closed unbuilt with the effort. An owner can still recover by
  removing and re-adding the language, at the cost of re-billing every item rather than the
  failed ones.

Out of scope rather than resolved: nothing was decided here and nothing was built. Either half
can return as a fresh ticket the moment it has a real case.
