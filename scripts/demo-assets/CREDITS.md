# Demo video assets — credits and licences

Render-time inputs for `scripts/record-demo.mjs`. Not served by the app and not
imported by any page; they exist so a demo video render is reproducible from the
repo rather than from someone's Downloads folder.

## soft-corporate-musiclfiles.ogg

| | |
| --- | --- |
| **Title** | Soft Corporate |
| **Artist** | MusicLFiles |
| **Licence** | [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0) |
| **Attribution required** | **Yes** — the Commons metadata sets `AttributionRequired: true` |
| **Source** | <https://commons.wikimedia.org/wiki/File:Soft_Corporate_by_MusicLFiles.ogg> |
| **Retrieved** | 2026-08-06 |
| **Format** | Ogg Vorbis, stereo, 44.1 kHz, 169.6 s |

### The credit that must appear

CC BY 4.0 permits commercial use — which matters here, because the demo sells a
paid course — but **only with attribution**. The required credit is:

> Music: "Soft Corporate" by MusicLFiles — CC BY 4.0

This is rendered **into the video itself**, in the caption bar, whenever the demo
page runs in `?video=1` mode. That placement is deliberate: the video is the thing
that gets distributed (WhatsApp, a landing page, a pitch deck), and it travels
separately from this repo. A credit that lives only in this file would not follow
the work, which is exactly what the licence requires it to do.

**If you remove the music from the render, remove the credit too** — crediting an
artist whose work is not in the video is its own kind of wrong. The demo page keys
the line off the same `?video=1` flag the recorder sets, so the two move together
only as long as nobody splits them by hand.
