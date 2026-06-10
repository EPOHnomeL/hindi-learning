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

// Ordered ids: References list by id, so the ref-1/ref-2 prefixes keep grammar
// above glossary in the reader.
await sql`insert into topic_references (id, topic_id, title, r2_key, content_hash)
  values ('ref-1-grammar', 'hindi', 'Current grammar', 'references/ref-grammar.html',
          'ce3a364a7f72d668838ae4b8a8b5ffada6c4bdca4720077e411f5fa65ee7e66c')`;
await sql`insert into topic_references (id, topic_id, title, r2_key, content_hash)
  values ('ref-2-glossary', 'hindi', 'Current glossary', 'references/ref-glossary.html',
          '9605a8397b5d82115ad7028bfa1141a280162634079d1a966251925d23f4aaca')`;

console.log("seeded: topic 'hindi' (dev-user), 3 lessons, 2 references (grammar + glossary).");
