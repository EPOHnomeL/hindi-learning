// Post-publish verification against PROD, WITHOUT depending on a local snapshot.
//
// The earlier version compared `st` against st-za-review/before/, which every dry run
// regenerates — so once the dry run had been re-run against the published st-ZA, that
// "snapshot" held converted text and the check reported all 57 st rows as changed. It also
// compared text-only rows through `r.html`, which is undefined for them, so `title` and
// `mission` came back "identical" purely because undefined === undefined.
//
// This version asks the question directly instead: does each Edition read as the orthography
// it claims to be? Marker counts are snapshot-free and cannot go stale.
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { convexUrl, publishSecret, topicArg } from "./_env";

const client = new ConvexHttpClient(convexUrl(true));
const secret = publishSecret();
const slug = topicArg();

// Words that exist ONLY in one orthography, so their counts are a direct read on which one
// the stored text is written in.
const LESOTHO = [/\bMolimo\b/g, /\blentsoe\b/g, /\blipalo\b/g, /\bjoalo\b/g, /\bkhotso\b/g, /\bliliba\b/g, /\bdiliba\b/g];
const SOUTH_AF = [/\bModimo\b/g, /\blentswe\b/g, /\bdipalo\b/g, /\bjwalo\b/g, /\bkgotso\b/g, /\bdidiba\b/g];
const tally = (text: string, res: RegExp[]) => res.reduce((n, re) => n + (text.match(re) ?? []).length, 0);

for (const lang of ["st", "st-ZA"]) {
  const rows = await client.query(api.translate.readEditionBodies, { secret, topicSlug: slug, lang });
  if (!rows) throw new Error("topic not found");
  let all = "";
  let textRows = 0;
  for (const r of rows) {
    all += r.url ? await (await fetch(r.url)).text() : (r.html ?? "");
    // title/mission/question carry `text`, never `html` — counted explicitly, because
    // silently reading undefined here is exactly how the last version fooled itself.
    if (r.text !== undefined) { all += " " + r.text; textRows++; }
    if (r.reply !== undefined) all += " " + r.reply;
  }
  console.log(
    `${lang.padEnd(6)} ${rows.length} rows (${textRows} text-only)  ` +
      `Lesotho markers: ${String(tally(all, LESOTHO)).padStart(4)}   SA markers: ${String(tally(all, SOUTH_AF)).padStart(4)}`,
  );
}
