---
type: research
blocked_by: []
---

# Get a Sesotho speaker's verdict on the st→st-ZA rewrite before it is published

> `/wayfinder .plan/maps/course-translation/tickets/07-sesotho-translator-verdict-on-the-ledger.md`

## Question

[Ticket 06](06-sesotho-za-from-lesotho-clone.md) built and ran the Lesotho→South African
orthography transform over the whole `prophetic-school` course. It is **finished and
verified structurally** — 57/57 documents intact — and it is **not published**, because the
one thing it cannot do is check its own Sesotho. Every rule in it was inferred from
frequency, word shape and general Bantu orthography by an agent that does not speak the
language.

The user is asking a translator. This ticket is the question put to them, and the place
their answer lands.

The artifact to review is the ledger — **every distinct word the transform changed**, most
frequent first, with an example of its context:

```
.plan/maps/course-translation/assets/06-ledger.tsv
```

1569 rows, but the distribution is steep: the top ~50 cover the overwhelming bulk of the
text. Regenerate it (plus `untouched.tsv`) any time with
`pnpm tsx scripts/st-za-rewrite.ts --topic prophetic-school`.

### Q1 — are the eight correspondences right?

| # | Lesotho | → SA | example from the course |
|---|---|---|---|
| 1 | `l` before `i`/`u` | `d` | `Molimo` → `Modimo`, `lipalo` → `dipalo`, `lula` → `dula` |
| 2 | `ea` | `ya` | `ea` → `ya` (3466×), `tsamaea` → `tsamaya` |
| 3 | `oa` | `wa` | `oa` → `wa` (1035×), `moea` → `moya` |
| 3b | `oe` | `we` | `lentsoe` → `lentswe`, `qotsitsoe` → `qotsitswe` |
| 4 | `kh` | `kg` | `khotso` → `kgotso`, `bokhoni` → `bokgoni` |
| 5 | `ch` | `tjh` | `chelete` → `tjhelete`, `sechaba` → `setjhaba`, `tichere` → `titjhere` |
| 6 | `ts'` / `š` | `tsh` / `sh` | `ts'oanang` → `tshwanang`, `tšabo` → `tshabo` |
| 7 | `th'` | `th` | — |

Rule 1 is deliberately **not** applied inside `hl`/`tl`/`kl` (`hlile`, `tlisa` stay put) —
please confirm that is right.

### Q2 — is `oe → we` correctly blocked after `bo-`/`mo-`?

The rule fires everywhere **except** where the word starts `bo-` or `mo-`, on the reasoning
that there the `o` is a class prefix and no glide exists. So:

- **changed:** `lentsoe` → `lentswe`, `boloetse` → `bolwetse`, `khoeli` → `kgwedi`
- **left alone:** `boemo`, `boetapele`, `boeona`, `boemong`, `moelelo`, `moeeng`

Is `moeeng` (49×, locative of `moea`) right to stay, or should it be `moyeng`?

### Q3 — the apostrophe. This is the one most likely to be wrong.

A leading `'` in this text is doing two unrelated jobs and nothing in the spelling separates
them: the **syllabic nasal** (`'me` → `mme`) and an ordinary **opening quotation mark**
(`'Molimo o mpolletse…` — where `Molimo` must stay `Modimo`, not become `Mmodimo`).

Guessing wrong in either direction is bad, so the transform only doubles words on a list.
**Please mark each of these as nasal or quote.**

Currently treated as a **syllabic nasal** (doubled):

| word | → | count |
|---|---|---|
| `'me` | `mme` | 595 |
| `'ngoe` | `nngwe` | 398 |
| `'nete` | `nnete` | 282 |
| `'na` | `nna` | 109 |
| `'mele` | `mmele` | 44 |
| `'ne` | `nne` | 23 |
| `'meli` | `mmedi` | 20 |
| `'meleng` | `mmeleng` | 14 |
| `'maloa` | `mmalwa` | 10 |
| `'mapa` | `mmapa` | 9 |
| `'moho` | `mmoho` | 6 |
| `'matla` | `mmatla` | 4 |
| `'neteng` | `nneteng` | 3 |
| `'mino` | `mmino` | 3 |

Currently treated as a **quote mark** (apostrophe kept, word otherwise converted normally):

`'Morena` `'Molimo` `'Mohau` `'Moya` `'mokgwa` `'molai` `'moruti` `'mesebetsi` `'Molao`
`'Mokreste` `'Mekotla` `'maikarabelo` `'Meya` `'Motsomabesa` `'moforo` `'Nna` `'nne`
`'mmele` `'muso` `'mpho` `'nè` `'Nthlohonolofatse`

Note `'muso` and `'mpho` are on the *quote* side and `'mino`/`'matla` on the *nasal* side —
that split is a guess and may well be backwards.

### Q4 — two single-word calls

- `holim'a` → **`hodima`** (362×). Is closing up the elision right, or does SA keep an
  apostrophe?
- `Mohloli` → **`Mohlodi`** (80×, "source", in the footer of every lesson).

### Q5 — the untranslated English

The Lesotho Edition already contains English that was never translated: whole scripture
quotations, `Check`, `Glossary`, `Sources — Scripture:`, `Prophetic School`. The transform
**deliberately leaves it alone** (it was turning `Christ` into `Tjhrist`), so `st-ZA` will
inherit exactly the English `st` has today — no better, no worse.

Is shipping that acceptable for this Edition, or does the English need translating first?
This is the same defect as
[hindi-devanagari-edition/06](../../hindi-devanagari-edition/tickets/06-inherited-english-repair-flag-or-ship.md)
— if the answer is "repair it", the two should be decided together rather than twice.

## Done when

Q1–Q5 each have an answer from someone who reads Sesotho, recorded in `## Answer` below,
concrete enough that ticket 06's build session can edit `RULES`, `SYLLABIC` and `OVERRIDES`
in [scripts/st-za-rewrite.ts](../../../../scripts/st-za-rewrite.ts) without re-asking. A
"yes, all correct" is a complete answer — it just has to come from a person, not an
inference.

## Notes for whoever relays this

- **`st-ZA` is already live on prod holding LESOTHO text** (the clone step ran). It has one
  share and no public link or listing. If the translator will be a while, consider whether
  to leave it visible or tear it down with `removeEdition` and re-clone later.
- The translator does not need the repo. The ledger is a TSV — open it in a spreadsheet, and
  the `example` column gives each word in context.
- Don't paraphrase Q3 into "check the apostrophes". The nasal/quote split is the specific
  thing, and the two tables are the specific ask.
