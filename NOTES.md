# Working Notes

## Teaching preferences (Jonathan)
- **Reads Devanagari fluently.** Never re-teach the script. (See LR-0001.)
- **Transliteration: minimal.** Devanagari first; Roman spelling only for tricky
  pronunciation, never as the default. Wean off entirely over time.
- Wants frequent, short lessons grounded in the Bible (devotional register).
- Goal is reading comprehension first, conversation second.
- **Lean hard on the handbook's grammar sections.** Jonathan finds them very
  valuable and explicitly wants them incorporated — quoting the handbook's own
  wording (even near word-for-word) where it explains a rule cleanly, with a
  page citation. Don't paraphrase grammar into vagueness; reproduce the handbook's
  precise framing, then apply it to the Bible verse. (Feedback after Lesson 1.)

## How this workspace works
- Two anchor sources: `Handbook.pdf` (Snell & Weightman, *Teach Yourself Hindi*)
  and the BSI OV Hindi Bible. Cite both in lessons.
- The handbook is a **scanned PDF with no text layer**. To read it, render pages:
  `python scripts/render_pages.py <printed_page/2 + ~4> ...` — each PDF page is a
  **two-page spread** (≈ printed pages 2N-1 and 2N). Rough map: printed page P →
  PDF page ≈ round(P/2)+4. Rendered PNGs land in `scripts/_pages/` (gitignored-ish,
  scratch only).
- Handbook chapter map (printed pages): Ch.1 Script pp.5–18 · Ch.7 Present
  habitual pp.73–77 · Ch.8 Imperfect/past-of-"to be"/obligation pp.86+ · Ch.9
  Present continuous + future pp.98+ · Ch.10 Subjunctive pp.111+ · Ch.11
  Perfective/past pp.135+ · Ch.13 Relative clauses pp.161+ · Ch.14 Passive pp.176+.

## Lesson-build conventions
- Self-contained HTML, opens in a browser. Load Noto Sans/Serif Devanagari from
  Google Fonts with a system fallback so verses render even offline-ish.
- Every grammar claim cites a handbook page; every verse cites book/chapter/verse.
- Interactive checks must give **immediate** feedback in-browser (no server).
- End each lesson with a nudge to ask me (their teacher) follow-up questions.

## Open threads / next ZPD steps
- Lessons 1–6 done: Psalm 1:1–1:4 read end-to-end. Covered: habitual (sg+pl
  agreement), oblique+postpositions, का/के/की, जो/correlative, करता रहता है,
  के समान. (See LR-0001…0004.)
- **The passive** (लगाया गया है v3, उड़ाई जाती है v4) is the one parked skill,
  teased twice. Hook: से = "by" (just met in पवन से). Bigger jump (handbook Ch.14).
- **Feminine habitual** (-ती है/हैं) is the missing half of agreement — wait for a
  feminine subject in a verse before teaching it.
- **Psalm 1:5–6** finish the psalm (the mission's first waypoint): future/subjunctive
  (रह सकेंगे, ठहरेंगे) and the closing contrast (जानता है … नाश हो जाएगा).
- Find a BSI OV audio source for read-aloud anchoring (RESOURCES gap).
