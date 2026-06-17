// Materialises a Topic's context from Convex into an ephemeral workspace
// `topics/<slug>/` so the teach skill can run against it (ADR 0009: the Routine
// pulls from Convex, never the repo). A claimed run calls this with its Topic.
// Usage: pnpm run materialise --topic <slug>
import { mkdirSync, writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { convexUrl, ownerEmail, publishSecret, topicArg } from "./_env";

const PROD = process.argv.includes("--prod");
const slug = topicArg();
const client = new ConvexHttpClient(convexUrl(PROD));

const ctx = await client.query(api.routine.materialiseTopic, {
  secret: publishSecret(),
  ownerEmail: ownerEmail(),
  topicSlug: slug,
});
if (!ctx) {
  console.error(`No owned Topic "${slug}" for ${ownerEmail()} — nothing to materialise.`);
  process.exit(1);
}

const base = `topics/${slug}`;
mkdirSync(`${base}/lessons`, { recursive: true });
mkdirSync(`${base}/references`, { recursive: true });
mkdirSync(`${base}/resources`, { recursive: true });

for (const l of ctx.lessons) writeFileSync(`${base}/lessons/${l.key}.html`, l.html);
for (const r of ctx.references) writeFileSync(`${base}/references/${r.key}.html`, r.html);
writeFileSync(`${base}/CAPTURE.json`, JSON.stringify(ctx.capture, null, 2));

// Resources: download the raw blob; record processed manifest + hash so issue
// 06's ingestion can skip re-rendering when the cache is current.
for (const res of ctx.resources) {
  if (!res.rawUrl) continue;
  const buf = Buffer.from(await (await fetch(res.rawUrl)).arrayBuffer());
  writeFileSync(`${base}/resources/${res.filename}`, buf);
}
writeFileSync(
  `${base}/resources/_index.json`,
  JSON.stringify(
    ctx.resources.map((r) => ({ filename: r.filename, kind: r.kind, status: r.status, contentHash: r.contentHash, processed: r.processed })),
    null,
    2,
  ),
);

console.log(
  `materialised "${slug}" → ${base}/ (${ctx.lessons.length} lessons, ${ctx.references.length} refs, ${ctx.resources.length} resources)`,
);
