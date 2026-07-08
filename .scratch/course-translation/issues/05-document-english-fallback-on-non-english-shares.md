# Document: a non-English share still exposes English source for untranslated items

Status: done — documented in docs/translation.md §6 (2119c38)

> Deferred follow-up from the PR #4 review. NOT a bug — the by-design per-item
> fallback — but a confidentiality expectation worth writing down.

## What to build

Document the fallback behavior so it isn't mistaken for an access-control leak:
when an owner shares (or publishes a public link for) a **non-English** Edition,
any item that has no successful translation row falls back to the **English
source** text for that item (the per-item `?? source` fallback in the read
seams). So a "Spanish only" share still surfaces the English original for any
lesson/reference that failed to translate or was never translated.

This is intended — a missing translation should degrade to readable content, not
a blank — but it means **"share only the translated Edition" is not a
confidentiality boundary**: the English source can still be read for untranslated
items. Capture this in `docs/translation.md` (access model / failure modes) so
future work doesn't assume otherwise.

If a real "hide the English original" requirement ever appears, that's a separate
feature (e.g. refuse to serve an Edition until it is fully translated, or serve a
placeholder instead of the source) — note it as out of scope here.

## Acceptance criteria

- [ ] `docs/translation.md` states plainly that a non-English share/public link
      exposes the English source for any untranslated item, and that this is not
      a confidentiality boundary.
- [ ] The note references where the fallback lives conceptually (per-item source
      fallback in the reader/public read path) without pinning exact line numbers.

## Blocked by

- None — can start immediately (docs-only).
