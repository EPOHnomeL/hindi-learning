# rich-media/09: Scope Editions × embedded media

**Status:** open
**Depends on:** 02, 03

## Why

An [[Edition]] is a translated projection of lesson/reference HTML
([`translate.ts`](../../../convex/translate.ts)). Once Lessons embed images and video
iframes, the translate run rewrites bodies that now contain media markup — the media itself
stays source-language while the prose around it translates. Mostly fine, but it needs deciding
deliberately, and the translator must not mangle embeds.

## Questions to answer

- Robustness: does the LLM translate pass preserve `<img>`/`<iframe>` markup byte-exact
  (src/start/end params untouched)? Does the prompt need an explicit "leave media elements
  unchanged" rule + a post-check?
- What *should* translate: alt text and captions/figure text (yes, presumably); quiz text
  around a video segment (yes); the transcript-derived quotes inside a lesson (yes — they're
  prose)?
- Video language: a Hindi-teaching video embedded in a Spanish Edition still speaks its source
  language. Acceptable and stated? YouTube's own auto-translated captions can be hinted via
  embed params (`cc_lang_pref`) — worth wiring, or noise?
- Do image blobs ever need per-language variants (text-in-image)? Null hypothesis: no —
  document as a known limitation.
- `sourceHash` semantics: media-only lesson changes (new blob id, same prose) — should they
  invalidate translations?

## Out of scope

- The embed/publish mechanics themselves (tickets 02/03).
- Any new translation infrastructure.

## Deliverable

A short policy note: what translates, what's preserved verbatim, the prompt/post-check rule
for embed markup, and stated limitations (media stays source-language).
