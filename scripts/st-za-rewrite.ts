// The st (Lesotho) → st-ZA (South African) orthography rewrite, for wayfinder ticket
// course-translation/06. Rules and the reasoning behind every choice here live in
// 06-orthography-rules.md — read it before changing a regex.
//
// Three modes, meant to be run in this order, each a separate human decision:
//
//   pnpm tsx <this> --topic prophetic-school --clone            # st → st-ZA via cloneEdition (prod)
//   pnpm tsx <this> --topic prophetic-school                    # DRY RUN: read st-ZA, transform, write review/
//   pnpm tsx <this> --topic prophetic-school --publish          # publish review/**/*.html back to st-ZA
//
// The dry run writes `st-za-review/` and touches nothing remote. `--publish` re-reads those
// same files off disk, so the bytes a human approved are the bytes that ship. Between the
// two, add findings to OVERRIDES below and re-run the dry run until the ledger is clean.
//
// Copy this out of .plan/ before running — the ../ imports resolve from a script at the
// repo root (e.g. scripts/st-za-rewrite.ts), not from here.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { convexUrl, ownerEmail, publishSecret, topicArg } from "./_env";
import { swapOutStatic, swapBackStatic, quizStructureMatches } from "../convex/translate";

const FROM = "st";
const TO = "st-ZA";
const slug = topicArg();
const secret = publishSecret();
const OUT = `st-za-review/${slug}`;
// convexUrl(true) reads CONVEX_PROD_URL. Deliberately NOT the Convex CLI: a dev
// CONVEX_DEPLOY_KEY in .env.local beats --prod and answers for dev. See the rules doc.
const client = new ConvexHttpClient(convexUrl(true));

// ---- the transform ---------------------------------------------------------

// Words the rules get wrong, found by reading the ledger. This table is the whole point of
// the review loop; an empty one means nobody has looked yet. An override is LITERAL: it is returned exactly as written, bypassing the rules AND the
// capitalisation logic below (which would otherwise "fix" the case of a word whose case is
// the whole point). Key is lowercase; matching is case-insensitive.
const OVERRIDES: Record<string, string> = {
  // Elision: Lesotho writes the apostrophe, SA closes it up. 362 occurrences.
  "holim'a": "hodima",
  // NOT a syllabic nasal — a quotation mark opening a quote in front of "Morena" (Lord).
  // Rule 8 reads the quote as the 'm of 'me/'mele and yields "Mmorena".
  "'morena": "'Morena",
  // English brand name, ends in a vowel so the isEnglishish guard can't see it.
  unsearchable: "Unsearchable",
  likewise: "likewise",
  leave: "leave",
  believe: "believe",
};

// Ordered. Apostrophes first (they expose letters the digraph rules then read), digraphs
// next, and the l→d rule last so it sees the final vowel spellings. Applied to a lowercase
// word; case is restored by the caller.
const RULES: [RegExp, string][] = [
  [/ts['’ʼ]/g, "tsh"], //        6  ts' → tsh
  [/th['’ʼ]/g, "th"], //         7  th' → th
  [/š/g, "sh"], //                    6  š → sh (tš → tsh falls out of this)
  // 8 is NOT in this list — it needs a stem check the other rules don't. See SYLLABIC below.
  [/ch/g, "tjh"], //                       5
  [/kh/g, "kg"], //                        4
  [/ea/g, "ya"], //                        2
  [/oa/g, "wa"], //                        3
  // 3b  same glide, other vowel — but NOT when the `o` is the class prefix of a word-initial
  // `bo-`/`mo-`, where no glide exists: boemo, moelelo, boetapele all stay put, while the
  // passive -tsoe → -tswe, boloetse → bolwetse and khoeli → kgwedi still fire. Measured on
  // the real Edition: without the lookbehind this rule was wrong on 133 `boemo` alone.
  [/(?<!^[bm])oe/g, "we"],
  // 1  l → d before i/u, never inside hl/tl/kl. The negative LOOKBEHIND matters: the earlier
  // `(^|[^htk])l([iu])` consumed the preceding character, so in a word with two adjacent
  // `li` syllables the first match ate the slot the second one needed — "liliba" came out
  // "diliba" instead of "didiba", and only a second pass finished the job. Lookbehind
  // consumes nothing, so overlapping occurrences all convert in one pass.
  [/(?<![htk])l([iu])/g, "d$1"],
];

// The `st` Edition carries untranslated ENGLISH — scripture quotations, headings, the
// breadcrumb — inherited from a source defect (the same leak the hindi map's ticket 06 is
// about). Left alone the rules maul it: Christ → Tjhrist, school → stjhool, believes →
// bedieves. Sesotho orthography gives a cheap, near-exact guard: a Sesotho word ends in a
// vowel or in the cluster `ng`, and essentially nothing else, whereas English words end in
// every consonant going. So a word ending in some other consonant is not Sesotho — don't
// touch it. This is a GUARD, not a repair: the English still ships as English, exactly as
// it does in `st` today. The tail it misses (English ending in a vowel — "likewise",
// "leave") is small enough to enumerate in OVERRIDES.
const NOT_SESOTHO = /[bcdfghjklmnpqrstvwxyz]$/i;
const isEnglishish = (w: string) => NOT_SESOTHO.test(w) && !/ng$/i.test(w);

// Rule 8, the syllabic nasal ('me → mme), needs more care than a regex. In this corpus a
// leading apostrophe is AMBIGUOUS: it is the nasal in "'me"/"'nete", but an ordinary opening
// QUOTE MARK in "'Molimo o mpolletse…" — and nothing in the string separates them, because
// "'Me" (mother) is a legitimately capitalised nasal. Doubling blindly gave "'Molimo" →
// "Mmodimo", "'Moya" → "Mmoya", "'Mokreste" → "Mmokreste", and even "'Nna" → "Nnna".
//
// So the rule fires only for stems on this reviewed list; every other leading apostrophe is
// left as the quote mark it almost certainly is. Under-transforming a rare word is cheap and
// visible in untouched.tsv — corrupting the word for God in a Bible course is neither.
// UNVERIFIED BY A SESOTHO SPEAKER: this list is inferred from frequency and shape.
const SYLLABIC = new Set([
  "me", "na", "ne", "nete", "neteng", "ngoe", "mele", "meleng", "meli", "maloa", "mapa",
  "mapeng", "moho", "mino", "muso", "matla", "nang", "nka", "nile", "nileng", "moo", "mpho",
  "netefatsong", "nesitsweng", "ntšoarele", "neo", "nnete",
]);

/** Transform one bare word (letters/apostrophes only, no markup, no entities). */
function rewriteWord(word: string): string {
  const lower = word.toLowerCase();
  const override = OVERRIDES[lower];
  // Literal, and never re-cased. An override that only says "leave this alone" returns the
  // word as it was found, so it keeps whatever capitalisation the source gave it.
  if (override !== undefined) return override.toLowerCase() === lower ? word : override;
  if (isEnglishish(word)) return word;
  // Rule 8, ahead of the rest so the un-apostrophed stem goes through them normally. The
  // `[mn]` is not re-doubled when the stem already carries it ("'nna" is already "nna").
  let seed = lower;
  const nasal = /^['’ʼ]([mn])(.*)$/.exec(lower);
  if (nasal && SYLLABIC.has(nasal[1]! + nasal[2]!)) {
    seed = nasal[2]!.startsWith(nasal[1]!) ? nasal[1]! + nasal[2]! : nasal[1]! + nasal[1]! + nasal[2]!;
  }
  const out = RULES.reduce((w, [re, to]) => w.replace(re, to), seed);
  if (out === lower) return word; // unchanged — keep the original casing verbatim
  return recase(word, out);
}

/** Put `was`'s capitalisation back onto the rewritten `now`. */
function recase(was: string, now: string): string {
  if (was === was.toUpperCase() && /[A-Z]/.test(was)) return now.toUpperCase();
  // Capitalise by the first LETTER, not the first character: a word can open with a quote
  // mark ("'Joale"), and testing /^[A-Z]/ silently downcased every one of them.
  const i = now.search(/[a-z]/);
  const first = was.search(/[A-Za-z]/);
  if (i < 0 || first < 0 || !/[A-Z]/.test(was[first]!)) return now;
  return now.slice(0, i) + now.charAt(i).toUpperCase() + now.slice(i + 1);
}

/** Every distinct before→after pair the run produced: half the review artifact. */
const ledger = new Map<string, { to: string; count: number; example: string }>();

// The OTHER half, and the one that is easy to forget. The ledger can only show a rule that
// fired too eagerly; it is structurally blind to a rule that is MISSING, because a Lesotho
// spelling nothing matched simply does not appear in it. (That blindness is not theoretical
// — the rule set shipped without `oe` → `we` until "khoeli" was hand-checked and came back
// "kgoedi" instead of "kgwedi".) So every word left untouched is recorded too: the reviewer
// scans this list for residual Lesotho spellings, and each one found becomes a new rule.
const untouched = new Map<string, number>();

// Entities are swapped for a sentinel before the word pass, so `&nbsp;` is never read as a
// Sesotho word. The braces have to be there: a bare
// numeric marker would be ambiguous — prose really does contain standalone digits
// ("Lesson 2", "§3") — and the {{N}} sentinel cannot occur in a lesson body or be matched
// by the word regex.
const ENT_OPEN = "{{";
const ENT_CLOSE = "}}";
const ENT_MARKER = /\{\{(\d+)\}\}/g;
// \p{L}, not [A-Za-zšŠ]: the corpus carries accented Latin ("thetso e khōlō"), and any letter
// missing from this class SPLITS the word around it. That is worse than it sounds — the
// fragments ("kh", "l") then end in consonants, so isEnglishish reads them as English and
// waves them through, and the word ships unconverted while looking clean in both artifacts.
const WORD = /[\p{L}'’ʼ]+/gu;

/** Transform free text: markup has already been stripped away by the caller. */
function rewriteText(text: string): string {
  const entities: string[] = [];
  const safe = text.replace(/&[a-zA-Z][a-zA-Z0-9]*;|&#\d+;/g, (e) => {
    entities.push(e);
    return ENT_OPEN + (entities.length - 1) + ENT_CLOSE;
  });
  const done = safe.replace(WORD, (word: string, offset: number, whole: string) => {
    const next = rewriteWord(word);
    if (next === word) {
      untouched.set(word, (untouched.get(word) ?? 0) + 1);
      return word;
    }
    const hit = ledger.get(word) ?? {
      to: next,
      count: 0,
      example: whole.slice(Math.max(0, offset - 40), offset + 40).replace(/\s+/g, " ").trim(),
    };
    hit.count++;
    ledger.set(word, hit);
    return next;
  });
  return done.replace(ENT_MARKER, (_m, n: string) => entities[Number(n)]!);
}

// Learner-visible attribute values (see the rules doc's table). data-correct / data-k /
// class / href are machinery and must survive byte-identical.
const CONTENT_ATTRS = /\b(data-no|data-ok|data-answer|data-alt|alt|placeholder|title|aria-label)="([^"]*)"/g;
const LANG_ATTR = /\blang="st"/g;

function rewriteHtml(html: string): string {
  const { stripped, blocks } = swapOutStatic(html); // <style>/<script> out of reach entirely
  // Split into tags and text; only text nodes and whitelisted attribute values are touched.
  const out = stripped.replace(/(<[^>]*>)|([^<]+)/g, (_m, tag?: string, text?: string) => {
    if (text !== undefined) return rewriteText(text);
    return tag!
      .replace(CONTENT_ATTRS, (_a, name: string, value: string) => name + '="' + rewriteText(value) + '"')
      .replace(LANG_ATTR, 'lang="' + TO + '"');
  });
  const restored = swapBackStatic(out, blocks);
  if (restored === null) throw new Error("static-block placeholders did not round-trip — refusing to continue");
  return restored;
}

// ---- modes -----------------------------------------------------------------

if (process.argv.includes("--clone")) {
  const res = await client.mutation(api.translate.cloneEdition, {
    secret,
    topicSlug: slug,
    fromLang: FROM,
    toLang: TO,
  });
  console.log("cloned " + FROM + " → " + TO + " on PROD:", res);
  console.log("\n! " + TO + " now exists holding LESOTHO text. Dry-run, get the ledger read, then --publish.");
  process.exit(0);
}

// A document row carries `file` (its HTML); a text-only row (`title`, `mission`) carries
// `text`. The Edition's own title and mission are NOT optional extras — they are what the
// language switcher and the course card show, so an Edition converted without them reads as
// Lesotho at every entry point and South African only once you are inside a lesson.
type Item =
  | { kind: "lesson" | "reference"; key: string; title?: string; file: string }
  | { kind: "title" | "mission"; key: string; text: string };

if (process.argv.includes("--publish")) {
  const owner = ownerEmail();
  if (!existsSync(OUT + "/after")) throw new Error("No reviewed output at " + OUT + "/after — run the dry run first.");
  const manifest: Item[] = JSON.parse(readFileSync(OUT + "/manifest.json", "utf8"));
  for (const item of manifest) {
    const body =
      "file" in item
        ? { title: item.title, html: readFileSync(OUT + "/after/" + item.file, "utf8") }
        : { text: item.text };
    const res = await client.mutation(api.translate.publishTranslation, {
      secret,
      ownerEmail: owner,
      topicSlug: slug,
      lang: TO,
      kind: item.kind,
      key: item.key,
      ...body,
    });
    // `skipped` means the quiz guard rejected it and the reader falls back to ENGLISH for
    // this lesson. That is a failure, not noise — do not let it scroll past.
    console.log((res.status === "skipped" ? "!! SKIPPED" : res.status.padEnd(10)) + " " + item.kind + " " + item.key);
  }
  console.log("\npublished. Now open the st-ZA Edition in a browser and spot-check it.");
  process.exit(0);
}

// ---- dry run ---------------------------------------------------------------

const rows = await client.query(api.translate.readEditionBodies, { secret, topicSlug: slug, lang: TO });
if (!rows) throw new Error("no " + TO + " edition on prod for " + slug + " — run --clone first");
mkdirSync(OUT + "/before", { recursive: true });
mkdirSync(OUT + "/after", { recursive: true });

const manifest: Item[] = [];
let blobBacked = 0;
for (const r of rows) {
  if (r.kind === "title" || r.kind === "mission") {
    // Plain text, no markup — straight through rewriteText, and into the same review files
    // so the diff and the ledger cover them like everything else.
    if (r.text === undefined) continue;
    const next = rewriteText(r.text);
    writeFileSync(OUT + "/before/" + r.kind + ".txt", r.text);
    writeFileSync(OUT + "/after/" + r.kind + ".txt", next);
    manifest.push({ kind: r.kind, key: r.key, text: next });
    console.log(r.kind + ": " + JSON.stringify(r.text) + "\n" + " ".repeat(r.kind.length) + "→ " + JSON.stringify(next));
    continue;
  }
  if (r.kind !== "lesson" && r.kind !== "reference") {
    // `question`/`reply` are learner Q&A, not course content — left for a separate decision.
    console.log("(skipping " + r.kind + ' "' + r.key + '" — handle separately)');
    continue;
  }
  // A blob-backed row is one still sharing an _storage object with the LESOTHO edition.
  // Every one of these MUST be republished even if the transform changes nothing.
  if (r.url) blobBacked++;
  const html = r.url ? await (await fetch(r.url)).text() : r.html;
  if (html === undefined) throw new Error("row " + r.kind + "/" + r.key + " has neither html nor a blob url");
  const file = r.kind + "-" + r.key + ".html";
  const next = rewriteHtml(html);
  if (r.kind === "lesson" && !quizStructureMatches(html, next)) throw new Error("quiz markers drifted in " + file);
  writeFileSync(OUT + "/before/" + file, html);
  writeFileSync(OUT + "/after/" + file, next);
  manifest.push({ kind: r.kind, key: r.key, title: r.title ? rewriteText(r.title) : undefined, file });
}
writeFileSync(OUT + "/manifest.json", JSON.stringify(manifest, null, 2));

// The ledger is what a human actually reads. Most-frequent first: the rules earn their keep
// at the top, and the exception tail collects at the bottom where it is easy to scan.
const sorted = [...ledger].sort((a, b) => b[1].count - a[1].count);
writeFileSync(
  OUT + "/ledger.tsv",
  ["count\tbefore\tafter\texample", ...sorted.map(([from, h]) => h.count + "\t" + from + "\t" + h.to + "\t" + h.example)].join("\n"),
);
const kept = [...untouched].sort((a, b) => b[1] - a[1]);
writeFileSync(OUT + "/untouched.tsv", ["count\tword", ...kept.map(([w, n]) => n + "\t" + w)].join("\n"));

console.log("\n" + manifest.length + " documents (" + blobBacked + " still blob-backed — all must be published)");
console.log(sorted.length + " distinct word changes → " + OUT + "/ledger.tsv");
console.log(kept.length + " distinct words left alone → " + OUT + "/untouched.tsv  (scan for MISSED rules)");
console.log("diff with:  git diff --no-index " + OUT + "/before " + OUT + "/after");
