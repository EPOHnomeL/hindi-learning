// Publishes the local teach workspace to the hub (ADR-0002). The HTML blobs go
// to the Artifact store (R2) via `wrangler r2 object put` (file-based, no
// escaping); the metadata rows go to the Neon Hub. Driven by the pure planner in
// src/publish/plan.ts, so the rules — immutable Lessons, Reference upsert-on-
// change, supersede — live in one tested place. Idempotent: re-running with no
// workspace changes does nothing, so authoring just re-runs it after each lesson.
//
// Usage: `pnpm run publish` (local R2 for dev) or `pnpm run publish -- --remote`.
//
// Conventions (the teach skill must follow these when it authors artifacts):
//   - one file per artifact under lessons/ or references/; the filename stem is
//     the artifact id (e.g. lessons/0004-delight-in-the-law.html → id, seq 4).
//   - <title> is "Lesson N · <display title>" / "Reference · <display title>";
//     the text after " · " becomes the Hub title.
//   - a Lesson that replaces another carries
//     <meta name="supersedes" content="<old-lesson-id>">.
import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { neon } from "@neondatabase/serverless";
import { planPublish, type PublishedArtifact, type WorkspaceArtifact } from "../src/publish/plan.ts";
import { resolveDbUrl } from "./db.ts";

const TOPIC_ID = "hindi"; // v1 has one Topic; CONTEXT.md.
const REMOTE = process.argv.includes("--remote");
const MODE = REMOTE ? "--remote" : "--local";

// --remote publishes blobs to the real R2 bucket AND metadata to the production
// branch; local mode pairs the simulated R2 with the dev branch.
const sql = neon(resolveDbUrl(REMOTE ? "prod" : "dev"));

interface Meta {
  kind: "lesson" | "reference";
  id: string;
  title: string;
  seq: number; // lessons only
  r2Key: string;
  contentHash: string;
  supersedes?: string;
  file: string;
}

const sha256 = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");

function titleFrom(html: string): string {
  const raw = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1].trim() ?? "";
  const parts = raw.split(" · ");
  return (parts.length > 1 ? parts.slice(1).join(" · ") : raw).trim();
}

function supersedesFrom(html: string): string | undefined {
  return html.match(/<meta\s+name=["']supersedes["']\s+content=["']([^"']+)["']/i)?.[1];
}

function scan(dir: "lessons" | "references", kind: "lesson" | "reference"): Meta[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".html"))
    .sort()
    .map((f) => {
      const id = f.replace(/\.html$/, "");
      const buf = readFileSync(`${dir}/${f}`);
      const html = buf.toString("utf8");
      return {
        kind,
        id,
        title: titleFrom(html),
        seq: Number(id.match(/^(\d+)/)?.[1] ?? 0),
        r2Key: `${dir}/${f}`,
        contentHash: sha256(buf),
        supersedes: kind === "lesson" ? supersedesFrom(html) : undefined,
        file: `${dir}/${f}`,
      };
    });
}

const metas = [...scan("lessons", "lesson"), ...scan("references", "reference")];
const byId = new Map(metas.map((m) => [`${m.kind}:${m.id}`, m]));

const workspace: WorkspaceArtifact[] = metas.map(({ kind, id, contentHash, supersedes }) => ({
  kind,
  id,
  contentHash,
  supersedes,
}));

const lessonRows = await sql`select id from lessons where topic_id = ${TOPIC_ID}`;
const refRows = await sql`select id, content_hash from topic_references where topic_id = ${TOPIC_ID}`;
const published: PublishedArtifact[] = [
  ...lessonRows.map((r) => ({ kind: "lesson" as const, id: r.id as string, contentHash: "" })),
  ...refRows.map((r) => ({ kind: "reference" as const, id: r.id as string, contentHash: r.content_hash as string })),
];

const { actions } = planPublish(workspace, published);
if (actions.length === 0) {
  console.log("Nothing to publish — the hub is up to date.");
  process.exit(0);
}

for (const action of actions) {
  if (action.type === "put-blob") {
    const m = byId.get(`${action.kind}:${action.id}`)!;
    console.log(`↑ blob       ${m.r2Key}`);
    execSync(`pnpm exec wrangler r2 object put served-teach-artifacts/${m.r2Key} --file=${m.file} ${MODE}`, {
      stdio: ["ignore", "ignore", "inherit"],
    });
  } else if (action.type === "insert-lesson") {
    const m = byId.get(`lesson:${action.id}`)!;
    await sql`insert into lessons (id, topic_id, seq, title, r2_key)
      values (${m.id}, ${TOPIC_ID}, ${m.seq}, ${m.title}, ${m.r2Key})`;
    console.log(`+ lesson     ${m.id} — ${m.title}`);
  } else if (action.type === "upsert-reference") {
    const m = byId.get(`reference:${action.id}`)!;
    await sql`insert into topic_references (id, topic_id, title, r2_key, content_hash)
      values (${m.id}, ${TOPIC_ID}, ${m.title}, ${m.r2Key}, ${m.contentHash})
      on conflict (id) do update set
        title = excluded.title, r2_key = excluded.r2_key, content_hash = excluded.content_hash`;
    console.log(`~ reference  ${m.id} — ${m.title}`);
  } else if (action.type === "mark-superseded") {
    await sql`update lessons set superseded_by = ${action.supersededBy} where id = ${action.id}`;
    console.log(`× superseded ${action.id} → ${action.supersededBy}`);
  }
}
console.log(`published ${actions.length} action(s) to topic '${TOPIC_ID}' (${MODE}).`);
