// Publishes a translated Edition workspace back to the Hub — the sibling of
// publish.ts, for the translate Routine. The run materialises the source into
// topics/<slug>/, translates it into topics/<slug>/translations/<lang>/, then
// runs this. The layout mirrors the source: `title.txt`, `mission.txt` (only if
// the source had a mission), `lessons/<key>.html`, `references/<key>.html`. Each
// file is published via `translate.publishTranslation`, which re-reads the source
// to stamp its hash and (for lessons) reject a quiz-structure drift — a rejected
// or vanished item is `skipped` and falls back to English in the reader.
// This publishes the WHOLE workspace every time, and the routine runs it once per
// wave, so later waves re-send earlier items: those come back `unchanged` (no
// write, no progress tick) rather than counting as fresh progress.
// Usage: pnpm run publish-translation:prod --topic <slug>   (TRANSLATE_LANG from .env.local)
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { convexUrl, ownerEmail, publishSecret, topicArg } from "./_env";

const PROD = process.argv.includes("--prod");
const secret = publishSecret();
const owner = ownerEmail();
const slug = topicArg();
const lang = process.env.TRANSLATE_LANG;
if (!lang) {
  console.error("Missing TRANSLATE_LANG — `claim-translation` persists it to .env.local; run it first.");
  process.exit(1);
}
const base = `topics/${slug}/translations/${lang}`;
if (!existsSync(base)) {
  console.error(`No translated workspace at ${base}/ — translate the source into it before publishing.`);
  process.exit(1);
}
const client = new ConvexHttpClient(convexUrl(PROD));
console.log(`Publishing "${slug}" → ${lang} from ${base}/ to ${PROD ? "PROD" : "dev"}…`);

async function publish(kind: "title" | "mission" | "lesson" | "reference", key: string, fields: { title?: string; html?: string; text?: string }) {
  // `…Checked`, not the bare mutation: the mutation's quiz-structure guard is dead
  // code for blob-backed sources (it cannot read the source body), so publishing
  // through it skips the check entirely. The action re-reads the source blob and
  // rejects a body whose quiz markers drifted.
  const res = await client.action(api.translate.publishTranslationChecked, { secret, ownerEmail: owner, topicSlug: slug, lang: lang!, kind, key, ...fields });
  console.log(`${kind.padEnd(9)} ${key || "(course)"} — ${res.status}`);
}

const readText = (f: string) => readFileSync(`${base}/${f}`, "utf8").trim();
const filesIn = (dir: string) =>
  existsSync(`${base}/${dir}`) ? readdirSync(`${base}/${dir}`).filter((f) => f.endsWith(".html") && !f.startsWith("_")).sort() : [];
// The per-item title lives in the translated HTML's <title> (mirrors publish.ts):
// strip any "Brand · " prefix so the stored title is the human title alone.
const titleFrom = (html: string): string => {
  const raw = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "";
  const parts = raw.split(" · ");
  return (parts.length > 1 ? parts.slice(1).join(" · ") : raw).trim();
};

if (existsSync(`${base}/title.txt`)) await publish("title", "", { text: readText("title.txt") });
if (existsSync(`${base}/mission.txt`)) await publish("mission", "", { text: readText("mission.txt") });
for (const f of filesIn("lessons")) {
  const key = f.replace(/\.html$/, "");
  const html = readFileSync(`${base}/lessons/${f}`, "utf8");
  await publish("lesson", key, { title: titleFrom(html), html });
}
for (const f of filesIn("references")) {
  const key = f.replace(/\.html$/, "");
  const html = readFileSync(`${base}/references/${f}`, "utf8");
  await publish("reference", key, { title: titleFrom(html), html });
}
console.log("published to Convex.");
