# The `st` → `st-ZA` orthography transform — rules, and what counts as content

Written 2026-08-02 while resolving
[ticket 06](../tickets/06-sesotho-za-from-lesotho-clone.md). This is the input the
review pass argues with; nothing here is settled until the ledger has been read.

## Why a deterministic script, not a model pass

The hindi-devanagari-edition precedent
([02-conversion-prompt.md](../../hindi-devanagari-edition/assets/02-conversion-prompt.md))
sent whole lesson documents to `gemini-3.1-flash-lite` and it held 4/4. That job was a
**script conversion** — Latin → Devanagari is a whole-alphabet rewrite where every word
changes and no diff is reviewable, so a model was the only option and the check had to be
structural (tag counts, quiz guard, placeholder round-trip).

`st` → `st-ZA` is the opposite shape. Lesotho and South African Sesotho share an alphabet;
only a handful of digraphs differ, so **most words do not change at all** and the ones that
do change in a small number of regular ways. That makes the change set finite and
enumerable — which is exactly what ticket 06's "review-before-write" demands and what a
model pass destroys. The user also asked for local and on their PC.

So: a deterministic transform, and the review artifact is not the diff of 56 documents but a
**word ledger** — every distinct `before → after` word pair, with its occurrence count and
one example context. Two hundred lines a human can actually read, not thirty thousand.
Findings from the ledger go back in as an **overrides table**, and the script re-runs.

**The ledger alone is not enough, and this is the easy thing to get wrong.** A ledger of
`before → after` pairs can only expose a rule that fired *too eagerly*. It is structurally
blind to a rule that is **missing** — a Lesotho spelling that no rule matched never appears
in it at all, so a silent under-transform reads exactly like a clean run. So the dry run
emits a second file, `untouched.tsv`: every distinct word the transform left alone, by
frequency. The reviewer scans it for residual Lesotho spellings and each one found becomes a
new rule. That blindness is not hypothetical — rule 3b below was missing until a word was
checked by hand.

## The correspondences

Ticket 06 tabulated `li-` → `di-`. That undersells the rule and would miss real words.

| # | Lesotho | South Africa | note |
|---|---|---|---|
| 1 | `l` before `i`/`u` | `d` | **not just `li-`.** Sesotho realises /l/ as [d] before close vowels; Lesotho spells the phoneme, SA spells the sound. `lumela` → `dumela`, `Molimo` → `Modimo`, `lipalo` → `dipalo`. Must **not** fire inside the digraphs `hl`, `tl`, `kl`. |
| 2 | `ea` | `ya` | `ea ka` → `ya ka`, `boea` → `boya` |
| 3 | `oa` | `wa` | `oa hae` → `wa hae`, `ntoa` → `ntwa` |
| 3b | `oe` | `we` | same glide, other vowel: `Loetse` → `Lwetse`, `khoeli` → `kgwedi` (with rules 4 and 1). **This rule was missing from ticket 06's table** and only surfaced when `khoeli` was hand-checked and came back `kgoedi`. |
| 4 | `kh` | `kg` | `khotso` → `kgotso` |
| 5 | `ch` | `tjh` | `chelete` → `tjhelete` |
| 6 | `ts'` / `tš` | `tsh` | ejective apostrophe is dropped |
| 7 | `th'` | `th` | ditto |
| 8 | `'m` / `'n` (syllabic nasal) | `mm` / `nn` | `'me` → `mme`, `'na` → `nna` |

Ordering matters: run the apostrophe rules (6–8) before the digraph rules, and rule 1 last —
otherwise `ch` → `tjh` re-exposes an `h` to rule 4, and so on. The script fixes an order and
the ledger is the evidence it was the right one.

Rules 1–8 pass a 19-case check of known Lesotho/SA word pairs, including six words that must
**not** change (`hlile`, `tlisa`, `batho`, `Jesu`, `sepheo`, `moklise`) —
[06-rules-check.mjs](06-rules-check.mjs), run it with `node`. Add a case to it before you add
a rule.

**Rules 4 and 5 are the ones with a tail.** `kh` survives in loanwords and some proper
nouns; `ch` appears in untranslated English left standing in the body (see the hindi map's
[ticket 06](../../hindi-devanagari-edition/tickets/06-inherited-english-repair-flag-or-ship.md)
— the same source-English leak exists here). Expect the ledger's rejects to cluster there.

## What is content, and what is markup

Ticket 06 warns that "attributes are always skippable" is false. Confirmed by inventorying a
real lesson document — these are the attributes carrying prose or learner-visible strings:

| attribute | content? | why |
|---|---|---|
| `data-no`, `data-ok` | **yes** | quiz feedback prose, shown to the learner |
| `data-answer` | **yes** | the expected free-text answer, matched against what the learner types — if the learner is reading SA orthography they will type SA orthography |
| `data-alt` | **yes** | accepted alternative answer, same reason |
| `alt`, `placeholder`, `title`, `aria-label` | **yes** | learner-visible |
| `data-correct` | no | a letter (`a`/`b`/`c`) |
| `data-k`, `data-theme`, `class`, `style`, `href`, `rel`, `id` | no | machinery |
| `lang` | **special** | `st` → `st-ZA`, set literally, not transformed |

`<style>` and `<script>` bodies are removed entirely before the transform via
`swapOutStatic` ([convex/translate.ts:912](../../../../convex/translate.ts#L912)) and restored
after, so the CSS/JS is untouchable by construction — the same protection the hindi run used.
HTML entities (`&nbsp;`, `&#8217;`) are swapped out the same way: without that, the word
matcher reads `nbsp` as a Sesotho word and rule 1 turns it into `nbsp` → … nothing today, but
it is a live foot-gun the moment a rule touches `n`.

## The write path — settled, with evidence

Read from the code on 2026-08-02, answering ticket 06's open questions:

- **`publishTranslation` is the right seam.** It does **not** skip on an unchanged English
  source — the only skips are "no job", "no source row" and a lesson quiz-marker drift
  ([convex/translate.ts:612-624](../../../../convex/translate.ts#L612-L624)). It stamps the
  *current* English hash, which is what these rows should carry.
- **It solves the shared-blob trap for free.** The row it builds has no `htmlStorageId` field
  and it lands via `ctx.db.replace` ([convex/translate.ts:660](../../../../convex/translate.ts#L660)),
  so replacing a cloned blob-backed row **drops the inherited storage id** and stores the body
  inline. The `st` blob is never opened for writing and never dereferenced.
  → **Corollary the build must not miss:** a cloned row we never publish keeps the shared
  `htmlStorageId`. So publish **every** body-bearing row, including ones the transform left
  byte-identical — otherwise "no `st-ZA` row shares an `htmlStorageId` with an `st` row"
  fails on exactly the rows that happened not to change.
- **The quiz guard compares against the English source**, not against `st`
  ([convex/translate.ts:622](../../../../convex/translate.ts#L622)). Since `st` passed that same
  guard when it was translated, and the transform never touches `data-correct`/`data-answer`
  *counts*, it should pass — but a `skipped` in the publish log means a silent English
  fallback for that lesson and has to be treated as a failure, not noise.

## Access — do not use the Convex CLI

`.env.local` pins a dev `CONVEX_DEPLOY_KEY` that **beats `--prod`**, so `npx convex data --prod`
and `npx convex run --prod` answer for dev while looking exactly like prod
([marketplace/tickets/10](../../marketplace/tickets/10-build-donate-route.md)). Every prod script
in this repo already sidesteps this: `ConvexHttpClient(convexUrl(true))` reads `CONVEX_PROD_URL`
from `.env.local` and never involves the CLI or the deploy key
([scripts/_env.ts:26](../../../../scripts/_env.ts#L26)). The transform script does the same.
