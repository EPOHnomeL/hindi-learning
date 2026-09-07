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

## Not yet specified

- Whether owner-typed poster copy should persist and ride the translation
  pipeline. Left out of the spec on 2026-09-07; revisit once a second tenant asks.

## Out of scope

- Persisting or translating owner highlights, a second tenant logo asset, sheet
  sizes other than 1080 x 1350, a server-rendered OG image, and the seeded
  tenants' inverted state colours. See `spec.md`.
