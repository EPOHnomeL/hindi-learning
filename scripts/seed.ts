// Seeds the Neon TEST branch with the real Hindi topic for local dev so the
// reader has something to show. The metadata here points at the real artifacts
// (lessons/*.html, references/*.html), which `pnpm seed:r2` uploads to local
// R2. Reads the connection string from .env at runtime. Idempotent: it
// truncates first. No fabricated Responses/Questions — the conversation starts
// empty, as a real learner's would.
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL_TEST (or DATABASE_URL) in .env.");
  process.exit(1);
}
const sql = neon(url);

const TABLES = ["users", "topics", "lessons", "topic_references", "responses", "questions", "replies", "progress"];
await sql.query(`truncate table ${TABLES.join(", ")}`);

await sql`insert into users (id) values ('dev-user')`;
await sql`insert into topics (id, user_id, title, mission)
  values ('hindi', 'dev-user', 'Hindi — from the Bible',
          'Read the Gospels in Hindi well enough to follow a sermon, grounding every lesson in verses I already know in English.')`;

await sql`insert into lessons (id, topic_id, seq, title, r2_key)
  values ('0001-blessed-is-the-man', 'hindi', 1, ${"Blessed is the man — Psalm 1:1 & the habitual verb"}, 'lessons/0001-blessed-is-the-man.html')`;
await sql`insert into lessons (id, topic_id, seq, title, r2_key)
  values ('0002-counsel-of-the-wicked', 'hindi', 2, ${"In the counsel of the wicked — postpositions & the oblique case"}, 'lessons/0002-counsel-of-the-wicked.html')`;
await sql`insert into lessons (id, topic_id, seq, title, r2_key)
  values ('0003-the-man-who', 'hindi', 3, ${"The man who — जो, the relative pronoun"}, 'lessons/0003-the-man-who.html')`;

await sql`insert into topic_references (id, topic_id, title, r2_key, content_hash)
  values ('ref-core-words', 'hindi', ${"Grammar & core words (Psalm 1)"}, 'references/ref-core-words.html',
          'b86f1b708327318422a844801a4266af7130d52a7bca343ef366324bc9f7a13e')`;

console.log("seeded: topic 'hindi' (dev-user), 3 lessons, 1 reference.");
