// Scratch eval: merge blind judge verdicts (de-anonymized via judge-map.json) with
// the mechanical scorecard into a per-language model comparison + overall trends.
import { readFileSync, existsSync, writeFileSync } from "node:fs";

const SLUG = "prophetic-school";
const OUT = `topics/${SLUG}/eval`;
const LANGS = ["es", "fr", "af", "mg", "ur", "zu", "xh", "hi-Latn", "bn-Latn"];
const MODELS = ["gemini", "sonnet", "opus"] as const;

const map = JSON.parse(readFileSync(`${OUT}/judge-map.json`, "utf8")) as Record<string, Record<string, string>>;
const mech = JSON.parse(readFileSync(`${OUT}/scorecard.json`, "utf8")) as Record<string, unknown>[];
const mechOf = (model: string, lang: string) => mech.find((r) => r.model === model && r.lang === lang)!;

type Cand = { accuracy: number; fluency: number; terminology: number; defects: string[] };
const proseScore: Record<string, Record<string, number>> = {}; // lang -> model -> avg
const proseRank: Record<string, Record<string, number>> = {}; // lang -> model -> rank(1=best)
const confidence: Record<string, string> = {};
const notes: Record<string, string> = {};
const defects: Record<string, Record<string, string[]>> = {};

for (const lang of LANGS) {
  const vf = `${OUT}/judge/${lang}.verdict.json`;
  if (!existsSync(vf)) { console.error(`missing verdict: ${lang}`); continue; }
  const v = JSON.parse(readFileSync(vf, "utf8")) as {
    confidence: string; candidates: Record<string, Cand>; ranking: string[]; notes: string;
  };
  confidence[lang] = v.confidence;
  notes[lang] = v.notes;
  proseScore[lang] = {}; proseRank[lang] = {}; defects[lang] = {};
  for (const [label, cand] of Object.entries(v.candidates)) {
    const model = map[lang]![label]!;
    proseScore[lang]![model] = +(((cand.accuracy + cand.fluency + cand.terminology) / 3)).toFixed(1);
    defects[lang]![model] = cand.defects;
  }
  v.ranking.forEach((label, i) => { proseRank[lang]![map[lang]![label]!] = i + 1; });
}

// ---- Per-language table ----
console.log("\n=== PROSE QUALITY (blind judge, avg of accuracy/fluency/terminology 1-10) ===\n");
console.log(["lang", "conf", "gemini", "sonnet", "opus", "winner"].map((h) => h.padEnd(10)).join(""));
const wins: Record<string, number> = { gemini: 0, sonnet: 0, opus: 0 };
for (const lang of LANGS) {
  if (!proseScore[lang]) continue;
  const s = proseScore[lang]!;
  const winner = MODELS.slice().sort((a, b) => (proseRank[lang]![a]! - proseRank[lang]![b]!))[0]!;
  wins[winner]!++;
  const fmt = (m: string) => `${s[m] ?? "?"}${proseRank[lang]![m] === 1 ? "*" : ""}`;
  console.log([lang, confidence[lang], fmt("gemini"), fmt("sonnet"), fmt("opus"), winner].map((c) => String(c).padEnd(10)).join(""));
}
console.log(`\nprose wins → gemini:${wins.gemini}  sonnet:${wins.sonnet}  opus:${wins.opus}  (* = judge's #1)`);

// ---- Mechanical fidelity summary ----
console.log("\n=== MECHANICAL FIDELITY (per model, summed across 9 langs) ===\n");
console.log(["model", "tagDropSum", "wrongScrSum", "versesEngSum", "bodyLeakSum", "allStructOk"].map((h) => h.padEnd(14)).join(""));
for (const model of MODELS) {
  let tagDrop = 0, wrongScr = 0, vEng = 0, bLeak = 0, structOk = 0;
  for (const lang of LANGS) {
    const r = mechOf(model, lang) as Record<string, unknown>;
    tagDrop += Math.max(0, -(r.tagDelta as number));
    wrongScr += r.wrongScript as number;
    vEng += r.versesEng as number;
    bLeak += r.bodyLeak as number;
    if (r.reassembleOk && r.quizOk && r.marksOk && r.cardsOk && r.staticVerbatim) structOk++;
  }
  console.log([model, tagDrop, wrongScr, `${vEng}/27`, bLeak, `${structOk}/9`].map((c) => String(c).padEnd(14)).join(""));
}

writeFileSync(`${OUT}/report.json`, JSON.stringify({ proseScore, proseRank, confidence, notes, defects, wins }, null, 2));
console.log("\nnotes per language:");
for (const lang of LANGS) if (notes[lang]) console.log(`  ${lang}: ${notes[lang]}`);
