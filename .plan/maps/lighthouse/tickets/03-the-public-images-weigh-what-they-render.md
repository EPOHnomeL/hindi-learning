---
type: task
blocked_by: [01]
---
# The public images weigh what they render

## Question

`public/images/founder.png` is **2.2 MB** (measured 2026-09-21). It is the only raster
on the landing page, it renders into a box capped at `max-w-[16rem]`, and its `sizes` is
`(min-width: 1024px) 16rem, 60vw`. It is roughly two orders of magnitude larger than the
pixels it draws.

It does go through `next/image` with `fill` and a correct `sizes`
(`src/app/_components/Landing.tsx:338`), and `next.config.js` sets no `images` config, so
the Vercel optimizer is on and will serve a resized modern format. So the wire cost on a
preview deploy is probably not 2.2 MB, and this ticket must not assume it is. What the
source weight does cost regardless:

- the **first** request for each variant pays an optimizer cold miss on a 2.2 MB decode;
- every clone, every CI checkout and the repo itself carries it;
- the same photo already went stale once as a crop (the comment at that call site
  records a centred square cutting the face in half), so it will be re-exported again,
  and re-exporting from a right-sized source is cheaper than from this one.

01 will say whether Lighthouse actually fires "Properly size images", "Serve images in
modern formats" or "Efficiently encode images" on `/`. **Start from that list, not from
this ticket's suspicion.**

The other public rasters, for completeness: `public/ywampotch-logo-mark.jpg` (68 KB),
`public/ywampotch-logo-banner.webp` (6.9 KB), `public/favicon.ico` (14.7 KB).
`public/icon.svg` is 587 B and fine.

What to get right rather than guess:

- **Tenant logos are not static assets and are not this ticket.** `Brand.tsx` and
  `SignIn.tsx` render `tenant.logoUrl` through a plain `<img>` with an explicit
  eslint-disable, because it is a Convex storage URL at an arbitrary aspect. Whether
  those want optimizing is a different question with a different answer, and the
  `object-contain` logo-slot reasoning in `Brand.tsx` is load-bearing. Leave it.
- **The `onError` fallback must survive.** The portrait is conditional on
  `portrait !== false` and falls back to no aside at all, which is how the section
  behaves for a tenant with no photograph. Do not lose that.
- **The crop is anchored `object-left` on purpose.** A re-export must not re-centre the
  face. The comment at the call site says why.

## Done when

- No "properly size images", "modern image formats" or "efficiently encode images"
  finding fires on any of the four public URLs, checked with the 01 harness.
- `public/images/founder.png` is replaced by a source sized for the box it renders into,
  with the before and after byte counts in the Answer.
- The founder section still renders correctly at both breakpoints with the face
  correctly framed, and still degrades to no aside when the image is missing. Walked,
  not inferred.
- The Answer lists every public raster it touched and what it left alone, so the next
  session does not re-audit the same files.
