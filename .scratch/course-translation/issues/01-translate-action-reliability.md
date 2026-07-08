# Translate action: retries, timeout, and bounded fan-out

Status: obsolete — in-app Claude fan-out removed in the cloud-Routine cut-over (674ebd6); reliability now owned by the cloud run

> Deferred follow-up from the PR #4 (course-translation / Editions) review.
> Flagged IMPORTANT by both the Convex and security reviews. Not a security hole
> — it's a reliability + cost-shape gap in the external Claude Messages-API call.

## What to build

Make the per-item translation fan-out resilient to the transient failures that
are *expected* when a course issues many concurrent calls to the Claude Messages
API, and stop a single hung upstream request from tying up an action.

Today `startTranslation` schedules every stale item at `runAfter(0, …)`
simultaneously, and each item's Claude call is a single `fetch` with no timeout
and no retry. A large course (e.g. 40 lessons ≈ 80 calls) reliably trips
rate-limit / overload responses (`429`/`529`) or 5xx; each non-2xx throws, the
item is recorded `failed`, and it only ever retries if the owner manually
re-runs the translation. The edition then goes `ready` with a `failed` count and
those items silently fall back to English, with no automatic recovery.

Add:
- **Retries with exponential backoff + jitter** on `429`, `5xx`, and network
  errors, up to a small cap.
- **A request timeout** (`AbortController`) so a hung call fails fast instead of
  occupying the action until the platform kills it.
- **Bounded concurrency** — either a concurrency cap or a stagger on the
  scheduler fan-out — so a big course doesn't self-inflict rate limits.

An item should only land as `failed` after retries are exhausted.

## Acceptance criteria

- [ ] A transient `429`/`5xx`/network error is retried with backoff; the item
      succeeds without owner intervention when the upstream recovers.
- [ ] A call that exceeds the timeout is aborted and counts as a (retryable)
      failure, not an indefinitely-pending action.
- [ ] Translating a large course does not fire all item calls at once — fan-out
      is capped or staggered.
- [ ] An item is marked `failed` only after the retry budget is exhausted.
- [ ] Behavior verified live on a dev deployment with `ANTHROPIC_API_KEY` set
      (the build env has no key, so this needs a real run — translate a
      multi-lesson course and confirm no spurious `failed` items).

## Blocked by

- None — can start immediately. Final acceptance needs a live deployment with the
  API key set (see the operator step in `docs/translation.md`).
