// Scratch eval: prepare the model-translation comparison for one lesson.
// Reuses the REAL production helpers so the test mirrors the shipped path.
//   pnpm tsx scripts/xlate-prep.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { convexUrl, publishSecret } from "./_env";
import { buildTranslateMessages, swapOutStatic } from "../convex/translate";
import { langInfo } from "../convex/languages";
import { readFileSync } from "node:fs";

const SLUG = "prophetic-school";
const KEY = "0001-learning-to-listen";
const LANGS = ["es", "fr", "af", "mg", "ur", "zu", "xh", "hi-Latn", "bn-Latn"];
const OUT = `topics/${SLUG}/eval`; // gitignored

const sourceFull = readFileSync(`topics/${SLUG}/lessons/${KEY}.html`, "utf8");
const { stripped, blocks } = swapOutStatic(sourceFull);

mkdirSync(`${OUT}/prompts`, { recursive: true });
mkdirSync(`${OUT}/gemini`, { recursive: true });
mkdirSync(`${OUT}/sonnet`, { recursive: true });
mkdirSync(`${OUT}/opus`, { recursive: true });
writeFileSync(`${OUT}/source.full.html`, sourceFull);
writeFileSync(`${OUT}/source.stripped.html`, stripped);
writeFileSync(`${OUT}/blocks.json`, JSON.stringify(blocks));
console.log(`source: ${sourceFull.length}B full, ${stripped.length}B stripped, ${blocks.length} static blocks swapped`);

const client = new ConvexHttpClient(convexUrl(true));
const secret = publishSecret();

for (const lang of LANGS) {
  const name = langInfo(lang).name;
  // The exact system prompt the production path sends for this language.
  const msgs = buildTranslateMessages(stripped, name, "html");
  writeFileSync(`${OUT}/prompts/${lang}.system.txt`, msgs[0]!.content);

  // The shipped Gemini 3.5 translation (blob-backed → signed URL).
  const rows = await client.query(api.translate.readEditionBodies, { secret, topicSlug: SLUG, lang });
  const row = rows?.find((r) => r.kind === "lesson" && r.key === KEY);
  if (!row) {
    console.log(`  ${lang}: NO gemini lesson row`);
    continue;
  }
  const html = row.html ?? (row.url ? await (await fetch(row.url)).text() : "");
  writeFileSync(`${OUT}/gemini/${lang}.html`, html);
  console.log(`  ${lang.padEnd(8)} (${name}): gemini ${html.length}B, prompt ${msgs[0]!.content.length}B`);
}
console.log(`\nprepared → ${OUT}/  |  langs: ${LANGS.join(", ")}`);
