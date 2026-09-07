# Course poster template: slot contract

`poster-template.html` beside this file is the hand-made ywampotch sheet
(`.scratch/poster/poster.html`, 2026-09-03 to 2026-09-07) with every course- and
tenant-specific value lifted out into a `{{slot}}`. This table says where each slot
is filled from. "Data" means the platform already holds it; "chrome" means fixed
copy that ships in `messages/<locale>.json`; "authored" means the owner types it
in the poster panel for this render.

Checked on 2026-09-07 by filling the template with the ywampotch values and
rendering it beside the original (`.scratch/poster/template-en.png`,
`template-ur.png`, both gitignored): the English sheet is the poster, the Urdu
sheet mirrors correctly under `dir="rtl"` with Noto Naskh Arabic.

| Slot | Kind | Source | Notes |
|---|---|---|---|
| `lang`, `dir`, `script` | data | `publicCourse.lang`, `publicCourse.dir`; script from `isDevanagari` / `isRtl` in the languages module | `script` is `latn`, `deva` or `arab` and only swaps the serif face |
| `logoUrl` | data | `tenantTheme.getTheme(tenantSlug).logoUrl` | Any aspect, contained in a 150 x 420 box. Absent logo: the display name as a serif wordmark. Default-site course: the shipped book mark plus "My Course" |
| `tenantName`, `tenantMotto` | data | `displayName`, `motto` from the same theme read | Footer wordmark. The hand-made sheet used a second raster banner here; the platform holds one logo asset per tenant, so the footer is text |
| palette | data | the tenant's 14 light tokens: `paper`, `hi`, `accent`, `accent2`, `gold`, `soft`, `card` | Mapping is in the template's `:root` comment. Default site uses the app's default palette |
| `eyebrow` | chrome | `Poster.eyebrowPaid` when `paywall.previewKey` is set, `Poster.eyebrowFree` on a free Edition | "Online course · First lesson free" / "Online course · Free" |
| `titleHtml`, `titleLen` | data + authored | `publicCourse.title`; the owner may select a run of words to italicise | `titleLen` is `""`, `long` (over 34 chars) or `xlong` (over 52) and only sets the font size |
| `tagline` | data + authored | `publicCourse.mission` in the Edition language (English fallback), owner may overwrite for this render | Hidden when null and not overwritten |
| `points` (up to 3) | authored + data | Owner highlights (0 to 2) first, then derived facts to fill to three: `{n} lessons` from `publicCourse.lessons.length`, "Certificate on completion" when the tenant's `certificates` flag is on, "Read it on your phone, offline" | The hand-made sheet's "about 10 minutes each" has no data behind it and is dropped |
| `qrDataUrl`, `qrAlt` | data | `qrcode.toDataURL(publicCourseUrl(token, tenantSlug), { width: 600, margin: 2 })` | Same encoder and margin as the Sharing tab's QR download |
| `ctaKicker`, `ctaTitle`, `ctaOr` | chrome | `Poster.ctaKicker`, `Poster.ctaTitle`, `Poster.ctaOr` | |
| `host` | data | canonical host for the course's tenant, from the same helper that builds the public URL | Always LTR, isolated |
| `priceLabel`, `priceSuffix` | data + chrome | `paywall.amount` / `paywall.currency` formatted with `Intl.NumberFormat`, suffix `Poster.priceSuffix` | Whole block hidden on a free Edition |
| `langsLine1`, `langsLine2` | data + chrome | count and native names of the Edition's live sibling languages (ready, and public or published) | Needs one new field on the Guest read: `publicCourse.languages` |

## What was in the hand-made poster and is not in the template

- **The YWAM banner in the footer.** Two logo files exist only as loose files under
  `public/`; the tenant record holds one logo. Footer is the display name.
- **"56 short lessons, about 10 minutes each."** Lesson count is data; the duration
  is not. Only the count survives.
- **"Available in 25 languages · English · Afrikaans and 23 more."** Unverified
  from this checkout (prod is not readable here, see `project-context.md`). The
  dashboard code comments on 2026-09-01 speak of five machine-translated
  Editions of `prophetic-school`. The slot is data-driven so the sheet prints
  whatever is live.
- **R100.** The listing amount is a row in `listings`, so the template reads it
  rather than hardcoding it.
