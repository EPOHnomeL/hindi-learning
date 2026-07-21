// Scratch eval: grade each model's lesson-1 translation against the source on
// objective fidelity signals. Deterministic; reuses the production reassembly +
// quiz-structure guard so a sonnet/opus output is scored exactly as prod would.
//   pnpm tsx scripts/xlate-grade.ts
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { swapBackStatic, quizStructureMatches } from "../convex/translate";

const SLUG = "prophetic-school";
const OUT = `topics/${SLUG}/eval`;
const LANGS = ["es", "fr", "af", "mg", "ur", "zu", "xh", "hi-Latn", "bn-Latn"];
const MODELS = ["gemini", "sonnet", "opus"] as const;
// Expected script per edition — used for leak detection.
const SCRIPT: Record<string, "latin" | "arabic"> = {
  es: "latin", fr: "latin", af: "latin", mg: "latin", zu: "latin", xh: "latin",
  "hi-Latn": "latin", "bn-Latn": "latin", ur: "arabic",
};

const sourceFull = readFileSync(`${OUT}/source.full.html`, "utf8");
const blocks: string[] = JSON.parse(readFileSync(`${OUT}/blocks.json`, "utf8"));

const STATIC = /<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi;
const stripFence = (s: string) => {
  const m = s.trim().match(/^```(?:html)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1]!.trim() : s.trim();
};
const tags = (h: string) => (h.match(/<([a-zA-Z][\w-]*)/g) ?? []).map((t) => t.slice(1).toLowerCase());
const count = (h: string, re: RegExp) => (h.match(re) ?? []).length;
const visible = (h: string) =>
  h.replace(STATIC, " ").replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ").trim();

// Script character tallies over visible text.
function scripts(text: string) {
  let latin = 0, deva = 0, beng = 0, arab = 0, other = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) latin++;
    else if (c >= 0x900 && c <= 0x97f) deva++;
    else if (c >= 0x980 && c <= 0x9ff) beng++;
    else if ((c >= 0x600 && c <= 0x6ff) || (c >= 0x750 && c <= 0x77f) || (c >= 0xfb50 && c <= 0xfdff) || (c >= 0xfe70 && c <= 0xfeff)) arab++;
    else if (/[A-Za-zऀ-৿؀-ۿ]/.test(ch)) other++;
  }
  return { latin, deva, beng, arab, other };
}

// Distinct 6-word English shingles from the source that survive verbatim in the
// output. Faithful translation → ~0 (proper nouns/titles are shorter than 6).
// The single most robust cross-language "did they leave English in?" signal.
function englishLeak(srcVis: string, outVis: string): { leaked: number; total: number; samples: string[] } {
  const words = srcVis.toLowerCase().split(" ").filter((w) => /[a-z]/.test(w));
  const shingles = new Set<string>();
  for (let i = 0; i + 6 <= words.length; i++) shingles.add(words.slice(i, i + 6).join(" "));
  const out = " " + outVis.toLowerCase() + " ";
  const samples: string[] = [];
  let leaked = 0;
  for (const s of shingles) {
    if (out.includes(" " + s + " ")) { leaked++; if (samples.length < 3) samples.push(s); }
  }
  return { leaked, total: shingles.size, samples };
}

// Verse text lives in <div class="hi">…</div> inside each .verse block (no nested
// div). Stripping these isolates BODY-PROSE leak from Scripture handling, which is
// a separate fidelity dimension (translate via published Bible, or leave in source).
const HI = /<div class="hi"[^>]*>[\s\S]*?<\/div>/gi;
const stripVerses = (h: string) => h.replace(HI, " ");
// The English verse texts in the source (for detecting "left in English").
const srcVerses = (sourceFull.match(HI) ?? []).map(visible);
function versesLeftEnglish(html: string): number {
  const outVerses = (html.match(HI) ?? []).map(visible);
  let eng = 0;
  for (const ov of outVerses) {
    const ow = " " + ov.toLowerCase() + " ";
    // A verse is "still English" if it reproduces a 6-word run from any source verse.
    const isEng = srcVerses.some((sv) => {
      const w = sv.toLowerCase().split(" ").filter((x) => /[a-z]/.test(x));
      for (let i = 0; i + 6 <= w.length; i++) if (ow.includes(" " + w.slice(i, i + 6).join(" ") + " ")) return true;
      return false;
    });
    if (isEng) eng++;
  }
  return eng;
}

const srcVis = visible(sourceFull);
const srcBodyVis = visible(stripVerses(sourceFull));
const srcTags = tags(sourceFull);
const srcStatic = (sourceFull.match(STATIC) ?? []);
const srcMarks = { dc: count(sourceFull, /data-correct=/g), da: count(sourceFull, /data-answer=/g), dk: count(sourceFull, /data-k=/g) };
const srcCards = { quiz: count(sourceFull, /class="quiz"/g), opt: count(sourceFull, /class="opt"/g), verse: count(sourceFull, /class="verse"/g), footer: count(sourceFull, /<footer/g) };

type Row = Record<string, unknown>;
const rows: Row[] = [];

for (const model of MODELS) {
  for (const lang of LANGS) {
    const strippedPath = `${OUT}/${model}/${lang}.stripped.html`;
    const fullPath = `${OUT}/${model}/${lang}.html`;
    let full: string | null = null;
    let reassembleOk = true;
    if (existsSync(fullPath)) {
      full = readFileSync(fullPath, "utf8"); // gemini: already-assembled shipped HTML
    } else if (existsSync(strippedPath)) {
      const raw = stripFence(readFileSync(strippedPath, "utf8"));
      full = swapBackStatic(raw, blocks); // sonnet/opus: reassemble like prod
      reassembleOk = full !== null;
    } else {
      rows.push({ model, lang, MISSING: true });
      continue;
    }
    if (full === null) { rows.push({ model, lang, reassembleOk: false, verdict: "FAIL(reassemble)" }); continue; }

    const quizOk = quizStructureMatches(sourceFull, full);
    const m = { dc: count(full, /data-correct=/g), da: count(full, /data-answer=/g), dk: count(full, /data-k=/g) };
    const cards = { quiz: count(full, /class="quiz"/g), opt: count(full, /class="opt"/g), verse: count(full, /class="verse"/g), footer: count(full, /<footer/g) };
    const outTags = tags(full);
    const tagDelta = outTags.length - srcTags.length;
    const outStatic = (full.match(STATIC) ?? []);
    const staticVerbatim = outStatic.length === srcStatic.length && outStatic.every((b, i) => b === srcStatic[i]);
    const vis = visible(full);
    const sc = scripts(vis);
    const expected = SCRIPT[lang]!;
    // Leak of the wrong script (into the target's expected script).
    const scriptLeak = expected === "latin" ? sc.deva + sc.beng + sc.arab : sc.latin - properNounAllowance(sc);
    const leak = englishLeak(srcVis, vis);
    const bodyVis = visible(stripVerses(full));
    const bodyLeak = englishLeak(srcBodyVis, bodyVis);
    const versesEng = versesLeftEnglish(full);
    const lenRatio = +(vis.length / srcVis.length).toFixed(2);

    rows.push({
      model, lang,
      reassembleOk, quizOk,
      marksOk: m.dc === srcMarks.dc && m.da === srcMarks.da && m.dk === srcMarks.dk,
      cardsOk: cards.quiz === srcCards.quiz && cards.opt === srcCards.opt && cards.verse === srcCards.verse && cards.footer === srcCards.footer,
      tagDelta,
      staticVerbatim,
      engLeak: leak.leaked,
      bodyLeak: bodyLeak.leaked,
      versesEng,
      wrongScript: expected === "latin" ? sc.deva + sc.beng + sc.arab : 0,
      arabChars: sc.arab, latinChars: sc.latin, devaChars: sc.deva, bengChars: sc.beng,
      lenRatio,
      _leakSamples: leak.samples,
    });
  }
}

// For Arabic-script ur, some Latin is legitimate (proper nouns, refs); we report
// raw counts and let engLeak (6-word) carry the untranslated-prose signal instead.
function properNounAllowance(_sc: { latin: number }) { return 0; }

writeFileSync(`${OUT}/scorecard.json`, JSON.stringify(rows, null, 2));
console.log(`source: tags=${srcTags.length} static=${srcStatic.length} marks=${JSON.stringify(srcMarks)} cards=${JSON.stringify(srcCards)} engShingles=${new Set(srcVis.toLowerCase().split(" ")).size}\n`);
const H = ["model", "lang", "reasm", "quiz", "marks", "cards", "tagΔ", "static", "bodyLeak", "vrsEng", "wrongScr", "lenR"];
console.log(H.map((h) => h.padEnd(9)).join(""));
for (const r of rows) {
  if (r.MISSING) { console.log(`${String(r.model).padEnd(9)}${String(r.lang).padEnd(9)}MISSING`); continue; }
  const cell = (v: unknown) => (typeof v === "boolean" ? (v ? "ok" : "X") : String(v ?? "")).padEnd(9);
  console.log([r.model, r.lang, r.reassembleOk, r.quizOk, r.marksOk, r.cardsOk, r.tagDelta, r.staticVerbatim, r.bodyLeak, `${r.versesEng}/3`, r.wrongScript, r.lenRatio].map(cell).join(""));
}
