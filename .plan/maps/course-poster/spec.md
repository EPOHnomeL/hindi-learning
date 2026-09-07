# Course poster: a printable, shareable sheet for any Edition

Drafted 2026-09-07 with `/to-spec`, from the hand-made ywampotch "Growing your
relationship with the Holy Spirit" poster (`.scratch/poster/`) and the code as it
stood that day. Readiness: ready for an agent (an unblocked build with a sharp
Done when, per `docs/agents/triage-labels.md`). The generic template and its slot
contract are in `assets/poster-template.html` and `assets/poster-template.md`.

## Problem Statement

A course owner on a tenant wants to put their course in front of strangers: on a
noticeboard, in a WhatsApp group, on Instagram. Today that takes a designer and a
session of hand work per course and per language. The one poster that exists was
built by hand for one course in one language, its facts were typed in and two of
them could not be verified, and there is no way for the owner of the Afrikaans or
Urdu Edition to get the same sheet in their language. The Sharing tab offers a bare
QR PNG and nothing around it.

## Solution

Every Edition with a Public link gets a poster page the owner can open from the
Sharing tab, in the Edition's own language, dressed in the tenant's palette and
logo, with the course's real title, mission, lesson count, price and language
count filled in from the platform, and the Edition's public link as the QR. The
owner can add up to two highlight lines and italicise part of the title, then
download it as a 2x PNG (4:5, Instagram-ready) or print it to PDF. The sheet is the
hand-made ywampotch poster, generalised: the same layout, type and ornament.

## User Stories

1. As a course owner, I want a Poster button beside the QR download on the Sharing tab, so that I can make a poster for any Edition without leaving the course.
2. As a course owner, I want the Poster button disabled until the Edition's Public link is on, so that the QR on the poster always opens something.
3. As a course owner, I want the poster to carry the Edition's translated title and mission, so that the Urdu poster reads in Urdu without me translating anything.
4. As a course owner, I want the poster's fixed copy (eyebrow, call to action, price suffix, language line) in the Edition's language when the app ships that language's chrome, and in English otherwise, so that no sheet mixes scripts by accident.
5. As a course owner, I want an RTL Edition's poster mirrored, so that Urdu and Arabic sheets read naturally.
6. As a course owner, I want Devanagari and Arabic-script titles set in the app's own Noto faces, so that they do not render as tofu or in a mismatched font.
7. As a tenant, I want the poster in my palette and with my logo, so that it is my ministry's poster and not the platform's.
8. As a tenant with a wide banner logo, I want the logo contained rather than cropped, so that the mark stays whole (the same rule as the installable app icon).
9. As a tenant without a logo, I want my display name set as a wordmark, so that the sheet still carries a brand.
10. As a default-site course owner, I want the app's own mark and palette, so that the feature is not tenant-only.
11. As a course owner, I want the lesson count on the poster to be the live count, so that the sheet does not go stale as lessons are authored.
12. As a course owner, I want "Certificate on completion" to appear only when my tenant has certificates on, so that the poster does not promise what the tenant refuses.
13. As a course owner of a paid Edition, I want the price and "first lesson free" on the poster, so that nobody scans expecting a free course.
14. As a course owner of a free Edition, I want no price block and a "Free" eyebrow, so that the sheet does not read as a sale.
15. As a course owner, I want the language count to be the number of live Editions, so that "available in N languages" is true on the day it prints.
16. As a course owner, I want to type up to two highlight lines, so that the poster can say what the course is about in my words.
17. As a course owner, I want to select a run of words in the title to italicise, so that the headline has the emphasis the hand-made poster has.
18. As a course owner, I want to overwrite the tagline for one render, so that a mission written for the reader can be tightened for a wall.
19. As a course owner, I want a Download PNG button that gives me a 2160 x 2700 image, so that it is sharp on a phone and printable at A4.
20. As a course owner, I want a Print button that prints one 4:5 sheet with no page chrome, so that the same page is my PDF.
21. As a course owner, I want the poster page to be a plain URL I can open in another tab, so that I can check it on my phone before printing.
22. As a Guest who arrives on the poster URL, I want to see only what the public link already shows, so that a leaked poster URL leaks nothing more.
23. As the operator, I want the poster page kept out of search indexes and the Referer header, so that the token stays as private as the share link.
24. As a course owner, I want the printed host to be the tenant's canonical host, so that the typed address lands on the right skin.
25. As a course owner, I want the QR to encode the same URL the Sharing tab's QR download encodes, so that the two never disagree.
26. As a course owner, I want a long title to shrink rather than push the card off the sheet, so that every course fits the fixed 1080 x 1350 canvas.
27. As a course owner, I want the sheet to look the same in every browser I open it in, so that what I see is what prints.
28. As a course owner, I want the poster to say nothing it cannot back with data, so that I never print a claim like "about 10 minutes each" that no one measured.

## Implementation Decisions

- **One new route, `/poster/<token>`**, outside the authenticated app group and anonymous, with the same `robots` and `referrer` posture as the certificate and share pages. The token is the Edition's public link token. The page renders for anyone holding it; the editing panel appears only for the signed-in owner (the Editions query returns null for anyone else, which is the existing owner check).
- **The sheet is HTML, laid out by the browser.** Server-side rasterisation with satori was ruled out: its README states full Unicode bidirectional layout is not supported, and this feature exists to print Urdu and Arabic. The template is the browser-rendered sheet the hand-made poster already was.
- **PNG download is a client-side rasterisation of the sheet's DOM** at device scale 2, using a foreignObject-based renderer so the browser's own text layout, fonts and bidi are what get painted. This adds one small dependency, loaded on click like the QR encoder. Print uses a print stylesheet that sizes the page to the sheet, the certificate's existing pattern.
- **Data comes from existing reads, plus one field.** The Guest read of a course by token (title, mission, lang, dir, lessons, paywall, tenantSlug) and the tenant theme read (palette, logo URL, display name, motto, flags) already carry everything except the Edition's sibling languages. The Guest read gains a `languages` array of `{ lang, native }` for the course's live Editions (ready, and public or published). It is an explicit allowlist addition and leaks nothing the signed-in catalogue does not already show.
- **Chrome copy is a new `Poster` namespace in the message files**, keyed in all six shipped locales. The poster's locale is the Edition language when the app ships chrome for it, else English. This mirrors how the public link adopts a locale today.
- **Fonts.** Newsreader and Inter are loaded for the poster route only, through the same font loader the app uses. Devanagari and Arabic-script Editions reuse the app's Noto Serif Devanagari and Noto Naskh Arabic. No font is fetched from a third-party stylesheet at runtime.
- **Palette mapping** from the tenant's 14 tokens is fixed in the template: paper, hi, accent, accent2, gold, soft, card. State colours are not used. The default site uses the app's default palette.
- **Logo.** The tenant's one logo asset, contained in a bounded box (max height 150, max width 420 CSS px), never cropped, per the app icon rule. No second logo slot; the footer is the display name and motto as text.
- **Derived facts fill the points list** after the owner's highlights: lesson count from the Guest read's lesson list (locked lessons included), "Certificate on completion" gated on the tenant's certificates flag, and "Read it on your phone, offline" as the always-true third. The hand-made poster's minutes-per-lesson claim is dropped for lack of data.
- **Owner edits are render-local.** Highlights, the title emphasis and the tagline override live in the page's state for this render and are not written anywhere. They are not translated; an owner making an Urdu poster types Urdu highlights or leaves them off.
- **A pure poster model function** turns the three reads and the owner's edits into the slot values (title length class, points in order, price label via `Intl.NumberFormat`, language lines, host, eyebrow key). The page component only paints what the model returns. This is the seam the tests sit at.
- **The Sharing tab** gains a Poster button beside the QR button in the Public link row, enabled only when the link is on, opening the poster route in a new tab.
- **The QR** is generated in the browser with the encoder the Sharing tab already uses, at 600 px and margin 2, encoding the canonical public URL built by the existing helper.

## Testing Decisions

- A good test drives the seam with real inputs and asserts what comes out, never how. No test asserts a class name or a pixel.
- **The poster model** is tested with vitest as a pure function: a paid Edition yields the paid eyebrow and a formatted price; a free Edition yields no price and the free eyebrow; two highlights plus facts make exactly three points and the certificate fact disappears when the flag is off; a 60-character title gets the extra-long size class; the language lines count live Editions only and name the first two natively; an RTL Edition yields `rtl`; an Edition language without shipped chrome yields English chrome. Prior art: `src/lib/pwa.test.ts`, `src/i18n/shareLocale.test.ts`.
- **The Guest read's new `languages` field** is tested at the Convex seam with convex-test: a course with three ready Editions of which two have public links and one is only published reports all three; a translating Edition is not listed; a revoked token still returns null. Prior art: `convex/public.test.ts`.
- **The page and the download** are walked in a browser, not unit-tested. The resolution records which it had: an English and an Urdu poster opened on a phone-sized viewport, one PNG downloaded and its dimensions checked, one print preview showing a single page. The 2026-09-03 render script's fit check (footer bottom versus sheet bottom) is the reference for what "fits" means.

## Out of Scope

- Persisting or machine-translating the owner's highlights, emphasis or tagline override. A later effort may add a poster copy kind to the translation pipeline.
- A second tenant logo asset (mark and banner). The tenant record holds one logo.
- Any layout other than 1080 x 1350. A3 and 9:16 variants were tried on 2026-09-03 and abandoned for the squarer sheet; they can return as a size picker later.
- A server-rendered PNG or Open Graph image for the share link.
- Repairing the seeded tenants' inverted good and bad state colours, found on 2026-09-03 and left to the operator. The poster does not use those tokens.
- Verifying the live language count or price of `prophetic-school`; the sheet reads whatever is live.

## Further Notes

- The template was checked against the original on 2026-09-07 by filling it with the ywampotch values and rendering English and Urdu sheets with Playwright; both fit the canvas with about 70 px of slack under the footer. The renders are under `.scratch/poster/` and gitignored; the check script is `template-check.mjs` there.
- The hand-made poster claimed 25 languages and R100. Neither is readable from this checkout, and a code comment dated 2026-09-01 mentions five machine-translated Editions of the course. Whoever builds this should not carry either number into a fixture as fact.
- The poster palette in the template (`#1E2A5E`, `#C79A3C`, `#FAF6EC`) is a few points off the seeded ywampotch tokens (`#1b2a80`, `#d8a93f`, `#f9f4ea`). The platform sheet uses the tokens, so it will match the tenant's app exactly and the hand-made poster closely.
- ADRs touched: 0013 (public links are the Guest credential), 0022 (tenant model and tokens), 0024 (publish at the Edition grain, which is what "live Edition" means here), 0030 (logo containment rule). None is contradicted.
