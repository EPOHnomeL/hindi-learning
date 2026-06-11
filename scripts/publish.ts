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
import { convexUrl, publishSecret } from "./_env.ts";

const secret = publishSecret();
const client = new ConvexHttpClient(convexUrl());

const titleFrom = (html: string): string => {
  const raw = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "";
  const parts = raw.split(" · ");
  return (parts.length > 1 ? parts.slice(1).join(" · ") : raw).trim();
};
const supersedesFrom = (html: string): string | undefined =>
  html.match(/<meta\s+name=["']supersedes["']\s+content=["']([^"']+)["']/i)?.[1];
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const htmlFiles = (dir: string) => readdirSync(dir).filter((f) => f.endsWith(".html")).sort();

await client.mutation(api.content.ensureTopic, { secret, title: "Hindi" });

for (const f of htmlFiles("lessons")) {
  const html = readFileSync(`lessons/${f}`, "utf8");
  const key = f.replace(/\.html$/, "");
  const seq = Number(key.match(/^(\d+)/)?.[1] ?? 0);
  const result = await client.mutation(api.content.publishLesson, {
    secret,
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
    key,
    title: titleFrom(html),
    html,
    contentHash: sha256(html),
  });
  console.log(`reference  ${key} — ${result.status}`);
}

console.log("published to Convex.");
