// ARCHIVAL COPY of topics/_devanagari/check.ts (that tree is gitignored, so the
// working script cannot be committed). Identical in behaviour, except that the
// 2 raw NUL bytes it uses as the text-node split sentinel — chosen because it
// cannot collide with real content — are written here as the escape \0, so git
// treats this file as text and it stays reviewable and diffable.
// Local, no-API: the same structural checks the 02 harness ran on the Gemini output,
// applied to a conversion produced by the Claude Code session itself.
import { readFileSync, writeFileSync } from "node:fs";
import { swapBackStatic, quizStructureMatches } from "../../convex/translate";
const [, , srcPath, outPath, blocksPath, restoredPath, keepPath] = process.argv;
const src = readFileSync(srcPath, "utf8");
const out = readFileSync(outPath, "utf8");
const blocks = JSON.parse(readFileSync(blocksPath, "utf8")) as string[];

// The repair (06) translates the quiz attributes a learner is SHOWN — data-answer,
// data-alt, and the data-ok/data-no/data-ex feedback — so a tag-for-tag comparison of
// raw tag strings now fails all 57 items on a change we asked for. Mask those five
// values before comparing: tag names, tag order, and every other attribute
// (class/id/href/data-k/data-correct) stay byte-frozen, which is the part that
// actually protects the markup. Nothing else in the battery is relaxed.
const TRANSLATABLE_ATTRS = /\b(data-answer|data-alt|data-ok|data-no|data-ex)="[^"]*"/g;
const maskQuizAttrs = (t: string) => t.replace(TRANSLATABLE_ATTRS, '$1="◻"');
const tags = (h: string) => [...h.matchAll(/<\/?[a-zA-Z][^>]*>/g)].map((m) => maskQuizAttrs(m[0]));
const nodes = (h: string) => h.replace(/<[^>]*>/g, "\0").split("\0");
const count = (h: string, re: RegExp) => (h.match(re) ?? []).length;

const st = tags(src), ot = tags(out);
const drift = st.findIndex((t, i) => ot[i] !== t);
console.log(`tags        src=${st.length} out=${ot.length} firstDrift=${drift === -1 ? "none" : `#${drift}`}`);
if (drift !== -1) { console.log(`  src: ${st[drift]}`); console.log(`  out: ${ot[drift]}`); }

const ns = nodes(src), no = nodes(out);
console.log(`text nodes  src=${ns.length} out=${no.length} | nonempty src=${ns.filter((x) => x.trim()).length} out=${no.filter((x) => x.trim()).length}`);

let countDrift = 0;
for (const [name, re] of [
  ["id=", /\bid="/g], ["class=", /\bclass="/g], ["data-correct", /data-correct=/g], ["data-answer", /data-answer=/g],
  ["data-alt", /data-alt=/g], ["data-k", /data-k=/g], ["href", /href=/g], ["placeholder", /<!--⟦\d+⟧-->/g],
  ["nbsp", /&nbsp;/g], ["section-sign", /§/g], ["bullet", /•/g], ["mark", /<mark/g],
] as const) {
  const a = count(src, re), b = count(out, re);
  if (a !== b) countDrift++;
  console.log(`  ${a === b ? "ok   " : "DRIFT"} ${name}: src=${a} out=${b}`);
}

console.log(`quizStructureMatches=${quizStructureMatches(src, out)}`);
const restored = swapBackStatic(out, blocks);
console.log(`swapBackStatic=${restored ? `ok (${restored.length} chars)` : "NULL"}`);
console.log(`devanagari chars=${count(out, /[ऀ-ॿ]/g)}`);

// ---- 06's two replacement gates -------------------------------------------------
// The relaxed tag comparison above stopped asserting the quiz attribute values, so
// the guarantees they used to carry have to be asserted directly instead.

// (a) Answer-key answerability. norm() in lessons/_partials/foot.html collapses
// whitespace, trims and lowercases — a no-op on Devanagari — then compares exactly.
// So a key only works if it is NFC (what the file holds) and distinct from its alt.
// Nukta consonants are flagged, not failed: the precomposed form a learner's IME may
// emit (U+0958-U+095F) will never equal the NFC decomposed pair stored here.
const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
let keyProblems = 0;
for (const m of out.matchAll(/<div class="quiz fill"([^>]*)>/g)) {
  const attr = (n: string) => m[1].match(new RegExp(`${n}="([^"]*)"`))?.[1];
  const ans = attr("data-answer") ?? "", alt = attr("data-alt");
  const fail = (why: string) => { console.log(`  FAIL answer-key ${why}: ${JSON.stringify(ans)}`); keyProblems++; };
  if (!ans.trim()) fail("empty");
  else if (ans !== ans.normalize("NFC")) fail("not NFC — norm() compares exactly");
  // 06 decided the learner types Devanagari, so a surviving Latin key is the defect
  // this gate exists to catch. (A data-alt that only differs by case is fine and
  // expected — norm() lowercases, so `Peace`/`peace` is a deliberate redundancy.)
  else if (/[A-Za-z]/.test(ans)) fail("still Latin — the learner would have to type English");
  if (/[क़-य़]/.test(ans)) fail("holds a PRECOMPOSED nukta codepoint (file is NFC-decomposed)");
  else if (/[क-ह]़/.test(ans)) console.log(`  warn answer-key has a nukta consonant; IME variants may not match: ${JSON.stringify(ans)}`);
}
console.log(`answer keys   ${keyProblems === 0 ? "ok" : `${keyProblems} PROBLEM(S)`}`);

// (b) Latin residue. 06 decided every user-visible Latin run converts except cited
// people, organisations and English work titles. Visible text INCLUDES data-ok /
// data-no / data-ex — foot.html renders those to the learner, and they held 1,595 of
// the Edition's English words.
// The recurring names and work titles, kept globally so no item has to redeclare them.
const KEEP_LATIN = [
  "Basic Training for Prophetic Ministry", "Guidance of the Holy Spirit", "The gifts of the Holy Spirit",
  "Practicing Prophecy", "Encounters with God", "Walking in Power", "Holy Spirit Course",
  "YWAM Potchefstroom", "False Prophets", "Wikus Vorster", "Kris Vallotton", "Vallotton", "Vorster", "YWAM",
  "prophetic-school",
];
// Per-item declared keeps. Cited works have QUOTED SECTION TITLES ("Ways God can
// speak", "Deceit") that are legitimately Latin, differ per lesson, and cannot be
// enumerated globally — a fixed whitelist either fails every item or is padded until
// it stops gating. So the repairing agent declares what it deliberately left, in
// `repaired/<file>.keep.json`, and this gate fails anything UNDECLARED. The
// declarations are printed below precisely so a human read (04) can audit them: an
// agent that declares junk to silence the gate is visible in its own checklog.
let declared: string[] = [];
if (keepPath) {
  try { declared = JSON.parse(readFileSync(keepPath, "utf8")) as string[]; }
  catch { console.log(`  warn no readable keep-list at ${keepPath}`); }
  console.log(`declared keeps (${declared.length}): ${declared.join(" | ") || "none"}`);
}
// Comments must go before tags: `<[^>]*>` stops at the first `>`, so comment BODIES
// (including the design-system prose in the head chrome, and the `<!--⟦N⟧-->` static
// placeholders) would otherwise leak in and read as untranslated English. Entities go
// too, or `&nbsp;` scans as the word "nbsp".
const visible = [
  out.replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]*>/g, "\n"),
  ...[...out.matchAll(/\bdata-(?:ok|no|ex)="([^"]*)"/g)].map((m) => m[1]),
]
  .join("\n")
  .replace(/&[a-zA-Z]+;|&#\d+;/g, " ");
let residue = visible;
// Longest-first so a title containing a shorter keep ("Holy Spirit Course" vs a bare
// "Holy Spirit", which must NOT be kept) is removed as the whole title.
for (const keep of [...KEEP_LATIN, ...declared].sort((a, b) => b.length - a.length))
  residue = residue.split(keep).join(" ");
const left = [...new Set(residue.match(/[A-Za-z][A-Za-z'’-]{1,}/g) ?? [])];
console.log(`latin residue ${left.length === 0 ? "ok (none)" : `${left.length} RUN(S): ${left.join(", ")}`}`);

if (restored && restoredPath) writeFileSync(restoredPath, restored);
const failed = drift !== -1 || countDrift > 0 || keyProblems > 0 || left.length > 0 || !restored;
console.log(`VERDICT ${failed ? "FAIL" : "PASS"}`);
process.exit(failed ? 1 : 0);
