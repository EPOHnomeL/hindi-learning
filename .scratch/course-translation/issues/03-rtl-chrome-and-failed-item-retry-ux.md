# RTL reader chrome + a re-translate affordance for partially-ready Editions

Status: ready-for-agent

> Deferred follow-up from the PR #4 review. Two reader/dashboard UX gaps around
> Editions. The RTL-chrome half overlaps the deferred **app-language-i18n** work
> (`.scratch/app-language-i18n/issues/01-global-app-language-picker.md`).

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
  (`.scratch/app-language-i18n/issues/01-global-app-language-picker.md`) so the
  direction handling isn't implemented twice.
