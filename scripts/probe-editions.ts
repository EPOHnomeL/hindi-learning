// Scratch: discover which Editions exist for a Topic and locate one lesson key.
// Read-only, secret-guarded (readEditionBodies). Usage:
//   pnpm tsx scripts/probe-editions.ts --topic prophetic-school --key 0001
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { convexUrl, publishSecret, topicArg } from "./_env";
import { LANGUAGES } from "../convex/languages";

const key = (() => {
  const i = process.argv.indexOf("--key");
  return i >= 0 ? process.argv[i + 1]! : "0001";
})();
const slug = topicArg();
const client = new ConvexHttpClient(convexUrl(true));
const secret = publishSecret();

const found: { lang: string; rows: number; hasLesson: boolean }[] = [];
for (const { code } of LANGUAGES) {
  if (code === "en") continue;
  try {
    const rows = await client.query(api.translate.readEditionBodies, { secret, topicSlug: slug, lang: code });
    if (rows && rows.length > 0) {
      const hasLesson = rows.some((r) => r.kind === "lesson" && r.key === key);
      found.push({ lang: code, rows: rows.length, hasLesson });
    }
  } catch (e) {
    console.error(`  ${code}: ERROR ${(e as Error).message}`);
  }
}
console.log(`\nEditions with translation rows for "${slug}":`);
for (const f of found) console.log(`  ${f.lang.padEnd(8)} rows=${f.rows}  lesson-${key}=${f.hasLesson ? "YES" : "no"}`);
console.log(`\nTotal editions: ${found.length}`);
