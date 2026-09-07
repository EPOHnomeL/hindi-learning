# Course poster: a printable, shareable sheet for any Edition

## Destination

A course owner opens a poster for any Edition that has a Public link, in that
Edition's language and the tenant's brand, with the course's live facts and the
public link as a QR, and downloads it as a PNG or prints it. The route is clear
and one session builds it, so this is a pipeline effort: `spec.md` beside this file
is the scope, drafted 2026-09-07 from the hand-made ywampotch poster.

## Notes

- **This map carries build tickets.** The spec is agreed; the tickets under
  `tickets/` are execution, one per unit of work, to be built with `tdd` and
  `ponytail`.
- The generic template and its slot contract live in `assets/`. The hand-made
  original and its render scripts are under `.scratch/poster/` (gitignored
  images and scripts; the HTML was never committed).
- Rendering is in the browser on purpose: satori's README says full bidi layout
  is unsupported, and this feature's point is Urdu and Arabic sheets.

## Decisions so far

- **Built straight from the spec, no tickets, on 2026-09-07.** The user asked for the
  feature built from `spec.md` without breaking it into tickets, so this map carries
  no `tickets/`. Every Implementation Decision landed: the anonymous
  `/poster/<token>` route (`src/app/poster/[token]/`), the pure model
  (`src/lib/poster.ts`, tested), the `languages` field on the Guest read
  (`convex/public.ts`, tested with convex-test), the `Poster` namespace in all six
  message catalogues, the Poster button in the Sharing tab, Newsreader and Inter
  through the app font loader scoped to the route, and `html-to-image` as the
  click-loaded 2x rasteriser. `pnpm typecheck` and `pnpm test` (1089 tests) were
  green at the end of the session.
- **What was walked in a browser and what was only read.** No dev server was
  listening on port 3000 during the session and the rules forbid starting one, so
  the Next route itself, the Convex wiring, the owner panel and the Sharing tab
  button were verified by reading the code and by typecheck only. The sheet was
  walked in Chromium via Playwright on a static fill of the component's markup under
  the real `poster.css` (`.scratch/poster/route-check.mjs`, gitignored, renders
  beside it): an English and an Urdu poster opened at 1080 x 1350 with 74 and 69 px
  of slack under the footer, Urdu mirrored under `dir="rtl"` in Noto Naskh Arabic;
  one PNG rasterised with html-to-image at pixelRatio 2 measured 2160 x 2700 with
  the fonts, logo and QR embedded; the print preview under the CSS page box gave a
  single page in both languages (it was two pages until the print rules took the
  page chrome out of flow, fixed the same session). Still to be seen by a human in
  the running app: the owner panel, the emphasis selection, and whether the tenant
  logo's Convex storage URL allows the cross-origin fetch the rasteriser needs (it
  falls back to an empty image slot if not).

## Not yet specified

- Whether owner-typed poster copy should persist and ride the translation
  pipeline. Left out of the spec on 2026-09-07; revisit once a second tenant asks.

## Out of scope

- Persisting or translating owner highlights, a second tenant logo asset, sheet
  sizes other than 1080 x 1350, a server-rendered OG image, and the seeded
  tenants' inverted state colours. See `spec.md`.
