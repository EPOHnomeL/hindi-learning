---
type: task
blocked_by: []
---
# Settle what language Bishop Ndumisa actually translates

## Question

The roster row reads **"Northern Mathebele"**, with a note already flagging it:
*"Listed as 'Northern Mathebele' - confirm language; email surname differs from name"*.
The translator is **Bishop Ndumisa**, at `bishopkhumalo.ccmi@gmail.com`.

Two codes in `convex/languages.ts` are candidates, and they are different languages:

- **`nd`** — "Northern Ndebele (Matabele)", spoken in **Zimbabwe**. The label matches
  this one almost word for word.
- **`nr`** — "Southern Ndebele (isiNdebele)", one of **South Africa's** official
  languages. The geography of a Potchefstroom-based school points here.

Nobody in the repo can settle it, which is why 01 imports this row with a **null**
`lang` and the report renders it as unresolved. Ask the Bishop.

The second half of the note is worth resolving in the same conversation: the email
address says *Khumalo* while the roster says *Ndumisa*, so one of the two is wrong, or
one is a first name and the other a surname.

## Done when

- The Bishop has confirmed which language he translates, and the answer is recorded here
  with the date asked.
- The `translators` row on prod carries the settled code, and the display name is
  corrected if the Khumalo/Ndumisa question resolved that way.
- If the answer is a language **not** in `LANGUAGES`, extend that list rather than
  forcing the nearest code (the file's own comment says extending the menu needs no
  other change).
- The map's Notes language-codes paragraph is corrected in the same edit.
