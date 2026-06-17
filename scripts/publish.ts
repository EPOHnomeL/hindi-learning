// Mirrors the local workspace (lessons/, references/) into the Convex Hub.
// Source of truth stays on disk; this is a deliberate, idempotent push:
//   - lessons are immutable (insert if absent, else skipped); a <meta
//     name="supersedes"> retires the named prior lesson.
//   - references upsert on content change (skipped when the hash matches).
// Usage: pnpm run publish
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { convexUrl, ownerEmail, publishSecret } from "./_env";

const PROD = process.argv.includes("--prod");
const secret = publishSecret();
const owner = ownerEmail();
const client = new ConvexHttpClient(convexUrl(PROD));
console.log(`Publishing to ${PROD ? "PROD (live site)" : "dev"}…`);

const titleFrom = (html: string): string => {
  const raw = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "";
  const parts = raw.split(" · ");
  return (parts.length > 1 ? parts.slice(1).join(" · ") : raw).trim();
};
const supersedesFrom = (html: string): string | undefined =>
  html.match(/<meta\s+name=["']supersedes["']\s+content=["']([^"']+)["']/i)?.[1];
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
// Skip partials/templates (anything underscore-prefixed); only real artifacts.
const htmlFiles = (dir: string) =>
  readdirSync(dir).filter((f) => f.endsWith(".html") && !f.startsWith("_")).sort();

// Lessons are authored as lean fragments (content only); the shared <head>
// design system and the quiz-feedback <script> live once in lessons/_partials/
// and are wrapped on here at publish time, so the stored HTML stays fully
// self-contained. A file that is already a complete document (the immutable
// lessons published before this change) is passed through untouched.
const HEAD = readFileSync("lessons/_partials/head.html", "utf8").trim();
const FOOT = readFileSync("lessons/_partials/foot.html", "utf8").trim();
const assembleLesson = (raw: string): string => {
  const fragment = raw.trim();
  if (/<!DOCTYPE|<html[\s>]/i.test(fragment)) return raw; // already complete
  const title = fragment.match(/<title>[\s\S]*?<\/title>/i)?.[0] ?? "";
  const supersedes = fragment.match(/<meta\s+name=["']supersedes["'][^>]*>/i)?.[0] ?? "";
  const content = fragment
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\s+name=["']supersedes["'][^>]*>/i, "")
    .trim();
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

const topicId = await client.mutation(api.content.ensureTopic, { secret, ownerEmail: owner, slug: "hindi", title: "Hindi" });

for (const f of htmlFiles("lessons")) {
  const html = assembleLesson(readFileSync(`lessons/${f}`, "utf8"));
  const key = f.replace(/\.html$/, "");
  const seq = Number(key.match(/^(\d+)/)?.[1] ?? 0);
  const result = await client.mutation(api.content.publishLesson, {
    secret,
    topicId,
    key,
    seq,
    title: titleFrom(html),
    html,
    supersedes: supersedesFrom(html),
  });
  console.log(`lesson     ${key} — ${result.status}`);
}

for (const f of htmlFiles("references")) {
  const html = readFileSync(`references/${f}`, "utf8");
  const key = f.replace(/\.html$/, "");
  const result = await client.mutation(api.content.upsertReference, {
    secret,
    topicId,
    key,
    title: titleFrom(html),
    html,
    contentHash: sha256(html),
  });
  console.log(`reference  ${key} — ${result.status}`);
}

console.log("published to Convex.");
