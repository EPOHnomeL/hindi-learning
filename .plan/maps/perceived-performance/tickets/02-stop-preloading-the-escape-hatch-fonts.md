---
type: task
blocked_by: []
---
# Stop preloading fonts the visitor's locale will never render

## Question

`src/app/layout.tsx` declares three `next/font/google` families at module scope and puts
all three variables on `<html>`, so `next/font` preloads all three on every route. Mapped
back from the built CSS to the emitted files on 2026-09-09:

| file | family | size |
|---|---|---|
| `73fd63d6adb7b86c-s.p.woff2` | Noto Serif Devanagari 400 | 127 KB |
| `fb12bdfc6f99d938-s.p.woff2` | Noto Naskh Arabic 400 | 94 KB |
| four small files | Spectral latin 400/600, roman and italic | around 60 KB |

Devanagari and Naskh are described in that file's own comments as **escape hatches**:
they render only when `isDevanagari(locale)` or `isRtl(locale)` puts `font-deva` or
`font-naskh` on `<body>`. So an English, Afrikaans, Spanish or French visitor fetches
221 KB of glyphs at preload priority, competing with the JS for bandwidth during LCP, and
paints not one of them.

The obvious fix is `preload: false` on `notoDeva` and `notoNaskh`. Two lines. **The
reason this is a ticket and not a drive-by is the trade it makes**: those two keep
`font-display: swap`, so a Hindi or Urdu visitor still gets the right face, one swap
later than today. In an app whose namesake audience reads Devanagari, and whose live
whitelabel tenant serves Hindi editions, that regression is not free and is not
theoretical.

Two things the resolving session should establish rather than assume:

- **What the swap actually looks like on a Hindi load.** A flash of fallback on chrome
  full of fixed-height controls (the bottom tab bar, badges, the line-clamped card
  subtitles pinned at `min-h-[38px]`) is a different problem from a flash in running
  prose. The layout comments already flag those controls as reflow-sensitive.
- **Whether the conditional preload is worth building instead.** The layout already
  computes `isDevanagari(locale)` and `isRtl(locale)` before paint, so a hand-written
  `<link rel="preload">` in `<head>` gated on the locale would give both audiences the
  right answer. It costs a hardcoded font URL, which is a hash that changes at build, and
  that is the real objection. Price it before dismissing it.

Note that the lesson iframe is a separate document with its own per-Edition direction and
its own faces; this ticket is about the chrome only, and must not change what a
translated lesson body renders in.

## Done when

- A visitor in a Latin-script locale no longer downloads the Devanagari or Naskh faces at
  preload priority, confirmed against a fresh `pnpm build` and the emitted `.p.woff2`
  set, not against the source diff.
- **A Hindi load has been walked in a browser by a human**, at mobile width, and the
  Answer says what the swap looked like on the fixed-height chrome. Reading the code is
  not sufficient evidence for this ticket, and a resolution that only claims a passing
  typecheck is not a resolution.
- The Answer records which of the two shapes was taken (plain `preload: false`, or the
  locale-gated preload link) and why the other was not.
