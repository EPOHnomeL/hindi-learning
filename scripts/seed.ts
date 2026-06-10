// Resets the Neon DEV branch to a clean identity for local dev: the dev user
// and the Hindi Topic, with all tables truncated. Artifacts (Lessons, References)
// are NOT seeded here — they are owned by `pnpm run publish`, which scans the
// workspace and pushes them to R2 + the Hub. So local setup is: `pnpm seed`
// (reset) then `pnpm run publish` (publish the workspace). Reads the connection
// string from .env at runtime. Idempotent. Deliberately has NO --prod mode —
// it truncates every table.
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { resolveDbUrl } from "./db.ts";

const sql = neon(resolveDbUrl());

const TABLES = ["users", "topics", "lessons", "topic_references", "responses", "questions", "replies", "progress"];
await sql.query(`truncate table ${TABLES.join(", ")}`);

await sql`insert into users (id) values ('dev-user')`;
await sql`insert into topics (id, user_id, title, mission)
  values ('hindi', 'dev-user', 'Hindi — from the Bible',
          'Read the Gospels in Hindi well enough to follow a sermon, grounding every lesson in verses I already know in English.')`;

console.log("seeded: dev-user + topic 'hindi'. Run `pnpm run publish` to publish the workspace artifacts.");
