// Rules copied verbatim from 06-st-za-rewrite.ts to sanity-check them offline.
const RULES = [
  [/ts['’ʼ]/g, "tsh"],
  [/th['’ʼ]/g, "th"],
  [/š/g, "sh"],
  [/^['’ʼ]([mn])/g, "$1$1"],
  [/ch/g, "tjh"],
  [/kh/g, "kg"],
  [/ea/g, "ya"],
  [/oa/g, "wa"], [/oe/g, "we"],
  [/(?<![htk])l([iu])/g, "d$1"],
];
const OVERRIDES = {};
function rewriteWord(word) {
  const lower = word.toLowerCase();
  const out = OVERRIDES[lower] ?? RULES.reduce((w, [re, to]) => w.replace(re, to), lower);
  if (out === lower) return word;
  if (word === word.toUpperCase() && /[A-Z]/.test(word)) return out.toUpperCase();
  if (/^[A-Z]/.test(word)) return out.charAt(0).toUpperCase() + out.slice(1);
  return out;
}
const CASES = [
  ["lumela", "dumela"], ["Molimo", "Modimo"], ["lipalo", "dipalo"],
  ["khotso", "kgotso"], ["Khotso", "Kgotso"], ["chelete", "tjhelete"],
  ["ts'ehetso", "tshehetso"], ["'me", "mme"], ["'na", "nna"],
  ["ea", "ya"], ["oa", "wa"], ["ntoa", "ntwa"], ["boea", "boya"],
  // must NOT change:
  ["hlile", "hlile"], ["tlisa", "tlisa"], ["batho", "batho"], ["Jesu", "Jesu"],
  ["sepheo", "sepheo"], ["moklise", "moklise"],
];
let bad = 0;
for (const [from, want] of CASES) {
  const got = rewriteWord(from);
  if (got !== want) { bad++; console.log(`FAIL  ${from}  → ${got}   (expected ${want})`); }
  else console.log(`ok    ${from}  → ${got}`);
}
// The interesting tail: words where two rules interact.
for (const w of ["likhomo", "lekhetho", "tsohle", "chelete", "lithuto", "molula-setulo", "khoeli", "loetse"])
  console.log(`   ${w} → ${rewriteWord(w)}`);
console.log(bad ? `\n${bad} FAILURES` : "\nall pass");
