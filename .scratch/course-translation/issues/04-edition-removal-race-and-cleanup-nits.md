# Edition-removal race + translation cleanup nits

Status: partial — removal race + error-clear shipped (a255df8); remaining: drop the dead by_topic_email_lang index and record the setTopicPublic decision

> Deferred follow-up from the PR #4 review. One narrow correctness race plus a
> few low-risk cleanups, grouped because they all concern the Edition/job
> lifecycle.

## What to build

1. **Don't orphan translation rows when an Edition is removed mid-flight.**
   `removeEdition` deletes an Edition's `translations` rows and its job, but does
   not cancel any `translateItem` actions already scheduled. A straggler's
   `saveTranslation` can then insert a fresh `translations` row for the just-
   deleted Edition (its job update is skipped because the job is gone). Those
   orphan rows persist, and if the owner later re-adds that language,
   `startTranslation`'s staleness map counts them as already-done, inflating the
   new job's `done` before any work runs. The trigger is narrow (Remove only
   shows on `status: "ready"`, when nothing should be in flight) and is partly
   mitigated by the new re-entrancy guard, but the race is real. Make
   `saveTranslation` a no-op (or reconcile) when the Edition/job no longer exists.

2. **Cleanup nits (each independent, low-risk):**
   - Remove the dead `pendingShares.by_topic_email_lang` index in `schema.ts` —
     defined but never queried (dedup uses `by_topic_email` + in-memory filter).
   - Clear `translationJobs.error` when a job transitions to `ready` — today it
     lingers until the next `startTranslation`, so a healthy edition can carry a
     stale error string.
   - Note that `shares.setTopicPublic` is now only exercised by tests (the UI
     routes English public links through `setEditionPublic(lang="en")`). It's
     still valid/tested — decide whether to keep it as an API or fold it in.

## Acceptance criteria

- [ ] A `saveTranslation` for a removed Edition/job inserts no `translations` row
      (covered by a seam test that removes an Edition with an item still "in
      flight" and asserts no orphan row remains).
- [ ] The dead `by_topic_email_lang` index is gone and the suite still passes.
- [ ] A job that reaches `ready` carries no leftover `error`.
- [ ] `setTopicPublic`'s fate (keep vs. remove) decided and reflected.

## Blocked by

- None — can start immediately.
