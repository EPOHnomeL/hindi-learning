// Scratch eval: build blind prose-judging packets, one per language. Each packet
// has the source visible text + the 3 candidates as visible text, anonymized to
// A/B/C with a per-language rotation (kills systematic position bias). The mapping
// is recorded to judge-map.json so we can de-anonymize the verdicts afterward.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { swapBackStatic } from "../convex/translate";
import { langInfo } from "../convex/languages";

const SLUG = "prophetic-school";
const OUT = `topics/${SLUG}/eval`;
const LANGS = ["es", "fr", "af", "mg", "ur", "zu", "xh", "hi-Latn", "bn-Latn"];
const MODELS = ["gemini", "sonnet", "opus"] as const;
const blocks: string[] = JSON.parse(readFileSync(`${OUT}/blocks.json`, "utf8"));
const STATIC = /<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi;
const stripFence = (s: string) => { const m = s.trim().match(/^```(?:html)?\s*([\s\S]*?)\s*```$/i); return m ? m[1]!.trim() : s.trim(); };
const visible = (h: string) => h.replace(STATIC, " ").replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, "\n").replace(/&nbsp;/gi, " ").replace(/&[a-z]+;/gi, " ").replace(/\n{2,}/g, "\n").replace(/[ \t]+/g, " ").trim();

const loadFull = (model: string, lang: string): string | null => {
  const full = `${OUT}/${model}/${lang}.html`;
  if (existsSync(full)) return readFileSync(full, "utf8");
  const strp = `${OUT}/${model}/${lang}.stripped.html`;
  if (existsSync(strp)) return swapBackStatic(stripFence(readFileSync(strp, "utf8")), blocks);
  return null;
};

mkdirSync(`${OUT}/judge`, { recursive: true });
const srcVis = visible(readFileSync(`${OUT}/source.full.html`, "utf8"));
const map: Record<string, Record<string, string>> = {}; // lang -> {A: model, ...}

LANGS.forEach((lang, i) => {
  // Rotate model→label per language index so position bias doesn't favor one model.
  const order = [MODELS[i % 3], MODELS[(i + 1) % 3], MODELS[(i + 2) % 3]];
  const labels = ["A", "B", "C"];
  map[lang] = {};
  let packet = `# Blind translation quality review — target language: ${langInfo(lang).name} (${lang})\n\n`;
  packet += `You are given an English SOURCE (a lesson from a Christian discipleship course) and THREE machine translations into ${langInfo(lang).name}, labeled A/B/C. Judge ONLY the prose a learner reads.\n\n## SOURCE (English)\n\n${srcVis}\n\n`;
  order.forEach((model, j) => {
    map[lang]![labels[j]!] = model!;
    const full = loadFull(model!, lang);
    packet += `\n## CANDIDATE ${labels[j]}\n\n${full ? visible(full) : "(missing)"}\n`;
  });
  writeFileSync(`${OUT}/judge/${lang}.packet.md`, packet);
});
writeFileSync(`${OUT}/judge-map.json`, JSON.stringify(map, null, 2));
console.log("packets written for:", LANGS.join(", "));
console.log("map:", JSON.stringify(map));
