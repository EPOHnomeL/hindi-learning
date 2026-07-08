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
mkdirSync(`${base}/learning-records`, { recursive: true });

// The course title as plain text — the teach run ignores it; the translate run
// reads it as the source for the title Edition (it isn't inside any lesson file).
writeFileSync(`${base}/TITLE.txt`, ctx.topic.title);
// Lesson/Reference bodies live in content blobs (.scratch/html-blob-storage):
// materialiseTopic returns a signed `htmlUrl` we fetch, falling back to inline
// `html` for not-yet-migrated rows. Empty only if a row has neither (unexpected).
const bodyOf = async (x: { html: string | null; htmlUrl: string | null }): Promise<string> => {
  if (x.html != null) return x.html;
  if (x.htmlUrl) {
    const res = await fetch(x.htmlUrl);
    if (!res.ok) throw new Error(`content fetch failed: ${res.status}`);
    return await res.text();
  }
  return "";
};
for (const l of ctx.lessons) writeFileSync(`${base}/lessons/${l.key}.html`, await bodyOf(l));
for (const r of ctx.references) writeFileSync(`${base}/references/${r.key}.html`, await bodyOf(r));
for (const lr of ctx.learningRecords) writeFileSync(`${base}/learning-records/${lr.key}.md`, lr.markdown);
writeFileSync(`${base}/CAPTURE.json`, JSON.stringify(ctx.capture, null, 2));

// The Mission round-trips through a file (PRD §4). A drafted mission → MISSION.md
// (publish reads it back). A still-seeded Topic has only the learner's "why" → a
// SEED.md the Routine drafts the mission from; no MISSION.md exists yet, which is
// the signal to draft one. Writing both files would blur that signal, so it's
// strictly one or the other.
if (ctx.topic.mission) {
  writeFileSync(`${base}/MISSION.md`, ctx.topic.mission.endsWith("\n") ? ctx.topic.mission : `${ctx.topic.mission}\n`);
} else {
  writeFileSync(
    `${base}/SEED.md`,
    `# Seed — draft the Mission from this\n\n` +
      `This Topic is **seeded** but has no Mission yet. Draft one from the learner's "why" ` +
      `below plus the resources, write it to MISSION.md, then publish.\n\n` +
      `## The learner's "why"\n\n${ctx.topic.seed ?? "(none given)"}\n`,
  );
}

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
  `materialised "${slug}" → ${base}/ (${ctx.lessons.length} lessons, ${ctx.learningRecords.length} records, ` +
    `${ctx.references.length} refs, ${ctx.resources.length} resources; ${ctx.topic.mission ? "MISSION.md" : "SEED.md"})`,
);
