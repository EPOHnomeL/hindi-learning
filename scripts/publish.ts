// Publishes a materialised Topic workspace (topics/<slug>/) into the Convex Hub
// — the source of truth (ADR 0009). The Routine materialises a Topic, authors in
// topics/<slug>/, then runs this. Idempotent and deliberate:
//   - the Mission (MISSION.md) is published if drafted (flips a seeded Topic active);
//   - lessons are immutable (insert if absent, else skipped); a <meta
//     name="supersedes"> retires the named prior lesson;
//   - learning records are append-only (insert-once);
//   - references upsert on content change (skipped when the hash matches).
// The shared design-system partials stay at the repo root (lessons/_partials/),
// not per-Topic. Usage: pnpm run publish:prod --topic <slug>
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { shuffleQuizOptions } from "../convex/quizShuffle";
import { convexUrl, ownerEmail, publishSecret, topicArg } from "./_env";

const PROD = process.argv.includes("--prod");
const secret = publishSecret();
const owner = ownerEmail();
const slug = topicArg();
const base = `topics/${slug}`;
const client = new ConvexHttpClient(convexUrl(PROD));

if (!existsSync(base)) {
  console.error(`No workspace at ${base}/ — run \`pnpm run materialise${PROD ? ":prod" : ""} --topic ${slug}\` first.`);
  process.exit(1);
}
console.log(`Publishing "${slug}" from ${base}/ to ${PROD ? "PROD (live site)" : "dev"}…`);

const titleFrom = (html: string): string => {
  const raw = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "";
  const parts = raw.split(" · ");
  return (parts.length > 1 ? parts.slice(1).join(" · ") : raw).trim();
};
const supersedesFrom = (html: string): string | undefined =>
  html.match(/<meta\s+name=["']supersedes["']\s+content=["']([^"']+)["']/i)?.[1];
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
// Upload a body to Convex File Storage and return its blob id — the HTML never
// rides through a function (.scratch/html-blob-storage). A redundant upload (an
// immutable lesson that already exists, or an unchanged reference) is dropped
// server-side by the publish mutation, so uploading unconditionally is safe.
const uploadHtml = async (html: string): Promise<Id<"_storage">> => {
  const url = await client.mutation(api.content.publish.generateContentUploadUrl, { secret });
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "text/html" }, body: html });
  if (!res.ok) throw new Error(`content upload failed: ${res.status}`);
  const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
  return storageId;
};
// Skip partials/templates (anything underscore-prefixed); only real artifacts.
const filesIn = (dir: string, ext: string) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(ext) && !f.startsWith("_")).sort() : [];

// Lessons are authored as lean fragments (content only); the shared <head>
// design system and the quiz-feedback <script> live once in lessons/_partials/
// (repo root, shared across Topics) and are wrapped on here at publish time, so
// the stored HTML stays fully self-contained. A file that is already a complete
// document (the immutable lessons published before this change) is passed through.
const HEAD = readFileSync("lessons/_partials/head.html", "utf8").trim();
const FOOT = readFileSync("lessons/_partials/foot.html", "utf8").trim();
const assembleLesson = (raw: string): string => {
  const fragment = raw.trim();
  if (/<!DOCTYPE|<html[\s>]/i.test(fragment)) return raw; // already complete
  const title = fragment.match(/<title>[\s\S]*?<\/title>/i)?.[0] ?? "";
  const supersedes = fragment.match(/<meta\s+name=["']supersedes["'][^>]*>/i)?.[0] ?? "";
  // Balance the correct-answer position: the authoring model clusters it at the
  // first option, so shuffle each quiz's options deterministically here before
  // storing (same helper the backfill uses). Author intent (data-correct) is
  // preserved; only display order changes. See .scratch/quiz-shuffle/PRD.md.
  const content = shuffleQuizOptions(
    fragment
      .replace(/<title>[\s\S]*?<\/title>/i, "")
      .replace(/<meta\s+name=["']supersedes["'][^>]*>/i, "")
      .trim(),
  );
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${title}
${supersedes}
${HEAD}
</head>
<body>
<div class="wrap">
${content}
</div>
${FOOT}
</body>
</html>
`;
};

// Title only matters when creating a brand-new Topic; a seeded/existing one keeps
// its own title (ensureTopic just backfills the owner). Real Topics are Seeded
// from the dashboard with a title, so this fallback rarely bites.
const title = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const topicId = await client.mutation(api.content.publish.ensureTopic, { secret, ownerEmail: owner, slug, title });

// The Mission, if drafted (materialise writes MISSION.md only once it exists;
// a still-seeded Topic has SEED.md instead). Publishing it flips seeded → active.
if (existsSync(`${base}/MISSION.md`)) {
  const mission = readFileSync(`${base}/MISSION.md`, "utf8").trim();
  if (mission) {
    await client.mutation(api.content.publish.publishMission, { secret, ownerEmail: owner, topicSlug: slug, mission });
    console.log("mission    published");
  }
}

for (const f of filesIn(`${base}/lessons`, ".html")) {
  const html = assembleLesson(readFileSync(`${base}/lessons/${f}`, "utf8"));
  const key = f.replace(/\.html$/, "");
  const seq = Number(key.match(/^(\d+)/)?.[1] ?? 0);
  const storageId = await uploadHtml(html);
  const result = await client.mutation(api.content.publish.publishLesson, {
    secret,
    topicId,
    key,
    seq,
    title: titleFrom(html),
    storageId,
    supersedes: supersedesFrom(html),
  });
  console.log(`lesson     ${key} — ${result.status}`);
}

for (const f of filesIn(`${base}/learning-records`, ".md")) {
  const key = f.replace(/\.md$/, "");
  const seq = Number(key.match(/^(\d+)/)?.[1] ?? 0);
  const result = await client.mutation(api.content.publish.publishLearningRecord, {
    secret,
    topicId,
    key,
    seq,
    markdown: readFileSync(`${base}/learning-records/${f}`, "utf8"),
  });
  console.log(`record     ${key} — ${result.status}`);
}

for (const f of filesIn(`${base}/references`, ".html")) {
  const html = readFileSync(`${base}/references/${f}`, "utf8");
  const key = f.replace(/\.html$/, "");
  const storageId = await uploadHtml(html);
  const result = await client.mutation(api.content.publish.upsertReference, {
    secret,
    topicId,
    key,
    title: titleFrom(html),
    storageId,
    contentHash: sha256(html),
  });
  console.log(`reference  ${key} — ${result.status}`);
}

console.log("published to Convex.");
