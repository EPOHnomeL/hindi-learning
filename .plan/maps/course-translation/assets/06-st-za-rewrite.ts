// The st (Lesotho) → st-ZA (South African) orthography rewrite, for wayfinder ticket
// course-translation/06. Rules and the reasoning behind every choice here live in
// 06-orthography-rules.md — read it before changing a regex.
//
// Three modes, meant to be run in this order, each a separate human decision:
//
//   pnpm tsx <this> --topic <slug> --clone            # st → st-ZA via cloneEdition (prod)
//   pnpm tsx <this> --topic <slug>                    # DRY RUN: read st-ZA, transform, write review/
//   pnpm tsx <this> --topic <slug> --publish          # publish review/**/*.html back to st-ZA
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

// Words the rules get wrong. Populated from the ledger, lowercase key → literal
// replacement, applied INSTEAD of the rules. This table is the whole point of the
// review loop; an empty one means nobody has looked yet.
const OVERRIDES: Record<string, string> = {
  // "khristo": "Khristo",   // proper noun — rule 4 would give "Kgristo"
};

// Ordered. Apostrophes first (they expose letters the digraph rules then read), digraphs
// next, and the l→d rule last so it sees the final vowel spellings. Applied to a lowercase
// word; case is restored by the caller.
const RULES: [RegExp, string][] = [
  [/ts['’ʼ]/g, "tsh"], //        6  ts' → tsh
  [/th['’ʼ]/g, "th"], //         7  th' → th
  [/š/g, "sh"], //                    6  š → sh (tš → tsh falls out of this)
  [/^['’ʼ]([mn])/g, "$1$1"], //  8  'm / 'n → mm / nn (syllabic nasal)
  [/ch/g, "tjh"], //                       5
  [/kh/g, "kg"], //                        4
  [/ea/g, "ya"], //                        2
  [/oa/g, "wa"], //                        3
  [/oe/g, "we"], //                        3b  same glide, other vowel: loetse → lwetse
  [/(^|[^htk])l([iu])/g, "$1d$2"], //      1  l → d before i/u, never inside hl/tl/kl
];

/** Transform one bare word (letters/apostrophes only, no markup, no entities). */
function rewriteWord(word: string): string {
  const lower = word.toLowerCase();
  const override = OVERRIDES[lower];
  const out = override ?? RULES.reduce((w, [re, to]) => w.replace(re, to), lower);
  if (out === lower) return word; // unchanged — keep the original casing verbatim
  if (word === word.toUpperCase() && /[A-Z]/.test(word)) return out.toUpperCase();
  if (/^[A-Z]/.test(word)) return out.charAt(0).toUpperCase() + out.slice(1);
  return out;
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
const WORD = /[A-Za-zšŠ'’ʼ]+/g;

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

type Item = { kind: "lesson" | "reference"; key: string; title?: string; file: string };

if (process.argv.includes("--publish")) {
  const owner = ownerEmail();
  if (!existsSync(OUT + "/after")) throw new Error("No reviewed output at " + OUT + "/after — run the dry run first.");
  const manifest: Item[] = JSON.parse(readFileSync(OUT + "/manifest.json", "utf8"));
  for (const item of manifest) {
    const html = readFileSync(OUT + "/after/" + item.file, "utf8");
    const res = await client.mutation(api.translate.publishTranslation, {
      secret,
      ownerEmail: owner,
      topicSlug: slug,
      lang: TO,
      kind: item.kind,
      key: item.key,
      title: item.title,
      html,
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
  if (r.kind !== "lesson" && r.kind !== "reference") {
    // title / mission / question carry `text`/`reply`, not markup, and no blob. Reported so
    // the build decides deliberately rather than by omission — see the rules doc.
    console.log("(skipping " + r.kind + ' "' + r.key + '" — text-only row, handle separately)');
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
