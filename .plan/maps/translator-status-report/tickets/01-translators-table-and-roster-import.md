---
type: task
blocked_by: []
---
# Create the translators roster and import the fourteen rows

## Question

Nothing in the backend knows who is translating what. The roster lives in a
spreadsheet in the user's Obsidian vault at
`Work/10-YWAM-Potch/YWAM Potch Prophetic School - Translations.xlsx` (as of
2026-07-27), and **this repo is public**, so it cannot be mirrored into the tree.

Build the `translators` table and get those fourteen rows onto prod.

The table holds **identity only**, keyed **(tenant, language)** and unique, because it
is the future payee record (see 09):

| Field | Notes |
|---|---|
| tenant | the tenant this roster belongs to (`slug` or id, follow the house pattern) |
| lang | BCP-47 code, gated by `isKnownLang`. **Nullable**, for the unresolved Ndebele row |
| label | the human's own wording, verbatim: "Northern Mathebele", "Seswati", "Sotho" |
| displayName | "Bishop Ndumisa", "Wikus", "Beef" |
| email | **optional**. Zondi has none, and Wikus is in-house |
| notes | "confirm surname", "nickname only, confirm full name (Dlamini?)" |

The five chasing columns (`Status`, `Progress %`, `Date Sent`, `Date Returned`,
`Last Contact`) are **not imported** (map Notes): four are derived better and one is
read by nothing.

The rows, with codes settled in the charting grill:

`xh` Zondi (no email) · **unresolved** Bishop Ndumisa (label "Northern Mathebele",
see 10) · `nl` Joanne Tabak · `tn` Elias · `af` Wikus (no email, in-house) ·
`en` Wikus (source Edition, review only) · `fr` Marie Ketsia · `es` Carolina Galavis ·
`mg` Haritiana Randriamihaja · `zu` Beef · `st-ZA` Wanda · `ur` Stephness Prince ·
`ss` Johannes Wessels · `hi` Gideon

Note `en` is a legitimate row: English is the source Edition, so Wikus is reviewing
rather than translating, and the status ladder still reads sensibly against it.

## Done when

- `translators` is in `convex/schema.ts` with a unique-by-`(tenant, lang)` index, a
  schema comment in the house style explaining why it is tenant-keyed and why `lang`
  and `email` are nullable, and the usual "absent reads as" note.
- A `PUBLISH_SECRET`-guarded upsert exists (same trust model as
  `translate.readEditionBodies`), plus the owner-scoped mutation 03 will call.
- A one-off import script lands the fourteen rows on prod. It reads the xlsx from an
  **argument path**, never a committed copy, and **no name, email or note is ever
  written into a repo file** (that includes test fixtures: invent names there).
- `pnpm typecheck` and `pnpm test` green, with tests covering the unique constraint,
  the nullable `lang`, and the missing-email row.
- The map's Notes need no edit; this ticket changes no decision.
