# Findings — copyright scan of "Basic Tswana" (ywampotch)

**Scanned:** prod Convex deployment (`capable-barracuda-769`), topic
`kh7ax1d2my3knfknds0j30d7d58a7bgz` ("Basic Tswana", slug `basic-tswana`,
tenant `ywampotch`, status `completed`) — all 32 lessons + the 1 reference
(`glossary`). See `HANDOFF-tswana-scan.md` for how the prod data was reached.

**Method:** 8 parallel scans, one per cited source (or source cluster),
each fetching the live source page/PDF and diffing it against the course's
own prose (paragraphs, `.note`/`.verse`/`.park` blocks — vocabulary tables
and `.word`/`.grid2`/`table.paradigm` glossary cells were excluded per the
copyright framework in the handoff doc). 18 distinct source URLs across
9 site families were covered.

## Bottom line

Out of 32 lessons + the glossary, **one lesson has real findings** —
everything else is clean. The course is well-disciplined about citing
facts rather than copying wording; the one weak spot is small and easy
to fix.

**Status: fixed and published to prod (2026-07-23).** All three spans
below were rewritten and shipped live via the normal supersede pipeline —
`0023-o-tsogile-jang` (key) is now superseded by `0023-o-tsogile-jang-2`,
same seq (23), citations kept, quiz untouched. Verified against the live
`/content` blob after publish.

## Findings

### Lesson 23 — `o-tsogile-jang` (2 findings, same lesson)

**1. UNISA sentence lifted verbatim, presented as the course's own voice (highest priority)**

> Course (§lead paragraph, *not* in quotation marks):
> "...and it is considered ill-mannered to pass someone without one."

> UNISA, *Learn online Setswana* — Theme 1:
> "...and it is considered ill-mannered not to greet either a friend or a
> stranger in passing."

Same sentence skeleton and most of the wording, but not quoted — reads as
the course's own explanatory prose. UNISA's material is © coursework, not
public domain, so this needs a genuine paraphrase (the rest of the lesson's
prose, e.g. "Setswana greetings quietly carry the time of day...", shows
the author can do this well elsewhere).

**2. UNISA sentence lifted verbatim, but in quotes and cited (lower priority)**

> Course: *"You should also take the time to enquire about the other
> person's well-being."* (in italics/quotes, cited to UNISA Theme 1)

> UNISA: "...You should also take the time to enquire about the other
> person's well-being."

Character-for-character, but presented as an attributed quotation, not
silently absorbed. Lower legal risk than #1, but a full lifted sentence —
recommend paraphrasing into indirect style rather than quoting UNISA at
length, since the course doesn't need to as its own sentences elsewhere
cover the same ground.

**3. setswana.info sentence quoted at full length (lower priority, same lesson, §4)**

> Course: *"As an alternative to 'tsogile' (woke up), in the afternoon
> 'tlhotse' (spent the day), and in the early morning 'robetse' (slept)
> can be used."* (quoted, cited to setswana.info — Greetings)

setswana.info is an ordinary © website (not CC-licensed as far as either
scan could tell), so a full-sentence direct quote — even attributed — is
worth trimming to a paraphrase for the same reason as #2: the course
already restates this fact in its own words earlier in the same section
("Swap tsogile for the right one and everything else is identical").

**Recommended fix for all three:** rewrite the `<p class="lead">` and the
`<p class="cite">` in §4 of `0023-o-tsogile-jang.html` in the author's own
words (the lesson already models good practice elsewhere — see the
"quietly carry the time of day" paragraph). Keep the citation links; drop
the quotation marks and the copied sentence structure.

## Everything else: no findings

| Source | License class | Lessons checked | Result |
|---|---|---|---|
| Wikipedia (Tswana language) | CC BY-SA | 0003, glossary | Clean — cited only for bare IPA facts, no prose overlap |
| Wikivoyage (Tswana phrasebook) | CC BY-SA | 0009,0011,0012,0013,0014,0021,0029,0030,0031, glossary | Clean — Wikivoyage page itself has almost no prose to copy; course citations are phrase-fact lookups |
| UNISA Theme 1 & 3 (PDF) | © coursework | 0001,0006,0007,0008,0010,**0023**,0025,0026, glossary | Findings in 0023 only (above); rest are original paraphrase |
| setswana.info (5 wiki pages) | © website | 0001,0002,0003,0004,0005,0006,0007,0010,0016,0017,**0023**,0024, glossary | Finding in 0023 only (above); rest are original paraphrase or short attributed quotes under a sentence |
| Omniglot | © all rights reserved | 0001,0002,0004,0005,0015,0016,0029,0030, glossary | Clean — all citations are bare phrase-translation facts, no commentary copied |
| Glosbe / sadictionaries / languagesandnumbers.com | facts/DB | 0009,0010,0017,0018,0019, glossary | Clean — word/number facts only; one short (<1 sentence) quoted+attributed fragment from Glosbe, not a finding |
| safari.com blog | © all rights reserved | 0015, glossary | Clean — page is a phrase list, no prose to copy |
| archive.org "Setswana Grammar Manual" | PD-marked (volunteer-authored, Peace Corps-adjacent — see note) | 0015,0016,0017,0018,0020,0021, glossary | Clean — short quoted+attributed grammar-rule fragments only |
| Peace Corps (files.peacecorps.gov / livelingua.com mirror) | US-Gov public domain | 0027,0028, glossary | Confirmed genuinely PD (verified against a third mirror); verbatim overlaps found are legally safe regardless |

## One non-blocking note

The archive.org "Setswana Grammar Manual" is volunteer-authored (Art
Chambers, a Peace Corps SA16 volunteer; revised by Ryan Cooper) and marked
"Public Domain Mark 1.0" by the Archive.org uploader — it is **not**
literally a US-federal-government work like the other Peace Corps PDF the
course also cites separately. Risk is low either way (explicit PD mark,
no restrictive notice found), but if the course's own footer/citation
wording ever implies "Peace Corps government material" for this specific
source, it would be more precise to say "Public Domain Mark per
Archive.org." Not a copyright problem — just a precision note.

## What this means for selling the course

Per the copyright reasoning already given to the user: apart from the two
sentences in Lesson 23, nothing here would force ShareAlike exposure (no
real CC BY-SA prose lift found) and nothing else rises to a real
verbatim-prose finding. Paraphrase the three spans in
`0023-o-tsogile-jang.html` and the course is clear to sell.
